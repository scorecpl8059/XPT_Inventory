import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'
import { docClient, USERS_TABLE } from '../../shared/dynamo'
import { withAuth } from '../../middleware/withAuth'
import { ok, badRequest, internalError } from '../../shared/response'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
})

export const handler = withAuth(async (event, userId) => {
  try {
    const body   = JSON.parse(event.body ?? '{}')
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

    const { name } = parsed.data

    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET #n = :name, updatedAt = :now',
      ExpressionAttributeNames: { '#n': 'name' },
      ExpressionAttributeValues: {
        ':name': name,
        ':now':  new Date().toISOString(),
      },
    }))

    return ok({ name })
  } catch (err) {
    console.error('[user/updateProfile] Error:', err)
    return internalError()
  }
})
