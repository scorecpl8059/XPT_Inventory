/**
 * GET /organizations/{orgId}/proposals — List proposals.
 *
 * Any member can view. Supports optional ?status= query filter.
 */
import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb'
import { docClient, PROPOSALS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { orgId }) => {
  const statusFilter = event.queryStringParameters?.status

  try {
    const expValues: Record<string, string> = {
      ':pk':     `ORG#${orgId}`,
      ':prefix': 'PROP#',
    }

    const params: QueryCommandInput = {
      TableName: PROPOSALS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: expValues,
      ScanIndexForward: false,
    }

    if (statusFilter) {
      params.FilterExpression = '#s = :status'
      params.ExpressionAttributeNames = { '#s': 'status' }
      expValues[':status'] = statusFilter.toUpperCase()
    }

    const result = await docClient.send(new QueryCommand(params))

    const proposals = (result.Items ?? []).map(item => ({
      proposalId:    item.proposalId,
      title:         item.title,
      status:        item.status,
      createdBy:     item.createdBy,
      createdByName: item.createdByName,
      createdAt:     item.createdAt,
      updatedAt:     item.updatedAt,
    }))

    return ok({ proposals })
  } catch (err) {
    console.error('[proposals/list] DynamoDB error:', err)
    return internalError()
  }
})
