/**
 * GET /organizations/{orgId}/stock/{productId} — Get stock levels for a specific product.
 *
 * Returns stock across all locations for the given product.
 */
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, INVENTORY_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { orgId }) => {
  const productId = event.pathParameters?.productId
  if (!productId) return badRequest('Missing product ID')

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: INVENTORY_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk':     `ORG#${orgId}`,
        ':prefix': `STOCK#${productId}#`,
      },
    }))

    const stock = (result.Items ?? []).map(item => ({
      productId:    item.productId,
      locationId:   item.locationId,
      quantity:     item.quantity,
      reorderPoint: item.reorderPoint,
      reorderQty:   item.reorderQty,
      lastUpdated:  item.lastUpdated,
    }))

    return ok({ stock })
  } catch (err) {
    console.error('[stock/getByProduct] DynamoDB error:', err)
    return internalError()
  }
})
