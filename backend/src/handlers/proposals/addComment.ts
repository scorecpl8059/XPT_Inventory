/**
 * POST /organizations/{orgId}/proposals/{id}/comments — Add a comment to a proposal.
 *
 * Any member can comment on any proposal.
 */
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { ulid } from 'ulid'
import { z } from 'zod'
import { docClient, USERS_TABLE, PROPOSALS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, internalError } from '../../shared/response'

const schema = z.object({
  body: z.string().min(1).max(5000),
})

export const handler = withOrgAuth(async (event, { userId, orgId, role }) => {
  const proposalId = event.pathParameters?.id
  if (!proposalId) return badRequest('Missing proposal ID')

  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  // Verify proposal exists
  const proposal = await docClient.send(new GetCommand({
    TableName: PROPOSALS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
    ProjectionExpression: 'proposalId',
  }))
  if (!proposal.Item) return notFound('Proposal not found')

  // Get commenter's name
  const profile = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    ProjectionExpression: '#n',
    ExpressionAttributeNames: { '#n': 'name' },
  }))
  const authorName = (profile.Item?.name as string) ?? ''

  const commentId = ulid()
  const now = new Date().toISOString()

  try {
    await docClient.send(new PutCommand({
      TableName: PROPOSALS_TABLE,
      Item: {
        PK: `ORG#${orgId}`,
        SK: `PROP_COMMENT#${proposalId}#${commentId}`,
        commentId,
        proposalId,
        body: parsed.data.body,
        authorId: userId,
        authorName,
        authorRole: role,
        createdAt: now,
      },
    }))
  } catch (err) {
    console.error('[proposals/addComment] DynamoDB error:', err)
    return internalError()
  }

  return ok({ commentId, proposalId, authorName, authorRole: role, createdAt: now })
})
