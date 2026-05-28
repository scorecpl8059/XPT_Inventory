/**
 * GET /organizations/{orgId}/tickets — List tickets for an organization.
 *
 * Uses GSI1 (gsi1pk = ORG#<orgId>) to list all tickets for the org.
 */
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TICKETS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (_event, { orgId }) => {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TICKETS_TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': `ORG#${orgId}` },
      ScanIndexForward: false,
    }))

    const tickets = (result.Items ?? []).map(item => ({
      ticketId:      item.ticketId,
      subject:       item.subject,
      status:        item.status,
      priority:      item.priority,
      createdByName: item.createdByName,
      createdAt:     item.createdAt,
      updatedAt:     item.updatedAt,
    }))

    return ok({ tickets })
  } catch (err) {
    console.error('[tickets/list] DynamoDB error:', err)
    return internalError()
  }
})
