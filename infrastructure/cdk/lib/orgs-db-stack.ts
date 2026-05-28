import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export interface OrgsDbStackProps extends cdk.StackProps {
  stage: 'staging' | 'prod'
}

/**
 * Organizations table — org metadata, members, and invitations.
 *
 * Key patterns:
 *   ORG#<orgId> | META              — org metadata + billing
 *   ORG#<orgId> | MEMBER#<sub>      — org member record
 *   ORG#<orgId> | INVITE#<ulid>     — pending invitation
 *
 * GSI1: INVITE_EMAIL#<email> / INVITE#<ulid> — lookup invites by email
 */
export class OrgsDbStack extends cdk.Stack {
  public readonly table: dynamodb.Table

  constructor(scope: Construct, id: string, props: OrgsDbStackProps) {
    super(scope, id, props)

    cdk.Tags.of(this).add('project', 'xpt_inventory')
    cdk.Tags.of(this).add('stage', props.stage)

    this.table = new dynamodb.Table(this, 'OrgsTable', {
      tableName:     `xpt-inv-orgs-${props.stage}`,
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

    new cdk.CfnOutput(this, 'OrgsTableName', {
      value:       this.table.tableName,
      exportName:  `xpt-inv-orgs-table-${props.stage}`,
    })
  }
}
