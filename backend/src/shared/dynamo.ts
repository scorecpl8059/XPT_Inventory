import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
})

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
})

// Multi-table: each table name comes from its own env var
export const USERS_TABLE     = process.env.USERS_TABLE_NAME!
export const ORGS_TABLE      = process.env.ORGS_TABLE_NAME!
export const PRODUCTS_TABLE  = process.env.PRODUCTS_TABLE_NAME!
export const PROPOSALS_TABLE = process.env.PROPOSALS_TABLE_NAME!
export const INVENTORY_TABLE = process.env.INVENTORY_TABLE_NAME!
export const TICKETS_TABLE   = process.env.TICKETS_TABLE_NAME!
