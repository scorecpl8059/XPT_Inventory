/**
 * POST /organizations — Create a new organization.
 *
 * The caller becomes the owner. Atomically creates across two tables:
 *   • USERS_TABLE: USER#<sub> / MEMBERSHIP#<orgId>  — user-side membership
 *   • ORGS_TABLE:  ORG#<orgId> / META               — org metadata
 *   • ORGS_TABLE:  ORG#<orgId> / MEMBER#<sub>       — org-side membership
 *
 * Uses withAuth (not withOrgAuth) because the org doesn't exist yet.
 */
import { TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { ulid } from 'ulid'
import { z } from 'zod'
import { docClient, USERS_TABLE, ORGS_TABLE } from '../../shared/dynamo'
import { withAuth } from '../../middleware/withAuth'
import { ok, badRequest, internalError } from '../../shared/response'

const schema = z.object({
  name:     z.string().min(1).max(255),
  timezone: z.string().max(100).optional(),
})

export const handler = withAuth(async (event, userId) => {
  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const { name, timezone } = parsed.data
  const orgId = ulid()
  const now   = new Date().toISOString()

  // Fetch caller's profile for denormalized name/email on the MEMBER record
  const profile = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    ProjectionExpression: '#n, email',
    ExpressionAttributeNames: { '#n': 'name' },
  }))
  const userName  = (profile.Item?.name as string) ?? ''
  const userEmail = (profile.Item?.email as string) ?? ''

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        // Org metadata
        {
          Put: {
            TableName: ORGS_TABLE,
            Item: {
              PK: `ORG#${orgId}`, SK: 'META',
              orgId, name,
              timezone: timezone ?? 'America/Chicago',
              plan: 'free',
              createdAt: now, updatedAt: now,
            },
          },
        },
        // Org-side member record
        {
          Put: {
            TableName: ORGS_TABLE,
            Item: {
              PK: `ORG#${orgId}`, SK: `MEMBER#${userId}`,
              userId, name: userName, email: userEmail,
              role: 'owner', joinedAt: now,
            },
          },
        },
        // User-side membership record
        {
          Put: {
            TableName: USERS_TABLE,
            Item: {
              PK: `USER#${userId}`, SK: `MEMBERSHIP#${orgId}`,
              orgId, orgName: name,
              role: 'owner', joinedAt: now,
            },
          },
        },
      ],
    }))
  } catch (err) {
    console.error('[organizations/create] DynamoDB error:', err)
    return internalError()
  }

  return ok({ orgId, name, role: 'owner', createdAt: now })
})
