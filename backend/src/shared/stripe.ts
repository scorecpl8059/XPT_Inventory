import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

export interface PlanConfig {
  name: string
  maxUsers: number
  maxProducts: number
  maxLocations: number
}

export const PLAN_LIMITS: Record<string, PlanConfig> = {
  free: {
    name: 'Free',
    maxUsers: 1,
    maxProducts: 50,
    maxLocations: 1,
  },
  starter: {
    name: 'Starter',
    maxUsers: 5,
    maxProducts: 500,
    maxLocations: 3,
  },
  professional: {
    name: 'Professional',
    maxUsers: 25,
    maxProducts: 5000,
    maxLocations: Infinity,
  },
  enterprise: {
    name: 'Enterprise',
    maxUsers: Infinity,
    maxProducts: Infinity,
    maxLocations: Infinity,
  },
}

export function getPlanLimits(plan: string): PlanConfig {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
}
