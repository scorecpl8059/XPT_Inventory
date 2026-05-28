/**
 * withAdminAuth — authentication + system admin authorization middleware.
 *
 * Verifies the Auth0 JWT, then checks that the user's profile in the users
 * table has `isAdmin: true`. Used for platform-wide admin endpoints
 * (ticket queue, org management, analytics).
 */
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { verifyJwt } from '../shared/auth'
import { docClient, USERS_TABLE } from '../shared/dynamo'
import { unauthorized, forbidden, internalError } from '../shared/response'

type AdminHandler = (
  event: APIGatewayProxyEventV2,
  userId: string
) => Promise<APIGatewayProxyResultV2>

export function withAdminAuth(handler: AdminHandler): APIGatewayProxyHandlerV2 {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
      if (event.requestContext?.http?.method === 'OPTIONS') {
        return {
          statusCode: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Authorization,Content-Type',
            'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          },
          body: '',
        }
      }

      const authHeader =
        event.headers?.authorization ?? event.headers?.Authorization

      if (!authHeader?.startsWith('Bearer ')) {
        return unauthorized('Missing or invalid Authorization header')
      }

      const token   = authHeader.slice(7)
      const payload = await verifyJwt(token)
      const userId  = payload.sub

      // Check isAdmin flag on user profile
      const profile = await docClient.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        ProjectionExpression: 'isAdmin',
      }))

      if (!profile.Item?.isAdmin) {
        return forbidden('System admin access required')
      }

      return await handler(event, userId)
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'TOKEN_EXPIRED') return unauthorized('Token expired')
        if (err.message === 'INVALID_TOKEN') return unauthorized('Invalid token')
      }
      console.error('[withAdminAuth] Unhandled error:', err)
      return internalError()
    }
  }
}
