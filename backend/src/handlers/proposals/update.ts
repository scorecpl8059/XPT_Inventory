/**
 * PATCH /organizations/{orgId}/proposals/{id} — Update a draft proposal.
 *
 * Only the creator can update, and only while in DRAFT status.
 */
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'
import { docClient, PROPOSALS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, forbidden, internalError } from '../../shared/response'

const variantSchema = z.object({
  variantName: z.string().min(1).max(255),
  attributes:  z.record(z.string()).default({}),
  price:       z.number().positive().optional(),
  cost:        z.number().positive().optional(),
})

const productDataSchema = z.object({
  name:        z.string().min(1).max(255),
  sku:         z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  category:    z.string().max(100).optional(),
  unitPrice:   z.number().positive().optional(),
  cost:        z.number().positive().optional(),
  variants:    z.array(variantSchema).optional(),
})

const schema = z.object({
  title:       z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  productData: productDataSchema.optional(),
}).refine(data => data.title || data.description !== undefined || data.productData, {
  message: 'At least one field is required',
})

export const handler = withOrgAuth(async (event, { userId, orgId }) => {
  const proposalId = event.pathParameters?.id
  if (!proposalId) return badRequest('Missing proposal ID')

  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  // Verify proposal exists and is in DRAFT status
  const existing = await docClient.send(new GetCommand({
    TableName: PROPOSALS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
    ProjectionExpression: '#s, createdBy',
    ExpressionAttributeNames: { '#s': 'status' },
  }))

  if (!existing.Item) return notFound('Proposal not found')
  if (existing.Item.status !== 'DRAFT') return badRequest('Can only update proposals in DRAFT status')
  if (existing.Item.createdBy !== userId) return forbidden('Only the creator can update this proposal')

  const { title, description, productData } = parsed.data
  const now = new Date().toISOString()

  const expNames: Record<string, string> = {}
  const expValues: Record<string, unknown> = { ':now': now }
  const setClauses = ['updatedAt = :now']

  if (title) {
    setClauses.push('title = :title')
    expValues[':title'] = title
  }
  if (description !== undefined) {
    setClauses.push('description = :desc')
    expValues[':desc'] = description
  }
  if (productData) {
    setClauses.push('productData = :pd')
    expValues[':pd'] = productData
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: PROPOSALS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeValues: expValues,
      ...(Object.keys(expNames).length > 0 && { ExpressionAttributeNames: expNames }),
    }))
  } catch (err) {
    console.error('[proposals/update] DynamoDB error:', err)
    return internalError()
  }

  return ok({ message: 'Proposal updated' })
})
