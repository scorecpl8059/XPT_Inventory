/**
 * PATCH /organizations/{orgId}/products/{id} — Update a product.
 *
 * Manager+ only.
 */
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'
import { docClient, PRODUCTS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, internalError } from '../../shared/response'

const schema = z.object({
  name:        z.string().min(1).max(255).optional(),
  sku:         z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  category:    z.string().max(100).optional(),
  status:      z.enum(['DRAFT', 'ACTIVE', 'DISCONTINUED']).optional(),
  unitPrice:   z.number().positive().optional(),
  cost:        z.number().positive().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field is required',
})

export const handler = withOrgAuth(async (event, { orgId }) => {
  const productId = event.pathParameters?.id
  if (!productId) return badRequest('Missing product ID')

  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const existing = await docClient.send(new GetCommand({
    TableName: PRODUCTS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `PROD#${productId}` },
    ProjectionExpression: 'productId',
  }))
  if (!existing.Item) return notFound('Product not found')

  const data = parsed.data
  const now = new Date().toISOString()
  const expNames: Record<string, string> = {}
  const expValues: Record<string, unknown> = { ':now': now }
  const setClauses = ['updatedAt = :now']

  if (data.name) { setClauses.push('#n = :name'); expNames['#n'] = 'name'; expValues[':name'] = data.name }
  if (data.sku) { setClauses.push('sku = :sku'); expValues[':sku'] = data.sku }
  if (data.description !== undefined) { setClauses.push('description = :desc'); expValues[':desc'] = data.description }
  if (data.category !== undefined) { setClauses.push('category = :cat'); expValues[':cat'] = data.category }
  if (data.status) { setClauses.push('#s = :status'); expNames['#s'] = 'status'; expValues[':status'] = data.status }
  if (data.unitPrice) { setClauses.push('unitPrice = :price'); expValues[':price'] = data.unitPrice }
  if (data.cost) { setClauses.push('cost = :cost'); expValues[':cost'] = data.cost }

  try {
    await docClient.send(new UpdateCommand({
      TableName: PRODUCTS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `PROD#${productId}` },
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeValues: expValues,
      ...(Object.keys(expNames).length > 0 && { ExpressionAttributeNames: expNames }),
    }))
  } catch (err) {
    console.error('[products/update] DynamoDB error:', err)
    return internalError()
  }

  return ok({ message: 'Product updated' })
}, { requireRole: 'manager' })
