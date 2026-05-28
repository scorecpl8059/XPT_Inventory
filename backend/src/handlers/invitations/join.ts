/**
 * POST /invitations/join — Join an organization by entering a join code.
 *
 * Looks up JOINCODE#<code>/META in the orgs table → validates status=PENDING →
 * atomically:
 *   • Updates JOINCODE# status → ACCEPTED
 *   • Deletes INVITE# record (cleanup)
 *   • Creates ORG#<orgId>/MEMBER#<sub>       (org side, in ORGS_TABLE)
 *   • Creates USER#<sub>/MEMBERSHIP#<orgId>  (user side, in USERS_TABLE)
 *
 * Uses withAuth (not withOrgAuth) — caller may not yet be a member.
 */
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'
import { docClient, USERS_TABLE, ORGS_TABLE } from '../../shared/dynamo'
import { withAuth } from '../../middleware/withAuth'
import { verifyJwt } from '../../shared/auth'
import { ok, badRequest, notFound, conflict, internalError } from '../../shared/response'

const schema = z.object({
  joinCode: z.string().length(6).regex(/^[A-Z0-9]+$/, 'Join code must be 6 uppercase alphanumeric characters'),
})

export const handler = withAuth(async (event, userId) => {
  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  // Normalize to uppercase before validation
  if (body && typeof body === 'object' && 'joinCode' in body) {
    (body as Record<string, unknown>).joinCode =
      String((body as Record<string, unknown>).joinCode).toUpperCase()
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const { joinCode } = parsed.data

  try {
    // Look up the join code in orgs table
    const lookup = await docClient.send(new GetCommand({
      TableName: ORGS_TABLE,
      Key: { PK: `JOINCODE#${joinCode}`, SK: 'META' },
    }))

    if (!lookup.Item) return notFound('Invalid join code')
    if (lookup.Item.status !== 'PENDING') return conflict('This join code has already been used')

    const { orgId, orgName, inviteId, role } = lookup.Item as {
      orgId: string; orgName: string; inviteId: string; role: string
    }

    // Check caller is not already a member
    const existing = await docClient.send(new GetCommand({
      TableName: ORGS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `MEMBER#${userId}` },
    }))
    if (existing.Item) return conflict('You are already a member of this organization')

    // Get caller's profile for denormalized fields
    const profile = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      ProjectionExpression: '#n, email',
      ExpressionAttributeNames: { '#n': 'name' },
    }))
    const userName  = (profile.Item?.name as string) ?? ''
    const userEmail = (profile.Item?.email as string) ?? ''

    const now         = new Date().toISOString()
    const assignRole  = role ?? 'staff'

    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        // Mark JOINCODE as used
        {
          Update: {
            TableName: ORGS_TABLE,
            Key: { PK: `JOINCODE#${joinCode}`, SK: 'META' },
            UpdateExpression: 'SET #s = :accepted, acceptedAt = :now, acceptedBy = :uid',
            ConditionExpression: '#s = :pending',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: {
              ':accepted': 'ACCEPTED', ':now': now, ':uid': userId, ':pending': 'PENDING',
            },
          },
        },
        // Add member to org (ORGS_TABLE)
        {
          Put: {
            TableName: ORGS_TABLE,
            Item: {
              PK: `ORG#${orgId}`, SK: `MEMBER#${userId}`,
              userId, name: userName, email: userEmail,
              role: assignRole, joinedAt: now,
            },
          },
        },
        // Add membership to user (USERS_TABLE)
        {
          Put: {
            TableName: USERS_TABLE,
            Item: {
              PK: `USER#${userId}`, SK: `MEMBERSHIP#${orgId}`,
              orgId, orgName,
              role: assignRole, joinedAt: now,
            },
          },
        },
      ],
    }))

    return ok({ orgId, orgName, role: assignRole })
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.name === 'TransactionCanceledException' &&
      err.message.includes('ConditionalCheckFailed')
    ) {
      return conflict('This join code has already been used')
    }
    console.error('[invitations/join] DynamoDB error:', err)
    return internalError()
  }
})
