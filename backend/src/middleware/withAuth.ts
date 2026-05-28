import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda'
import { verifyJwt } from '../shared/auth'
import { unauthorized, internalError } from '../shared/response'

type AuthenticatedHandler = (
  event: APIGatewayProxyEventV2,
  userId: string
) => Promise<APIGatewayProxyResultV2>

export function withAuth(handler: AuthenticatedHandler): APIGatewayProxyHandlerV2 {
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

      return await handler(event, payload.sub)
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'TOKEN_EXPIRED') return unauthorized('Token expired')
        if (err.message === 'INVALID_TOKEN') return unauthorized('Invalid token')
      }
      console.error('[withAuth] Unhandled error:', err)
      return internalError()
    }
  }
}
