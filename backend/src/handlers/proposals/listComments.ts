/**
 * GET /organizations/{orgId}/proposals/{id}/comments — List comments on a proposal.
 *
 * Any member can view comments.
 */
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, PROPOSALS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { orgId }) => {
  const proposalId = event.pathParameters?.id
  if (!proposalId) return badRequest('Missing proposal ID')

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: PROPOSALS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk':     `ORG#${orgId}`,
        ':prefix': `PROP_COMMENT#${proposalId}#`,
      },
    }))

    const comments = (result.Items ?? []).map(item => ({
      commentId:  item.commentId,
      proposalId: item.proposalId,
      body:       item.body,
      authorId:   item.authorId,
      authorName: item.authorName,
      authorRole: item.authorRole,
      createdAt:  item.createdAt,
    }))

    return ok({ comments })
  } catch (err) {
    console.error('[proposals/listComments] DynamoDB error:', err)
    return internalError()
  }
})
