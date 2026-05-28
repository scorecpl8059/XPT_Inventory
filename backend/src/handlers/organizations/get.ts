/**
 * GET /organizations/{orgId} — Get organization details.
 *
 * Returns the META record from the orgs table. Requires membership (any role).
 */
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, ORGS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, notFound, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (_event, { orgId }) => {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: ORGS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: 'META' },
    }))

    if (!result.Item) return notFound('Organization not found')

    const { PK, SK, ...org } = result.Item
    return ok(org)
  } catch (err) {
    console.error('[organizations/get] DynamoDB error:', err)
    return internalError()
  }
})
