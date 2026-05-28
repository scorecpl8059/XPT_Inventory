import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export interface UsersDbStackProps extends cdk.StackProps {
  stage: 'staging' | 'prod'
}

/**
 * Users table — profiles and org memberships.
 *
 * Key patterns:
 *   USER#<sub> | PROFILE             — user profile
 *   USER#<sub> | MEMBERSHIP#<orgId>  — user's membership in an org
 *
 * GSI1: EMAIL#<email> / PROFILE — lookup user by email
 */
export class UsersDbStack extends cdk.Stack {
  public readonly table: dynamodb.Table

  constructor(scope: Construct, id: string, props: UsersDbStackProps) {
    super(scope, id, props)

    cdk.Tags.of(this).add('project', 'xpt_inventory')
    cdk.Tags.of(this).add('stage', props.stage)

    this.table = new dynamodb.Table(this, 'UsersTable', {
      tableName:     `xpt-inv-users-${props.stage}`,
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

    new cdk.CfnOutput(this, 'UsersTableName', {
      value:       this.table.tableName,
      exportName:  `xpt-inv-users-table-${props.stage}`,
    })
  }
}
