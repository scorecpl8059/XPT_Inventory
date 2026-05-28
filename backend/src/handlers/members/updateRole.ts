/**
 * PATCH /organizations/{orgId}/members/{memberId} — Update a member's role.
 *
 * Owner-only. Updates role on both sides:
 *   • ORGS_TABLE:  ORG#<orgId> / MEMBER#<memberId>
 *   • USERS_TABLE: USER#<memberId> / MEMBERSHIP#<orgId>
 *
 * Cannot change own role. Cannot promote to owner.
 */
import { TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'
import { docClient, USERS_TABLE, ORGS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, internalError } from '../../shared/response'

const schema = z.object({
  role: z.enum(['manager', 'staff']),
})

export const handler = withOrgAuth(async (event, { userId, orgId }) => {
  const memberId = event.pathParameters?.memberId
  if (!memberId) return badRequest('Missing memberId')

  if (memberId === userId) return badRequest('Cannot change your own role')

  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const { role } = parsed.data

  // Verify the target member exists
  const existing = await docClient.send(new GetCommand({
    TableName: ORGS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `MEMBER#${memberId}` },
    ProjectionExpression: '#r',
    ExpressionAttributeNames: { '#r': 'role' },
  }))

  if (!existing.Item) return notFound('Member not found')
  if (existing.Item.role === 'owner') return badRequest('Cannot change the owner\'s role')

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: ORGS_TABLE,
            Key: { PK: `ORG#${orgId}`, SK: `MEMBER#${memberId}` },
            UpdateExpression: 'SET #r = :role',
            ExpressionAttributeNames: { '#r': 'role' },
            ExpressionAttributeValues: { ':role': role },
          },
        },
        {
          Update: {
            TableName: USERS_TABLE,
            Key: { PK: `USER#${memberId}`, SK: `MEMBERSHIP#${orgId}` },
            UpdateExpression: 'SET #r = :role',
            ExpressionAttributeNames: { '#r': 'role' },
            ExpressionAttributeValues: { ':role': role },
          },
        },
      ],
    }))
  } catch (err) {
    console.error('[members/updateRole] DynamoDB error:', err)
    return internalError()
  }

  return ok({ message: 'Role updated', memberId, role })
}, { requireRole: 'owner' })
