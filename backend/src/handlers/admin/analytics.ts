/**
 * GET /admin/analytics — Platform-wide analytics.
 *
 * System admin only. Returns aggregate counts.
 * Note: In production, consider caching these counts.
 */
import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, ORGS_TABLE, USERS_TABLE, TICKETS_TABLE } from '../../shared/dynamo'
import { withAdminAuth } from '../../middleware/withAdminAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withAdminAuth(async () => {
  try {
    const [orgs, users, tickets] = await Promise.all([
      docClient.send(new ScanCommand({
        TableName: ORGS_TABLE,
        FilterExpression: 'SK = :meta',
        ExpressionAttributeValues: { ':meta': 'META' },
        Select: 'COUNT',
      })),
      docClient.send(new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: 'SK = :profile',
        ExpressionAttributeValues: { ':profile': 'PROFILE' },
        Select: 'COUNT',
      })),
      docClient.send(new ScanCommand({
        TableName: TICKETS_TABLE,
        FilterExpression: 'SK = :meta',
        ExpressionAttributeValues: { ':meta': 'META' },
        Select: 'COUNT',
      })),
    ])

    // Count open tickets specifically
    const openTickets = await docClient.send(new ScanCommand({
      TableName: TICKETS_TABLE,
      FilterExpression: 'SK = :meta AND #s = :open',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':meta': 'META', ':open': 'OPEN' },
      Select: 'COUNT',
    }))

    return ok({
      totalOrganizations: orgs.Count ?? 0,
      totalUsers:         users.Count ?? 0,
      totalTickets:       tickets.Count ?? 0,
      openTickets:        openTickets.Count ?? 0,
    })
  } catch (err) {
    console.error('[admin/analytics] DynamoDB error:', err)
    return internalError()
  }
})
