/**
 * GET /organizations/{orgId}/products — List products.
 *
 * Any member can view. Supports optional ?status= and ?category= filters.
 */
import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb'
import { docClient, PRODUCTS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { orgId }) => {
  const statusFilter   = event.queryStringParameters?.status
  const categoryFilter = event.queryStringParameters?.category

  try {
    const expValues: Record<string, string> = {
      ':pk':     `ORG#${orgId}`,
      ':prefix': 'PROD#',
    }
    const expNames: Record<string, string> = {}
    const filters: string[] = []

    const params: QueryCommandInput = {
      TableName: PRODUCTS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: expValues,
      ScanIndexForward: false,
    }

    if (statusFilter) {
      filters.push('#s = :status')
      expNames['#s'] = 'status'
      expValues[':status'] = statusFilter.toUpperCase()
    }
    if (categoryFilter) {
      filters.push('category = :cat')
      expValues[':cat'] = categoryFilter
    }

    if (filters.length) {
      params.FilterExpression = filters.join(' AND ')
    }
    if (Object.keys(expNames).length) {
      params.ExpressionAttributeNames = expNames
    }

    const result = await docClient.send(new QueryCommand(params))

    const products = (result.Items ?? []).map(item => ({
      productId:  item.productId,
      name:       item.name,
      sku:        item.sku,
      category:   item.category,
      status:     item.status,
      unitPrice:  item.unitPrice,
      cost:       item.cost,
      createdAt:  item.createdAt,
    }))

    return ok({ products })
  } catch (err) {
    console.error('[products/list] DynamoDB error:', err)
    return internalError()
  }
})
