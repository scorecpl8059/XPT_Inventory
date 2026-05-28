/**
 * GET /tickets/{id}/messages — List messages in a ticket thread.
 */
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, USERS_TABLE, TICKETS_TABLE } from '../../shared/dynamo'
import { withAuth } from '../../middleware/withAuth'
import { ok, badRequest, notFound, forbidden, internalError } from '../../shared/response'

export const handler = withAuth(async (event, userId) => {
  const ticketId = event.pathParameters?.id
  if (!ticketId) return badRequest('Missing ticket ID')

  // Verify ticket exists and check access
  const ticket = await docClient.send(new GetCommand({
    TableName: TICKETS_TABLE,
    Key: { PK: `TICKET#${ticketId}`, SK: 'META' },
    ProjectionExpression: 'orgId',
  }))
  if (!ticket.Item) return notFound('Ticket not found')

  const orgId = ticket.Item.orgId as string

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

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TICKETS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk':     `TICKET#${ticketId}`,
        ':prefix': 'MSG#',
      },
    }))

    const messages = (result.Items ?? []).map(item => ({
      messageId:  item.messageId,
      body:       item.body,
      authorId:   item.authorId,
      authorName: item.authorName,
      authorRole: item.authorRole,
      createdAt:  item.createdAt,
    }))

    return ok({ messages })
  } catch (err) {
    console.error('[tickets/listMessages] DynamoDB error:', err)
    return internalError()
  }
})
