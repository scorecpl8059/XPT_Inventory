/**
 * GET /organizations/{orgId}/stock — List all stock levels.
 *
 * Returns stock levels across all locations. Supports ?locationId= filter.
 */
import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb'
import { docClient, INVENTORY_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { orgId }) => {
  const locationFilter = event.queryStringParameters?.locationId

  try {
    const expValues: Record<string, string> = {
      ':pk':     `ORG#${orgId}`,
      ':prefix': 'STOCK#',
    }

    const params: QueryCommandInput = {
      TableName: INVENTORY_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: expValues,
    }

    if (locationFilter) {
      params.FilterExpression = 'locationId = :locId'
      expValues[':locId'] = locationFilter
    }

    const result = await docClient.send(new QueryCommand(params))

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
    console.error('[stock/list] DynamoDB error:', err)
    return internalError()
  }
})
