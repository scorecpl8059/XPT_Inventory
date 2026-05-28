/**
 * withOrgAuth — authentication + organization-level authorization middleware.
 *
 * Wraps a Lambda handler with two checks:
 *   1. Verifies the Auth0 JWT (same as withAuth).
 *   2. Looks up the caller's MEMBERSHIP record in the users table for the
 *      organization identified by the {orgId} path parameter.
 *
 * Passes { userId, orgId, role } to the inner handler.
 * Optionally enforces minimum role via the `requireRole` option.
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

export type OrgRole = 'owner' | 'manager' | 'staff'

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner:   3,
  manager: 2,
  staff:   1,
}

export interface OrgContext {
  userId: string
  orgId: string
  role: OrgRole
}

type OrgAuthenticatedHandler = (
  event: APIGatewayProxyEventV2,
  ctx: OrgContext
) => Promise<APIGatewayProxyResultV2>

interface WithOrgAuthOptions {
  /** Minimum role required. 'manager' allows manager + owner. 'owner' allows only owner. */
  requireRole?: 'owner' | 'manager'
}

export function withOrgAuth(
  handler: OrgAuthenticatedHandler,
  options?: WithOrgAuthOptions
): APIGatewayProxyHandlerV2 {
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

      // 1. Verify JWT
      const authHeader =
        event.headers?.authorization ?? event.headers?.Authorization

      if (!authHeader?.startsWith('Bearer ')) {
        return unauthorized('Missing or invalid Authorization header')
      }

      const token   = authHeader.slice(7)
      const payload = await verifyJwt(token)
      const userId  = payload.sub

      // 2. Extract orgId from path parameters
      const orgId = event.pathParameters?.orgId
      if (!orgId) {
        return forbidden('Missing organization ID')
      }

      // 3. Verify membership: look up USER#<sub> / MEMBERSHIP#<orgId> in users table
      const membership = await docClient.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { PK: `USER#${userId}`, SK: `MEMBERSHIP#${orgId}` },
        ProjectionExpression: '#r',
        ExpressionAttributeNames: { '#r': 'role' },
      }))

      if (!membership.Item) {
        return forbidden('Not a member of this organization')
      }

      const role = membership.Item.role as OrgRole

      // 4. Check role requirement
      if (options?.requireRole) {
        const requiredLevel = ROLE_HIERARCHY[options.requireRole]
        const actualLevel   = ROLE_HIERARCHY[role]
        if (actualLevel < requiredLevel) {
          return forbidden(`${options.requireRole} access required`)
        }
      }

      return await handler(event, { userId, orgId, role })
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'TOKEN_EXPIRED') return unauthorized('Token expired')
        if (err.message === 'INVALID_TOKEN') return unauthorized('Invalid token')
      }
      console.error('[withOrgAuth] Unhandled error:', err)
      return internalError()
    }
  }
}
