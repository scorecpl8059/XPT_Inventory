/**
 * Bootstrap handler — called on first login.
 *
 * Creates user profile if not exists, creates a default organization,
 * and accepts any pending invitations for the user's email.
 */
import { GetCommand, TransactWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ulid } from 'ulid'
import { withAuth } from '../../middleware/withAuth'
import { docClient, USERS_TABLE, ORGS_TABLE } from '../../shared/dynamo'
import { ok, internalError } from '../../shared/response'
import type { JwtPayload } from '../../shared/auth'
import jwt from 'jsonwebtoken'

export const handler = withAuth(async (event, userId) => {
  try {
    // Decode token to get email (already verified by withAuth)
    const authHeader = event.headers?.authorization ?? event.headers?.Authorization
    const token = authHeader!.slice(7)
    const decoded = jwt.decode(token) as JwtPayload & { email?: string; name?: string }
    const email = decoded?.email ?? ''
    const name  = decoded?.name ?? email.split('@')[0] ?? 'User'

    // Check if profile already exists
    const existing = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    }))

    if (existing.Item) {
      // Already bootstrapped — check for pending invitations and return
      const invitations = await acceptPendingInvitations(userId, email, name)
      return ok({ message: 'Already bootstrapped', newMemberships: invitations })
    }

    // Create profile + default org in a transaction
    const orgId = ulid()
    const now   = new Date().toISOString()

    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        // User profile
        {
          Put: {
            TableName: USERS_TABLE,
            Item: {
              PK: `USER#${userId}`,
              SK: 'PROFILE',
              name,
              email,
              isAdmin: false,
              createdAt: now,
              gsi1pk: `EMAIL#${email}`,
              gsi1sk: 'PROFILE',
            },
          },
        },
        // User membership
        {
          Put: {
            TableName: USERS_TABLE,
            Item: {
              PK: `USER#${userId}`,
              SK: `MEMBERSHIP#${orgId}`,
              orgId,
              orgName: `${name}'s Organization`,
              role: 'owner',
              joinedAt: now,
            },
          },
        },
        // Org metadata
        {
          Put: {
            TableName: ORGS_TABLE,
            Item: {
              PK: `ORG#${orgId}`,
              SK: 'META',
              orgId,
              name: `${name}'s Organization`,
              timezone: 'America/New_York',
              plan: 'free',
              createdAt: now,
            },
          },
        },
        // Org member
        {
          Put: {
            TableName: ORGS_TABLE,
            Item: {
              PK: `ORG#${orgId}`,
              SK: `MEMBER#${userId}`,
              userId,
              name,
              email,
              role: 'owner',
              joinedAt: now,
            },
          },
        },
      ],
    }))

    // Accept any pending invitations
    const invitations = await acceptPendingInvitations(userId, email, name)

    return ok({
      message: 'Bootstrapped',
      orgId,
      newMemberships: invitations,
    })
  } catch (err) {
    console.error('[bootstrap/seed] Error:', err)
    return internalError()
  }
})

async function acceptPendingInvitations(
  userId: string,
  email: string,
  name: string
): Promise<string[]> {
  if (!email) return []

  try {
    // Query GSI1 on orgs table for pending invitations by email
    const result = await docClient.send(new QueryCommand({
      TableName: ORGS_TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': `INVITE_EMAIL#${email.toLowerCase()}` },
    }))

    if (!result.Items?.length) return []

    const accepted: string[] = []
    const now = new Date().toISOString()

    for (const invite of result.Items) {
      const orgId = (invite.PK as string).replace('ORG#', '')
      const role  = invite.role as string

      try {
        await docClient.send(new TransactWriteCommand({
          TransactItems: [
            // Delete the invitation
            { Delete: { TableName: ORGS_TABLE, Key: { PK: invite.PK, SK: invite.SK } } },
            // Create membership in users table
            {
              Put: {
                TableName: USERS_TABLE,
                Item: {
                  PK: `USER#${userId}`,
                  SK: `MEMBERSHIP#${orgId}`,
                  orgId,
                  orgName: invite.orgName ?? orgId,
                  role,
                  joinedAt: now,
                },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            // Create member in orgs table
            {
              Put: {
                TableName: ORGS_TABLE,
                Item: {
                  PK: `ORG#${orgId}`,
                  SK: `MEMBER#${userId}`,
                  userId,
                  name,
                  email,
                  role,
                  joinedAt: now,
                },
              },
            },
          ],
        }))
        accepted.push(orgId)
      } catch {
        // Skip if already a member (condition check failure)
      }
    }

    return accepted
  } catch (err) {
    console.error('[bootstrap] Failed to accept pending invitations:', err)
    return []
  }
}
