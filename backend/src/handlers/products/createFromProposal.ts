/**
 * POST /organizations/{orgId}/proposals/{id}/create-product — Create product from approved proposal.
 *
 * Manager+ only. Takes an APPROVED proposal and:
 *   1. Creates the product + variants in PRODUCTS_TABLE
 *   2. Updates proposal status to PRODUCT_CREATED in PROPOSALS_TABLE
 */
import { GetCommand, TransactWriteCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ulid } from 'ulid'
import { docClient, PRODUCTS_TABLE, PROPOSALS_TABLE } from '../../shared/dynamo'
import { withOrgAuth } from '../../middleware/withOrgAuth'
import { ok, badRequest, notFound, internalError } from '../../shared/response'

export const handler = withOrgAuth(async (event, { userId, orgId }) => {
  const proposalId = event.pathParameters?.id
  if (!proposalId) return badRequest('Missing proposal ID')

  // Fetch the proposal
  const proposal = await docClient.send(new GetCommand({
    TableName: PROPOSALS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
  }))

  if (!proposal.Item) return notFound('Proposal not found')
  if (proposal.Item.status !== 'APPROVED') {
    return badRequest('Only APPROVED proposals can be converted to products')
  }

  const pd = proposal.Item.productData as {
    name: string; sku: string; description?: string; category?: string;
    unitPrice?: number; cost?: number;
    variants?: Array<{ variantName: string; attributes: Record<string, string>; price?: number; cost?: number }>
  }

  const productId = ulid()
  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [
    // Create product
    {
      Put: {
        TableName: PRODUCTS_TABLE,
        Item: {
          PK: `ORG#${orgId}`,
          SK: `PROD#${productId}`,
          productId,
          name: pd.name,
          sku: pd.sku,
          description: pd.description,
          category: pd.category,
          unitPrice: pd.unitPrice,
          cost: pd.cost,
          status: 'ACTIVE',
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
          gsi1pk: `ORG#${orgId}#SKU`,
          gsi1sk: pd.sku,
        },
      },
    },
    // Update proposal status
    {
      Update: {
        TableName: PROPOSALS_TABLE,
        Key: { PK: `ORG#${orgId}`, SK: `PROP#${proposalId}` },
        UpdateExpression: 'SET #s = :status, updatedAt = :now',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': 'PRODUCT_CREATED', ':now': now },
      },
    },
  ]

  // Add variants if any
  if (pd.variants?.length) {
    for (const v of pd.variants) {
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
            price: v.price, cost: v.cost,
          },
        },
      })
    }
  }

  try {
    await docClient.send(new TransactWriteCommand({ TransactItems: items }))
  } catch (err) {
    console.error('[products/createFromProposal] DynamoDB error:', err)
    return internalError()
  }

  return ok({ productId, proposalId, name: pd.name, sku: pd.sku, status: 'ACTIVE', createdAt: now })
}, { requireRole: 'manager' })
