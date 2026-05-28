/**
 * GET /admin/organizations — List all organizations.
 *
 * System admin only. Scans the orgs table for META records.
 * Note: In production, this should be paginated for large datasets.
 */
import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, ORGS_TABLE } from '../../shared/dynamo'
import { withAdminAuth } from '../../middleware/withAdminAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withAdminAuth(async () => {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: ORGS_TABLE,
      FilterExpression: 'SK = :meta',
      ExpressionAttributeValues: { ':meta': 'META' },
      ProjectionExpression: 'orgId, #n, #p, createdAt',
      ExpressionAttributeNames: { '#n': 'name', '#p': 'plan' },
    }))

    const organizations = (result.Items ?? []).map(item => ({
      orgId:     item.orgId,
      name:      item.name,
      plan:      item.plan,
      createdAt: item.createdAt,
    }))

    return ok({ organizations })
  } catch (err) {
    console.error('[admin/listOrganizations] DynamoDB error:', err)
    return internalError()
  }
})
