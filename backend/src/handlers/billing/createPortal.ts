/**
 * POST /organizations/{orgId}/billing/portal — Create a Stripe Customer Portal session.
 *
 * Owner-only. Redirects to Stripe's self-service portal for managing subscriptions.
 */
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, ORGS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { stripe } from '../../shared/stripe'
import { ok, badRequest, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (_event, { orgId }) => {
  const org = await docClient.send(new GetCommand({
    TableName: ORGS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: 'META' },
    ProjectionExpression: 'stripeCustomerId',
  }))

  const customerId = org.Item?.stripeCustomerId as string | undefined
  if (!customerId) return badRequest('No billing account. Please subscribe to a plan first.')

  const frontendUrl = process.env.FRONTEND_URL ?? 'https://inv.xpt-tech.com'

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${frontendUrl}/settings`,
    })

    return ok({ url: session.url })
  } catch (err) {
    console.error('[billing/createPortal] Stripe error:', err)
    return internalError()
  }
}, { requireRole: 'owner' })
