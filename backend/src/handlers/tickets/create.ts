/**
 * POST /organizations/{orgId}/tickets — Create a support ticket.
 *
 * Any org member can create. PK is TICKET#<ulid> (not ORG#) so admins
 * can query tickets across all orgs.
 */
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { ulid } from 'ulid'
import { z } from 'zod'
import { docClient, USERS_TABLE, ORGS_TABLE, TICKETS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, internalError } from '../../shared/response'

const schema = z.object({
  subject:     z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
})

export const handler = withOrgAuth(async (event, { userId, orgId }) => {
  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const { subject, description, priority } = parsed.data
  const ticketId = ulid()
  const now = new Date().toISOString()

  // Get creator name and org name for denormalization
  const [profile, org] = await Promise.all([
    docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      ProjectionExpression: '#n',
      ExpressionAttributeNames: { '#n': 'name' },
    })),
    docClient.send(new GetCommand({
      TableName: ORGS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: 'META' },
      ProjectionExpression: '#n',
      ExpressionAttributeNames: { '#n': 'name' },
    })),
  ])
  const createdByName = (profile.Item?.name as string) ?? ''
  const orgName       = (org.Item?.name as string) ?? ''

  try {
    await docClient.send(new PutCommand({
      TableName: TICKETS_TABLE,
      Item: {
        PK: `TICKET#${ticketId}`,
        SK: 'META',
        ticketId, orgId, orgName,
        subject, description,
        status: 'OPEN',
        priority,
        createdBy: userId,
        createdByName,
        createdAt: now,
        updatedAt: now,
        // GSI1: list tickets by org
        gsi1pk: `ORG#${orgId}`,
        gsi1sk: `TICKET#${ticketId}`,
        // GSI2: admin list by status
        gsi2pk: `STATUS#OPEN`,
        gsi2sk: `TICKET#${ticketId}`,
      },
    }))
  } catch (err) {
    console.error('[tickets/create] DynamoDB error:', err)
    return internalError()
  }

  return ok({ ticketId, subject, status: 'OPEN', priority, createdAt: now })
})
