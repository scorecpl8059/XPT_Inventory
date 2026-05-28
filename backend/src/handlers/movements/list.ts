/**
 * GET /organizations/{orgId}/movements — List stock movements.
 *
 * Any member can view. Supports optional ?productId= and ?type= filters.
 * Returns most recent movements first (ULID sort).
 */
import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb'
import { docClient, INVENTORY_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { orgId }) => {
  const productFilter = event.queryStringParameters?.productId
  const typeFilter    = event.queryStringParameters?.type

  try {
    const expValues: Record<string, string> = {
      ':pk':     `ORG#${orgId}`,
      ':prefix': 'MOVEMENT#',
    }
    const expNames: Record<string, string> = {}
    const filters: string[] = []

    const params: QueryCommandInput = {
      TableName: INVENTORY_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: expValues,
      ScanIndexForward: false,
    }

    if (productFilter) {
      filters.push('productId = :prodId')
      expValues[':prodId'] = productFilter
    }
    if (typeFilter) {
      filters.push('#t = :type')
      expNames['#t'] = 'type'
      expValues[':type'] = typeFilter.toUpperCase()
    }

    if (filters.length) {
      params.FilterExpression = filters.join(' AND ')
    }
    if (Object.keys(expNames).length) {
      params.ExpressionAttributeNames = expNames
    }

    const result = await docClient.send(new QueryCommand(params))

    const movements = (result.Items ?? []).map(item => ({
      movementId:    item.movementId,
      productId:     item.productId,
      productName:   item.productName,
      fromLocId:     item.fromLocId,
      toLocId:       item.toLocId,
      quantity:      item.quantity,
      type:          item.type,
      reason:        item.reason,
      createdBy:     item.createdBy,
      createdByName: item.createdByName,
      createdAt:     item.createdAt,
    }))

    return ok({ movements })
  } catch (err) {
    console.error('[movements/list] DynamoDB error:', err)
    return internalError()
  }
})
