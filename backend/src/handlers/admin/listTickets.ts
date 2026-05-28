/**
 * GET /admin/tickets — List all tickets across organizations.
 *
 * System admin only. Uses GSI2 to query by status.
 * Supports ?status= filter (defaults to OPEN).
 */
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TICKETS_TABLE } from '../../shared/dynamo'
import { withAdminAuth } from '../../middleware/withAdminAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withAdminAuth(async (event) => {
  const status = event.queryStringParameters?.status?.toUpperCase() ?? 'OPEN'

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TICKETS_TABLE,
      IndexName: 'GSI2',
      KeyConditionExpression: 'gsi2pk = :pk',
      ExpressionAttributeValues: { ':pk': `STATUS#${status}` },
      ScanIndexForward: false,
    }))

    const tickets = (result.Items ?? []).map(item => ({
      ticketId:      item.ticketId,
      orgId:         item.orgId,
      orgName:       item.orgName,
      subject:       item.subject,
      status:        item.status,
      priority:      item.priority,
      createdByName: item.createdByName,
      createdAt:     item.createdAt,
      updatedAt:     item.updatedAt,
    }))

    return ok({ tickets })
  } catch (err) {
    console.error('[admin/listTickets] DynamoDB error:', err)
    return internalError()
  }
})
