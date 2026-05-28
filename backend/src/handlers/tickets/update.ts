/**
 * PATCH /tickets/{id} — Update ticket status/priority.
 *
 * Uses withAuth — verifies the caller is a member of the ticket's org or admin.
 */
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'
import { docClient, USERS_TABLE, TICKETS_TABLE } from '../../shared/dynamo'
import { withAuth } from '../../middleware/withAuth'
import { ok, badRequest, notFound, forbidden, internalError } from '../../shared/response'

const schema = z.object({
  status:   z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
}).refine(data => data.status || data.priority, {
  message: 'At least one field (status or priority) is required',
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

  // Fetch ticket to check access
  const existing = await docClient.send(new GetCommand({
    TableName: TICKETS_TABLE,
    Key: { PK: `TICKET#${ticketId}`, SK: 'META' },
    ProjectionExpression: 'orgId, #s',
    ExpressionAttributeNames: { '#s': 'status' },
  }))
  if (!existing.Item) return notFound('Ticket not found')

  const orgId = existing.Item.orgId as string

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
      ProjectionExpression: 'isAdmin',
    })),
  ])

  if (!membership.Item && !profile.Item?.isAdmin) return forbidden('Access denied')

  const data = parsed.data
  const now = new Date().toISOString()
  const expNames: Record<string, string> = {}
  const expValues: Record<string, unknown> = { ':now': now }
  const setClauses = ['updatedAt = :now']

  if (data.status) {
    setClauses.push('#s = :status, gsi2pk = :gsi2pk')
    expNames['#s'] = 'status'
    expValues[':status'] = data.status
    expValues[':gsi2pk'] = `STATUS#${data.status}`
  }
  if (data.priority) {
    setClauses.push('priority = :priority')
    expValues[':priority'] = data.priority
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { PK: `TICKET#${ticketId}`, SK: 'META' },
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeValues: expValues,
      ...(Object.keys(expNames).length > 0 && { ExpressionAttributeNames: expNames }),
    }))
  } catch (err) {
    console.error('[tickets/update] DynamoDB error:', err)
    return internalError()
  }

  return ok({ message: 'Ticket updated' })
})
