import type { APIGatewayProxyResultV2 } from 'aws-lambda'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
}

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  }
}

export const ok          = (body: unknown)                    => json(200, body)
export const created     = (body: unknown)                    => json(201, body)
export const noContent   = (): APIGatewayProxyResultV2        => ({ statusCode: 204, headers: CORS_HEADERS, body: '' })
export const badRequest  = (message: string, errors?: unknown) => json(400, { message, errors })
export const unauthorized= (message = 'Unauthorized')          => json(401, { message })
export const forbidden   = (message = 'Forbidden')             => json(403, { message })
export const notFound    = (message = 'Not found')             => json(404, { message })
export const conflict    = (message: string)                   => json(409, { message })
export const internalError=(message = 'Internal server error') => json(500, { message })
