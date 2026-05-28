/**
 * GET /organizations/{orgId}/proposals/{id} — Get proposal details.
 */
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, PROPOSALS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { orgId }) => {
  const proposalId = event.pathParameters?.id
  if (!proposalId) return badRequest('Missing proposal ID')

  try {
    const result = await docClient.send(new GetCommand({
      TableName: PROPOSALS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
    }))

    if (!result.Item) return notFound('Proposal not found')

    const { PK, SK, ...proposal } = result.Item
    return ok(proposal)
  } catch (err) {
    console.error('[proposals/get] DynamoDB error:', err)
    return internalError()
  }
})
