/**
 * POST /organizations/{orgId}/movements — Record a stock movement.
 *
 * Any member can record movements. Atomically:
 *   1. Creates the MOVEMENT record
 *   2. Updates (or creates) STOCK levels at affected locations
 *
 * Movement types:
 *   RECEIPT    — stock in at toLocId (+qty)
 *   SHIPMENT   — stock out from fromLocId (-qty)
 *   TRANSFER   — fromLocId (-qty) → toLocId (+qty)
 *   ADJUSTMENT — adjust stock at toLocId (can be +/-)
 *   RETURN     — stock in at toLocId (+qty)
 */
import { TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { ulid } from 'ulid'
import { z } from 'zod'
import { docClient, USERS_TABLE, PRODUCTS_TABLE, INVENTORY_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, internalError } from '../../shared/response'

const schema = z.object({
  productId: z.string().min(1),
  type:      z.enum(['RECEIPT', 'SHIPMENT', 'TRANSFER', 'ADJUSTMENT', 'RETURN']),
  quantity:  z.number().int().positive(),
  fromLocId: z.string().optional(),
  toLocId:   z.string().optional(),
  reason:    z.string().max(500).optional(),
}).refine(data => {
  if (data.type === 'TRANSFER') return data.fromLocId && data.toLocId
  if (data.type === 'SHIPMENT') return !!data.fromLocId
  if (['RECEIPT', 'RETURN', 'ADJUSTMENT'].includes(data.type)) return !!data.toLocId
  return true
}, { message: 'Missing required location for this movement type' })

export const handler = withOrgAuth(async (event, { userId, orgId }) => {
  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const { productId, type, quantity, fromLocId, toLocId, reason } = parsed.data

  // Get product name for denormalization
  const product = await docClient.send(new GetCommand({
    TableName: PRODUCTS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `PROD#${productId}` },
    ProjectionExpression: '#n',
    ExpressionAttributeNames: { '#n': 'name' },
  }))
  if (!product.Item) return badRequest('Product not found')
  const productName = product.Item.name as string

  // Get user's name
  const profile = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    ProjectionExpression: '#n',
    ExpressionAttributeNames: { '#n': 'name' },
  }))
  const createdByName = (profile.Item?.name as string) ?? ''

  const movementId = ulid()
  const now = new Date().toISOString()
  const datePrefix = now.slice(0, 10) // YYYY-MM-DD

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [
    // Movement record
    {
      Put: {
        TableName: INVENTORY_TABLE,
        Item: {
          PK: `ORG#${orgId}`,
          SK: `MOVEMENT#${datePrefix}#${movementId}`,
          movementId, productId, productName,
          fromLocId, toLocId,
          quantity, type, reason,
          createdBy: userId, createdByName,
          createdAt: now,
        },
      },
    },
  ]

  // Update stock at source location (decrease)
  if (fromLocId) {
    items.push({
      Update: {
        TableName: INVENTORY_TABLE,
        Key: { PK: `ORG#${orgId}`, SK: `STOCK#${productId}#${fromLocId}` },
        UpdateExpression: 'SET quantity = if_not_exists(quantity, :zero) - :qty, productId = :pid, locationId = :lid, lastUpdated = :now',
        ExpressionAttributeValues: {
          ':qty': quantity, ':zero': 0, ':pid': productId, ':lid': fromLocId, ':now': now,
        },
      },
    })
  }

  // Update stock at destination location (increase)
  if (toLocId) {
    items.push({
      Update: {
        TableName: INVENTORY_TABLE,
        Key: { PK: `ORG#${orgId}`, SK: `STOCK#${productId}#${toLocId}` },
        UpdateExpression: 'SET quantity = if_not_exists(quantity, :zero) + :qty, productId = :pid, locationId = :lid, reorderPoint = if_not_exists(reorderPoint, :defReorder), reorderQty = if_not_exists(reorderQty, :defReorderQty), lastUpdated = :now',
        ExpressionAttributeValues: {
          ':qty': quantity, ':zero': 0, ':pid': productId, ':lid': toLocId, ':now': now,
          ':defReorder': 0, ':defReorderQty': 0,
        },
      },
    })
  }

  try {
    await docClient.send(new TransactWriteCommand({ TransactItems: items }))
  } catch (err) {
    console.error('[movements/create] DynamoDB error:', err)
    return internalError()
  }

  return ok({ movementId, type, quantity, productName, createdAt: now })
})
