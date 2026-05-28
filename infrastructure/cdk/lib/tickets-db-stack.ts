import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export interface TicketsDbStackProps extends cdk.StackProps {
  stage: 'staging' | 'prod'
}

/**
 * Tickets table — support tickets with message threads.
 *
 * Key patterns:
 *   TICKET#<ulid> | META              — ticket metadata
 *   TICKET#<ulid> | MSG#<ulid>        — message in thread
 *
 * GSI1: ORG#<orgId> / TICKET#<ulid>       — list tickets by org
 * GSI2: STATUS#<status> / TICKET#<ulid>   — admin: list by status
 */
export class TicketsDbStack extends cdk.Stack {
  public readonly table: dynamodb.Table

  constructor(scope: Construct, id: string, props: TicketsDbStackProps) {
    super(scope, id, props)

    cdk.Tags.of(this).add('project', 'xpt_inventory')
    cdk.Tags.of(this).add('stage', props.stage)

    this.table = new dynamodb.Table(this, 'TicketsTable', {
      tableName:     `xpt-inv-tickets-${props.stage}`,
      partitionKey:  { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey:       { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode:   dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // GSI1: list tickets by organization
    this.table.addGlobalSecondaryIndex({
      indexName:      'GSI1',
      partitionKey:   { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // GSI2: admin — list all tickets by status
    this.table.addGlobalSecondaryIndex({
      indexName:      'GSI2',
      partitionKey:   { name: 'gsi2pk', type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'gsi2sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    new cdk.CfnOutput(this, 'TicketsTableName', {
      value:       this.table.tableName,
      exportName:  `xpt-inv-tickets-table-${props.stage}`,
    })
  }
}
