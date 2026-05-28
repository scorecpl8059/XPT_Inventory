import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export interface InventoryDbStackProps extends cdk.StackProps {
  stage: 'staging' | 'prod'
}

/**
 * Inventory table — locations, stock levels, and stock movements.
 *
 * Key patterns:
 *   ORG#<orgId> | LOC#<ulid>                         — warehouse/store location
 *   ORG#<orgId> | STOCK#<prodId>#<locId>             — current stock level
 *   ORG#<orgId> | MOVEMENT#<YYYY-MM-DD>#<ulid>       — stock movement record
 */
export class InventoryDbStack extends cdk.Stack {
  public readonly table: dynamodb.Table

  constructor(scope: Construct, id: string, props: InventoryDbStackProps) {
    super(scope, id, props)

    cdk.Tags.of(this).add('project', 'xpt_inventory')
    cdk.Tags.of(this).add('stage', props.stage)

    this.table = new dynamodb.Table(this, 'InventoryTable', {
      tableName:     `xpt-inv-inventory-${props.stage}`,
      partitionKey:  { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey:       { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode:   dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    new cdk.CfnOutput(this, 'InventoryTableName', {
      value:       this.table.tableName,
      exportName:  `xpt-inv-inventory-table-${props.stage}`,
    })
  }
}
