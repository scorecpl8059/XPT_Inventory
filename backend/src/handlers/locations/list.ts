/**
 * GET /organizations/{orgId}/locations — List all locations.
 */
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, INVENTORY_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (_event, { orgId }) => {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: INVENTORY_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk':     `ORG#${orgId}`,
        ':prefix': 'LOC#',
      },
    }))

    const locations = (result.Items ?? []).map(item => ({
      locationId: item.locationId,
      name:       item.name,
      address:    item.address,
      isDefault:  item.isDefault,
      createdAt:  item.createdAt,
    }))

    return ok({ locations })
  } catch (err) {
    console.error('[locations/list] DynamoDB error:', err)
    return internalError()
  }
})
