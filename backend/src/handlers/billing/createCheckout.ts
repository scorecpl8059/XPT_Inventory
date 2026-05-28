/**
 * POST /organizations/{orgId}/billing/checkout — Create a Stripe Checkout session.
 *
 * Owner-only. Creates a checkout session for the selected plan.
 */
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'
import { docClient, ORGS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { stripe } from '../../shared/stripe'
import { ok, badRequest, internalError } from '../../shared/response'

// These would be real Stripe Price IDs from the Stripe Dashboard
const PRICE_IDS: Record<string, string> = {
  starter:      process.env.STRIPE_PRICE_STARTER ?? 'price_starter',
  professional: process.env.STRIPE_PRICE_PROFESSIONAL ?? 'price_professional',
}

const schema = z.object({
  plan: z.enum(['starter', 'professional']),
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

  const { plan } = parsed.data
  const frontendUrl = process.env.FRONTEND_URL ?? 'https://inv.xpt-tech.com'

  // Fetch org to get or create Stripe customer
  const org = await docClient.send(new GetCommand({
    TableName: ORGS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: 'META' },
    ProjectionExpression: '#n, stripeCustomerId',
    ExpressionAttributeNames: { '#n': 'name' },
  }))

  let customerId = org.Item?.stripeCustomerId as string | undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.Item?.name as string,
      metadata: { orgId },
    })
    customerId = customer.id

    await docClient.send(new UpdateCommand({
      TableName: ORGS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: 'META' },
      UpdateExpression: 'SET stripeCustomerId = :cid',
      ExpressionAttributeValues: { ':cid': customerId },
    }))
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${frontendUrl}/settings?billing=success`,
      cancel_url:  `${frontendUrl}/settings?billing=cancel`,
      metadata: { orgId, plan },
    })

    return ok({ url: session.url })
  } catch (err) {
    console.error('[billing/createCheckout] Stripe error:', err)
    return internalError()
  }
}, { requireRole: 'owner' })
