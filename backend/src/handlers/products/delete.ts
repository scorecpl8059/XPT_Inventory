/**
 * DELETE /organizations/{orgId}/products/{id} — Soft-delete a product.
 *
 * Manager+ only. Sets status to DISCONTINUED rather than hard-deleting.
 */
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, PRODUCTS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { orgId }) => {
  const productId = event.pathParameters?.id
  if (!productId) return badRequest('Missing product ID')

  const existing = await docClient.send(new GetCommand({
    TableName: PRODUCTS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `PROD#${productId}` },
    ProjectionExpression: 'productId',
  }))
  if (!existing.Item) return notFound('Product not found')

  try {
    await docClient.send(new UpdateCommand({
      TableName: PRODUCTS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `PROD#${productId}` },
      UpdateExpression: 'SET #s = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':status': 'DISCONTINUED', ':now': new Date().toISOString() },
    }))
  } catch (err) {
    console.error('[products/delete] DynamoDB error:', err)
    return internalError()
  }

  return ok({ message: 'Product discontinued' })
}, { requireRole: 'manager' })
