/**
 * POST /organizations/{orgId}/proposals — Create a new product proposal.
 *
 * Any member can create proposals. Status starts as DRAFT.
 */
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { ulid } from 'ulid'
import { z } from 'zod'
import { docClient, USERS_TABLE, PROPOSALS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, internalError } from '../../shared/response'

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
  title:       z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  productData: productDataSchema,
})

export const handler = withOrgAuth(async (event, { userId, orgId }) => {
  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const { title, description, productData } = parsed.data
  const proposalId = ulid()
  const now = new Date().toISOString()

  // Get creator's name for denormalization
  const profile = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    ProjectionExpression: '#n',
    ExpressionAttributeNames: { '#n': 'name' },
  }))
  const createdByName = (profile.Item?.name as string) ?? ''

  try {
    await docClient.send(new PutCommand({
      TableName: PROPOSALS_TABLE,
      Item: {
        PK: `ORG#${orgId}`,
        SK: `PROP#${proposalId}`,
        proposalId,
        title,
        description,
        productData,
        status: 'DRAFT',
        createdBy: userId,
        createdByName,
        createdAt: now,
        updatedAt: now,
      },
    }))
  } catch (err) {
    console.error('[proposals/create] DynamoDB error:', err)
    return internalError()
  }

  return ok({ proposalId, title, status: 'DRAFT', createdAt: now })
})
