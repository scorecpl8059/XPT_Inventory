/**
 * POST /organizations/{orgId}/locations — Create a warehouse/store location.
 *
 * Manager+ only.
 */
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ulid } from 'ulid'
import { z } from 'zod'
import { docClient, INVENTORY_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, internalError } from '../../shared/response'

const schema = z.object({
  name:      z.string().min(1).max(255),
  address:   z.string().max(500).optional(),
  isDefault: z.boolean().default(false),
})

export const handler = withOrgAuth(async (event, { orgId }) => {
  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const { name, address, isDefault } = parsed.data
  const locationId = ulid()
  const now = new Date().toISOString()

  try {
    await docClient.send(new PutCommand({
      TableName: INVENTORY_TABLE,
      Item: {
        PK: `ORG#${orgId}`,
        SK: `LOC#${locationId}`,
        locationId, name, address,
        isDefault,
        createdAt: now,
      },
    }))
  } catch (err) {
    console.error('[locations/create] DynamoDB error:', err)
    return internalError()
  }

  return ok({ locationId, name, createdAt: now })
}, { requireRole: 'manager' })
