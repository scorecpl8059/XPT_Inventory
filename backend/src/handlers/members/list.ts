/**
 * GET /organizations/{orgId}/members — List all members of an organization.
 *
 * Any member can view. Queries ORG#<orgId> with SK begins_with(MEMBER#)
 * in the orgs table. Name and email are denormalized on the member record.
 */
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, ORGS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (_event, { orgId }) => {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: ORGS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk':     `ORG#${orgId}`,
        ':prefix': 'MEMBER#',
      },
    }))

    const members = (result.Items ?? []).map(item => ({
      userId:   item.userId,
      name:     item.name,
      email:    item.email,
      role:     item.role,
      joinedAt: item.joinedAt,
    }))

    return ok({ members })
  } catch (err) {
    console.error('[members/list] DynamoDB error:', err)
    return internalError()
  }
})
