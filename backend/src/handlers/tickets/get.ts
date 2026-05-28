/**
 * GET /tickets/{id} — Get ticket details.
 *
 * Uses withAuth (not withOrgAuth) — verifies the caller is a member of the
 * ticket's org or is a system admin.
 */
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, USERS_TABLE, TICKETS_TABLE } from '../../shared/dynamo'
import { withAuth } from '../../middleware/withAuth'
import { ok, badRequest, notFound, forbidden, internalError } from '../../shared/response'

export const handler = withAuth(async (event, userId) => {
  const ticketId = event.pathParameters?.id
  if (!ticketId) return badRequest('Missing ticket ID')

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TICKETS_TABLE,
      Key: { PK: `TICKET#${ticketId}`, SK: 'META' },
    }))

    if (!result.Item) return notFound('Ticket not found')

    const { PK, SK, gsi1pk, gsi1sk, gsi2pk, gsi2sk, ...ticket } = result.Item

    // Check access: must be member of the ticket's org or system admin
    const orgId = ticket.orgId as string
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

    const isMember = !!membership.Item
    const isAdmin  = profile.Item?.isAdmin === true

    if (!isMember && !isAdmin) return forbidden('Access denied')

    return ok(ticket)
  } catch (err) {
    console.error('[tickets/get] DynamoDB error:', err)
    return internalError()
  }
})
