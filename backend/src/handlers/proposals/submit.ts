/**
 * POST /organizations/{orgId}/proposals/{id}/submit — Submit a draft proposal for review.
 *
 * Transitions: DRAFT → SUBMITTED. Only the creator can submit.
 */
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, PROPOSALS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, forbidden, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { userId, orgId }) => {
  const proposalId = event.pathParameters?.id
  if (!proposalId) return badRequest('Missing proposal ID')

  const existing = await docClient.send(new GetCommand({
    TableName: PROPOSALS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
    ProjectionExpression: '#s, createdBy',
    ExpressionAttributeNames: { '#s': 'status' },
  }))

  if (!existing.Item) return notFound('Proposal not found')
  if (existing.Item.status !== 'DRAFT') return badRequest('Only DRAFT proposals can be submitted')
  if (existing.Item.createdBy !== userId) return forbidden('Only the creator can submit this proposal')

  try {
    await docClient.send(new UpdateCommand({
      TableName: PROPOSALS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
      UpdateExpression: 'SET #s = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':status': 'SUBMITTED', ':now': new Date().toISOString() },
    }))
  } catch (err) {
    console.error('[proposals/submit] DynamoDB error:', err)
    return internalError()
  }

  return ok({ message: 'Proposal submitted', status: 'SUBMITTED' })
})
