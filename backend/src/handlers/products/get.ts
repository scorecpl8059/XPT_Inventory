/**
 * GET /organizations/{orgId}/products/{id} — Get product details with variants.
 */
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, PRODUCTS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { orgId }) => {
  const productId = event.pathParameters?.id
  if (!productId) return badRequest('Missing product ID')

  try {
    const result = await docClient.send(new GetCommand({
      TableName: PRODUCTS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `PROD#${productId}` },
    }))

    if (!result.Item) return notFound('Product not found')

    const { PK, SK, gsi1pk, gsi1sk, ...product } = result.Item

    // Fetch variants
    const variantResult = await docClient.send(new QueryCommand({
      TableName: PRODUCTS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk':     `ORG#${orgId}`,
        ':prefix': `VARIANT#${productId}#`,
      },
    }))

    const variants = (variantResult.Items ?? []).map(item => ({
      variantId:   item.variantId,
      variantName: item.variantName,
      attributes:  item.attributes,
      price:       item.price,
      cost:        item.cost,
      weight:      item.weight,
      sku:         item.sku,
    }))

    return ok({ ...product, variants })
  } catch (err) {
    console.error('[products/get] DynamoDB error:', err)
    return internalError()
  }
})
