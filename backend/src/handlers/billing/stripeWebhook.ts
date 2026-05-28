/**
 * POST /webhooks/stripe — Handle Stripe webhook events.
 *
 * No JWT auth — verified by Stripe signature.
 * Updates org plan/subscription in the orgs table.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, ORGS_TABLE } from '../../shared/dynamo'
import { stripe } from '../../shared/stripe'
import type Stripe from 'stripe'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

async function updateOrgPlan(orgId: string, plan: string, stripeSubId: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: ORGS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: 'META' },
    UpdateExpression: 'SET #p = :plan, stripeSubId = :subId, updatedAt = :now',
    ExpressionAttributeNames: { '#p': 'plan' },
    ExpressionAttributeValues: {
      ':plan': plan, ':subId': stripeSubId, ':now': new Date().toISOString(),
    },
  }))
}

async function clearOrgSubscription(orgId: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: ORGS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: 'META' },
    UpdateExpression: 'SET #p = :plan, updatedAt = :now REMOVE stripeSubId',
    ExpressionAttributeNames: { '#p': 'plan' },
    ExpressionAttributeValues: { ':plan': 'free', ':now': new Date().toISOString() },
  }))
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const sig = event.headers['stripe-signature']
  if (!sig || !event.body) {
    return { statusCode: 400, body: 'Missing signature or body' }
  }

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripeWebhook] Signature verification failed:', err)
    return { statusCode: 400, body: 'Invalid signature' }
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.orgId
        const plan  = session.metadata?.plan
        const subId = session.subscription as string
        if (orgId && plan && subId) {
          await updateOrgPlan(orgId, plan, subId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = stripeEvent.data.object as Stripe.Subscription
        const orgId = sub.metadata?.orgId
        if (orgId && sub.status === 'active') {
          // Plan might have changed via portal
          const plan = sub.metadata?.plan ?? 'starter'
          await updateOrgPlan(orgId, plan, sub.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object as Stripe.Subscription
        const orgId = sub.metadata?.orgId
        if (orgId) {
          await clearOrgSubscription(orgId)
        }
        break
      }
    }
  } catch (err) {
    console.error('[stripeWebhook] Handler error:', err)
    return { statusCode: 500, body: 'Internal error' }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}
