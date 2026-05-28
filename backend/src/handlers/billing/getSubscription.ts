/**
 * GET /organizations/{orgId}/billing — Get current subscription details.
 *
 * Owner-only. Returns plan, stripeCustomerId, stripeSubId.
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
      ProjectionExpression: '#p, stripeCustomerId, stripeSubId',
      ExpressionAttributeNames: { '#p': 'plan' },
    }))

    if (!result.Item) return notFound('Organization not found')

    return ok({
      plan:             result.Item.plan ?? 'free',
      stripeCustomerId: result.Item.stripeCustomerId ?? null,
      stripeSubId:      result.Item.stripeSubId ?? null,
    })
  } catch (err) {
    console.error('[billing/getSubscription] DynamoDB error:', err)
    return internalError()
  }
}, { requireRole: 'owner' })
