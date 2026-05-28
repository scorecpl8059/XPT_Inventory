import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export interface ProductsDbStackProps extends cdk.StackProps {
  stage: 'staging' | 'prod'
}

/**
 * Products table — product catalog with variants.
 *
 * Key patterns:
 *   ORG#<orgId> | PROD#<ulid>               — product record
 *   ORG#<orgId> | VARIANT#<prodId>#<ulid>   — product variant
 *
 * GSI1: ORG#<orgId>#SKU / <sku> — lookup product by SKU
 */
export class ProductsDbStack extends cdk.Stack {
  public readonly table: dynamodb.Table

  constructor(scope: Construct, id: string, props: ProductsDbStackProps) {
    super(scope, id, props)

    cdk.Tags.of(this).add('project', 'xpt_inventory')
    cdk.Tags.of(this).add('stage', props.stage)

    this.table = new dynamodb.Table(this, 'ProductsTable', {
      tableName:     `xpt-inv-products-${props.stage}`,
      partitionKey:  { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey:       { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode:   dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    this.table.addGlobalSecondaryIndex({
      indexName:      'GSI1',
      partitionKey:   { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    new cdk.CfnOutput(this, 'ProductsTableName', {
      value:       this.table.tableName,
      exportName:  `xpt-inv-products-table-${props.stage}`,
    })
  }
}
