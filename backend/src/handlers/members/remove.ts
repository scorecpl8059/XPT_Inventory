/**
 * DELETE /organizations/{orgId}/members/{memberId} — Remove a member.
 *
 * Owner-only. Atomically deletes the member's records on both sides:
 *   • ORGS_TABLE:  ORG#<orgId> / MEMBER#<memberId>
 *   • USERS_TABLE: USER#<memberId> / MEMBERSHIP#<orgId>
 *
 * The owner cannot remove themselves.
 */
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, USERS_TABLE, ORGS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { userId, orgId }) => {
  const memberId = event.pathParameters?.memberId
  if (!memberId) return badRequest('Missing memberId')

  if (memberId === userId) {
    return badRequest('Cannot remove yourself as owner')
  }

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: ORGS_TABLE,
            Key: { PK: `ORG#${orgId}`, SK: `MEMBER#${memberId}` },
          },
        },
        {
          Delete: {
            TableName: USERS_TABLE,
            Key: { PK: `USER#${memberId}`, SK: `MEMBERSHIP#${orgId}` },
          },
        },
      ],
    }))

    return ok({ message: 'Member removed' })
  } catch (err) {
    console.error('[members/remove] DynamoDB error:', err)
    return internalError()
  }
}, { requireRole: 'owner' })
