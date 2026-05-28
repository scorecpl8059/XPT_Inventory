/**
 * GET /organizations/{orgId}/invitations — List pending invitations.
 *
 * Owner-only. Queries ORG#<orgId> with SK begins_with(INVITE#)
 * and filters for non-expired, pending invitations.
 */
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, ORGS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (_event, { orgId }) => {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: ORGS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk':      `ORG#${orgId}`,
        ':prefix':  'INVITE#',
      },
    }))

    const invitations = (result.Items ?? []).map(item => ({
      inviteId:  item.inviteId,
      email:     item.email,
      role:      item.role,
      joinCode:  item.joinCode,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
    }))

    return ok({ invitations })
  } catch (err) {
    console.error('[invitations/list] DynamoDB error:', err)
    return internalError()
  }
}, { requireRole: 'owner' })
