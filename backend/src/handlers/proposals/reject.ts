/**
 * POST /organizations/{orgId}/proposals/{id}/reject — Reject a proposal.
 *
 * Transitions: SUBMITTED | IN_REVIEW → REJECTED. Manager+ only.
 * Requires a rejection reason.
 */
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'
import { docClient, PROPOSALS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, internalError } from '../../shared/response'

const schema = z.object({
  reason: z.string().min(1).max(1000),
})

export const handler = withOrgAuth(async (event, { userId, orgId }) => {
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

  const existing = await docClient.send(new GetCommand({
    TableName: PROPOSALS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
    ProjectionExpression: '#s',
    ExpressionAttributeNames: { '#s': 'status' },
  }))

  if (!existing.Item) return notFound('Proposal not found')

  const status = existing.Item.status as string
  if (status !== 'SUBMITTED' && status !== 'IN_REVIEW') {
    return badRequest('Only SUBMITTED or IN_REVIEW proposals can be rejected')
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: PROPOSALS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
      UpdateExpression: 'SET #s = :status, rejectionReason = :reason, reviewedBy = :reviewer, updatedAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':status': 'REJECTED',
        ':reason': parsed.data.reason,
        ':reviewer': userId,
        ':now': new Date().toISOString(),
      },
    }))
  } catch (err) {
    console.error('[proposals/reject] DynamoDB error:', err)
    return internalError()
  }

  return ok({ message: 'Proposal rejected', status: 'REJECTED' })
}, { requireRole: 'manager' })
