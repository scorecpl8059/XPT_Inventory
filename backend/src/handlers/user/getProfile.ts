import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, USERS_TABLE } from '../../shared/dynamo'
import { withAuth } from '../../middleware/withAuth'
import { ok } from '../../shared/response'

export const handler = withAuth(async (_event, userId) => {
  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    ProjectionExpression: '#n, email, avatarUrl, isAdmin',
    ExpressionAttributeNames: { '#n': 'name' },
  }))

  return ok({
    name:      result.Item?.name      ?? null,
    email:     result.Item?.email     ?? null,
    avatarUrl: result.Item?.avatarUrl ?? null,
    isAdmin:   result.Item?.isAdmin   ?? false,
  })
})
