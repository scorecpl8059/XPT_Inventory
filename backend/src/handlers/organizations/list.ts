/**
 * GET /organizations — List all organizations the caller belongs to.
 *
 * Queries USER#<sub> with SK begins_with(MEMBERSHIP#) in the users table.
 */
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, USERS_TABLE } from '../../shared/dynamo'
import { withAuth } from '../../middleware/withAuth'
import { ok, internalError } from '../../shared/response'

export const handler = withAuth(async (_event, userId) => {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: USERS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk':     `USER#${userId}`,
        ':prefix': 'MEMBERSHIP#',
      },
    }))

    const organizations = (result.Items ?? []).map(item => ({
      orgId:    item.orgId,
      orgName:  item.orgName,
      role:     item.role,
      joinedAt: item.joinedAt,
    }))

    return ok({ organizations })
  } catch (err) {
    console.error('[organizations/list] DynamoDB error:', err)
    return internalError()
  }
})
