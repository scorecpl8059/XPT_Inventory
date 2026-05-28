/**
 * PATCH /organizations/{orgId}/locations/{id} — Update a location.
 *
 * Manager+ only.
 */
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'
import { docClient, INVENTORY_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, internalError } from '../../shared/response'

const schema = z.object({
  name:      z.string().min(1).max(255).optional(),
  address:   z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field is required',
})

export const handler = withOrgAuth(async (event, { orgId }) => {
  const locationId = event.pathParameters?.id
  if (!locationId) return badRequest('Missing location ID')

  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const existing = await docClient.send(new GetCommand({
    TableName: INVENTORY_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `LOC#${locationId}` },
    ProjectionExpression: 'locationId',
  }))
  if (!existing.Item) return notFound('Location not found')

  const data = parsed.data
  const expNames: Record<string, string> = {}
  const expValues: Record<string, unknown> = {}
  const setClauses: string[] = []

  if (data.name) { setClauses.push('#n = :name'); expNames['#n'] = 'name'; expValues[':name'] = data.name }
  if (data.address !== undefined) { setClauses.push('address = :addr'); expValues[':addr'] = data.address }
  if (data.isDefault !== undefined) { setClauses.push('isDefault = :def'); expValues[':def'] = data.isDefault }

  try {
    await docClient.send(new UpdateCommand({
      TableName: INVENTORY_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: `LOC#${locationId}` },
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeValues: expValues,
      ...(Object.keys(expNames).length > 0 && { ExpressionAttributeNames: expNames }),
    }))
  } catch (err) {
    console.error('[locations/update] DynamoDB error:', err)
    return internalError()
  }

  return ok({ message: 'Location updated' })
}, { requireRole: 'manager' })
