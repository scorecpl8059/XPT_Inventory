/**
 * POST /organizations/{orgId}/invitations — Invite a new member by email.
 *
 * Owner-only. Creates an INVITE record under ORG#<orgId> in the orgs table
 * and a JOINCODE# lookup item so the invitee can join by code.
 *
 * GSI1 projection (gsi1pk = INVITE_EMAIL#<email>) enables email-based auto-accept
 * during bootstrap.
 *
 * Sends an invitation email via SES with join code and link.
 */
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { ulid } from 'ulid'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { docClient, ORGS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, internalError } from '../../shared/response'
import { sendInvitationEmail } from '../../shared/email'

const schema = z.object({
  email: z.string().email().max(255),
  role:  z.enum(['manager', 'staff']).default('staff'),
})

const JOIN_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateJoinCode(): string {
  const bytes = randomBytes(6)
  return Array.from(bytes).map(b => JOIN_CODE_ALPHABET[b % 36]).join('')
}

export const handler = withOrgAuth(async (event, { orgId }) => {
  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const { email, role } = parsed.data
  const normalizedEmail = email.toLowerCase()
  const inviteId = ulid()
  const now      = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  // Fetch org name for the invitation email
  const org = await docClient.send(new GetCommand({
    TableName: ORGS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: 'META' },
    ProjectionExpression: '#n',
    ExpressionAttributeNames: { '#n': 'name' },
  }))
  const orgName = (org.Item?.name as string) ?? 'Unknown Organization'

  // Retry up to 3 times for join code collisions
  for (let attempt = 0; attempt < 3; attempt++) {
    const joinCode = generateJoinCode()

    try {
      await docClient.send(new TransactWriteCommand({
        TransactItems: [
          // INVITE record with GSI1 for email-based lookup
          {
            Put: {
              TableName: ORGS_TABLE,
              Item: {
                PK:        `ORG#${orgId}`,
                SK:        `INVITE#${inviteId}`,
                inviteId,
                email:     normalizedEmail,
                role,
                joinCode,
                expiresAt,
                createdAt: now,
                gsi1pk:    `INVITE_EMAIL#${normalizedEmail}`,
                gsi1sk:    `INVITE#${inviteId}`,
              },
            },
          },
          // JOINCODE lookup item for manual join-by-code
          {
            Put: {
              TableName:           ORGS_TABLE,
              ConditionExpression: 'attribute_not_exists(PK)',
              Item: {
                PK:        `JOINCODE#${joinCode}`,
                SK:        'META',
                joinCode,
                orgId,
                orgName,
                inviteId,
                email:     normalizedEmail,
                role,
                status:    'PENDING',
                createdAt: now,
              },
            },
          },
        ],
      }))

      // Send invitation email (non-blocking)
      const frontendUrl = process.env.FRONTEND_URL ?? 'https://inv.xpt-tech.com'
      try {
        await sendInvitationEmail({
          to:       normalizedEmail,
          orgName,
          joinCode,
          joinUrl:  frontendUrl,
        })
      } catch (emailErr) {
        console.error('[invitations/create] SES email failed (invitation still created):', emailErr)
      }

      return ok({ inviteId, email: normalizedEmail, role, status: 'PENDING', joinCode, createdAt: now })
    } catch (err: unknown) {
      const isCollision =
        err instanceof Error &&
        err.name === 'TransactionCanceledException' &&
        err.message.includes('ConditionalCheckFailed')

      if (isCollision && attempt < 2) continue
      console.error('[invitations/create] DynamoDB error:', err)
      return internalError()
    }
  }

  return internalError()
}, { requireRole: 'owner' })
