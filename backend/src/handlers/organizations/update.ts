/**
 * PATCH /organizations/{orgId} — Update organization metadata.
 *
 * Owner-only. Allows updating name and timezone.
 * When name changes, propagates orgName to all MEMBERSHIP# records in users table.
 */
import { UpdateCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'
import { docClient, USERS_TABLE, ORGS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, internalError } from '../../shared/response'

const schema = z.object({
  name:     z.string().min(1).max(255).optional(),
  timezone: z.string().max(100).optional(),
}).refine(data => data.name || data.timezone, {
  message: 'At least one field (name or timezone) is required',
})

export const handler = withOrgAuth(async (event, { orgId }) => {
  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const { name, timezone } = parsed.data
  const now = new Date().toISOString()

  const expNames: Record<string, string> = {}
  const expValues: Record<string, unknown> = { ':now': now }
  const setClauses = ['updatedAt = :now']

  if (name) {
    setClauses.push('#n = :name')
    expNames['#n'] = 'name'
    expValues[':name'] = name
  }
  if (timezone) {
    setClauses.push('#tz = :tz')
    expNames['#tz'] = 'timezone'
    expValues[':tz'] = timezone
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: ORGS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: 'META' },
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeValues: expValues,
      ...(Object.keys(expNames).length > 0 && { ExpressionAttributeNames: expNames }),
    }))
  } catch (err) {
    console.error('[organizations/update] UpdateCommand error:', err)
    return internalError()
  }

  // Propagate orgName to all MEMBERSHIP# records in users table
  if (name) {
    try {
      const members = await docClient.send(new QueryCommand({
        TableName: ORGS_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': `ORG#${orgId}`, ':prefix': 'MEMBER#' },
        ProjectionExpression: 'userId',
      }))

      if (members.Items?.length) {
        await docClient.send(new TransactWriteCommand({
          TransactItems: members.Items.map(m => ({
            Update: {
              TableName: USERS_TABLE,
              Key: { PK: `USER#${m.userId}`, SK: `MEMBERSHIP#${orgId}` },
              UpdateExpression: 'SET orgName = :name',
              ExpressionAttributeValues: { ':name': name },
            },
          })),
        }))
      }
    } catch (err) {
      console.error('[organizations/update] Membership propagation error:', err)
      return internalError()
    }
  }

  return ok({ message: 'Organization updated' })
}, { requireRole: 'owner' })
