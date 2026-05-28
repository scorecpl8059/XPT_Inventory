/**
 * POST /organizations/{orgId}/proposals/{id}/approve — Approve a proposal.
 *
 * Transitions: SUBMITTED | IN_REVIEW → APPROVED. Manager+ only.
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

  const status = existing.Item.status as string
  if (status !== 'SUBMITTED' && status !== 'IN_REVIEW') {
    return badRequest('Only SUBMITTED or IN_REVIEW proposals can be approved')
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: PROPOSALS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
      UpdateExpression: 'SET #s = :status, approvedBy = :approver, updatedAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':status': 'APPROVED',
        ':approver': userId,
        ':now': new Date().toISOString(),
      },
    }))
  } catch (err) {
    console.error('[proposals/approve] DynamoDB error:', err)
    return internalError()
  }

  return ok({ message: 'Proposal approved', status: 'APPROVED' })
}, { requireRole: 'manager' })
