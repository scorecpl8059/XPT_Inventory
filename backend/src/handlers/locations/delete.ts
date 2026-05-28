/**
 * DELETE /organizations/{orgId}/locations/{id} — Delete a location.
 *
 * Manager+ only. Only deletes if no stock records exist for this location.
 */
import { GetCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, INVENTORY_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, conflict, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { orgId }) => {
  const locationId = event.pathParameters?.id
  if (!locationId) return badRequest('Missing location ID')

  const existing = await docClient.send(new GetCommand({
    TableName: INVENTORY_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `LOC#${locationId}` },
    ProjectionExpression: 'locationId',
  }))
  if (!existing.Item) return notFound('Location not found')

  // Check for existing stock at this location
  const stockCheck = await docClient.send(new QueryCommand({
    TableName: INVENTORY_TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk':     `ORG#${orgId}`,
      ':prefix': 'STOCK#',
    },
    FilterExpression: 'contains(SK, :locId)',
    Limit: 1,
  }))

  // More precise check: SK pattern is STOCK#<prodId>#<locId>
  const hasStock = (stockCheck.Items ?? []).some(item =>
    (item.SK as string).endsWith(`#${locationId}`)
  )
  if (hasStock) return conflict('Cannot delete location with existing stock. Move or adjust stock first.')

  try {
    await docClient.send(new DeleteCommand({
      TableName: INVENTORY_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `LOC#${locationId}` },
    }))
  } catch (err) {
    console.error('[locations/delete] DynamoDB error:', err)
    return internalError()
  }

  return ok({ message: 'Location deleted' })
}, { requireRole: 'manager' })
