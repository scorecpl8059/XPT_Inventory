import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export interface ProposalsDbStackProps extends cdk.StackProps {
  stage: 'staging' | 'prod'
}

/**
 * Proposals table — product proposal workflow with comments.
 *
 * Key patterns:
 *   ORG#<orgId> | PROP#<ulid>                       — proposal
 *   ORG#<orgId> | PROP_COMMENT#<propId>#<ulid>      — comment on proposal
 */
export class ProposalsDbStack extends cdk.Stack {
  public readonly table: dynamodb.Table

  constructor(scope: Construct, id: string, props: ProposalsDbStackProps) {
    super(scope, id, props)

    cdk.Tags.of(this).add('project', 'xpt_inventory')
    cdk.Tags.of(this).add('stage', props.stage)

    this.table = new dynamodb.Table(this, 'ProposalsTable', {
      tableName:     `xpt-inv-proposals-${props.stage}`,
      partitionKey:  { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey:       { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode:   dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    new cdk.CfnOutput(this, 'ProposalsTableName', {
      value:       this.table.tableName,
      exportName:  `xpt-inv-proposals-table-${props.stage}`,
    })
  }
}
