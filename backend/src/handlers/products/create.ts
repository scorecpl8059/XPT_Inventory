/**
 * POST /organizations/{orgId}/products — Create a new product.
 *
 * Manager+ only. Creates the product record and optional variants.
 * Can also be triggered from an approved proposal via createFromProposal.
 */
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { ulid } from 'ulid'
import { z } from 'zod'
import { docClient, PRODUCTS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, internalError } from '../../shared/response'

const variantSchema = z.object({
  variantName: z.string().min(1).max(255),
  attributes:  z.record(z.string()).default({}),
  price:       z.number().positive().optional(),
  cost:        z.number().positive().optional(),
  weight:      z.number().positive().optional(),
  sku:         z.string().max(100).optional(),
})

const schema = z.object({
  name:        z.string().min(1).max(255),
  sku:         z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  category:    z.string().max(100).optional(),
  unitPrice:   z.number().positive().optional(),
  cost:        z.number().positive().optional(),
  variants:    z.array(variantSchema).optional(),
})

export const handler = withOrgAuth(async (event, { userId, orgId }) => {
  let body: unknown
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten())

  const { name, sku, description, category, unitPrice, cost, variants } = parsed.data
  const productId = ulid()
  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [
    {
      Put: {
        TableName: PRODUCTS_TABLE,
        Item: {
          PK: `ORG#${orgId}`,
          SK: `PROD#${productId}`,
          productId, name, sku, description, category,
          unitPrice, cost,
          status: 'ACTIVE',
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
          // GSI1 for SKU lookup
          gsi1pk: `ORG#${orgId}#SKU`,
          gsi1sk: sku,
        },
      },
    },
  ]

  // Add variant records
  if (variants?.length) {
    for (const v of variants) {
      const variantId = ulid()
      items.push({
        Put: {
          TableName: PRODUCTS_TABLE,
          Item: {
            PK: `ORG#${orgId}`,
            SK: `VARIANT#${productId}#${variantId}`,
            variantId, productId,
            variantName: v.variantName,
            attributes: v.attributes,
            price: v.price, cost: v.cost, weight: v.weight, sku: v.sku,
          },
        },
      })
    }
  }

  try {
    await docClient.send(new TransactWriteCommand({ TransactItems: items }))
  } catch (err) {
    console.error('[products/create] DynamoDB error:', err)
    return internalError()
  }

  return ok({ productId, name, sku, status: 'ACTIVE', createdAt: now })
}, { requireRole: 'manager' })
