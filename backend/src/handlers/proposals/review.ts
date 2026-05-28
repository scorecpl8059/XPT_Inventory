/**
 * POST /organizations/{orgId}/proposals/{id}/review — Start reviewing a proposal.
 *
 * Transitions: SUBMITTED → IN_REVIEW. Manager+ only.
 */
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, PROPOSALS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { userId, orgId }) => {
  const proposalId = event.pathParameters?.id
  if (!proposalId) return badRequest('Missing proposal ID')

  const existing = await docClient.send(new GetCommand({
    TableName: PROPOSALS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
    ProjectionExpression: '#s',
    ExpressionAttributeNames: { '#s': 'status' },
  }))

  if (!existing.Item) return notFound('Proposal not found')
  if (existing.Item.status !== 'SUBMITTED') return badRequest('Only SUBMITTED proposals can be reviewed')

  try {
    await docClient.send(new UpdateCommand({
      TableName: PROPOSALS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
      UpdateExpression: 'SET #s = :status, reviewedBy = :reviewer, updatedAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':status': 'IN_REVIEW',
        ':reviewer': userId,
        ':now': new Date().toISOString(),
      },
    }))
  } catch (err) {
    console.error('[proposals/review] DynamoDB error:', err)
    return internalError()
  }

  return ok({ message: 'Proposal is now in review', status: 'IN_REVIEW' })
}, { requireRole: 'manager' })
