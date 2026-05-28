/**
 * POST /tickets/{id}/messages — Add a message to a ticket thread.
 */
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { ulid } from 'ulid'
import { z } from 'zod'
import { docClient, USERS_TABLE, TICKETS_TABLE } from '../../shared/dynamo'
import { withAuth } from '../../middleware/withAuth'
import { ok, badRequest, notFound, forbidden, internalError } from '../../shared/response'

const schema = z.object({
  body: z.string().min(1).max(5000),
})

export const handler = withAuth(async (event, userId) => {
  const ticketId = event.pathParameters?.id
  if (!ticketId) return badRequest('Missing ticket ID')

  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  // Fetch ticket to check access and get orgId
  const ticket = await docClient.send(new GetCommand({
    TableName: TICKETS_TABLE,
    Key: { PK: `TICKET#${ticketId}`, SK: 'META' },
    ProjectionExpression: 'orgId',
  }))
  if (!ticket.Item) return notFound('Ticket not found')

  const orgId = ticket.Item.orgId as string

  // Check access
  const [membership, profile] = await Promise.all([
    docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: `MEMBERSHIP#${orgId}` },
      ProjectionExpression: '#r',
      ExpressionAttributeNames: { '#r': 'role' },
    })),
    docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      ProjectionExpression: '#n, isAdmin',
      ExpressionAttributeNames: { '#n': 'name' },
    })),
  ])

  if (!membership.Item && !profile.Item?.isAdmin) return forbidden('Access denied')

  const authorName = (profile.Item?.name as string) ?? ''
  const authorRole = profile.Item?.isAdmin ? 'admin' : (membership.Item?.role as string) ?? 'staff'
  const messageId  = ulid()
  const now        = new Date().toISOString()

  try {
    await docClient.send(new PutCommand({
      TableName: TICKETS_TABLE,
      Item: {
        PK: `TICKET#${ticketId}`,
        SK: `MSG#${messageId}`,
        messageId,
        body: parsed.data.body,
        authorId: userId,
        authorName,
        authorRole,
        createdAt: now,
      },
    }))
  } catch (err) {
    console.error('[tickets/addMessage] DynamoDB error:', err)
    return internalError()
  }

  return ok({ messageId, authorName, authorRole, createdAt: now })
})
