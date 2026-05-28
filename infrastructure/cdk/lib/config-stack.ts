import * as cdk from 'aws-cdk-lib'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'

export interface ConfigStackProps extends cdk.StackProps {
  auth0Domain:   string
  auth0ClientId: string
  auth0Audience: string
}

/**
 * Stores Auth0 config in SSM Parameter Store so CodeBuild can read them.
 * Values are String type (not SecureString) — these are public Auth0 values
 * already embedded in the frontend bundle.
 */
export class ConfigStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ConfigStackProps) {
    super(scope, id, props)

    cdk.Tags.of(this).add('project', 'xpt_inventory')

    new ssm.StringParameter(this, 'Auth0Domain', {
      parameterName: '/xpt-inv/auth0-domain',
      stringValue:   props.auth0Domain,
      description:   'Auth0 tenant domain',
    })

    new ssm.StringParameter(this, 'Auth0ClientId', {
      parameterName: '/xpt-inv/auth0-client-id',
      stringValue:   props.auth0ClientId,
      description:   'Auth0 SPA client ID',
    })

    new ssm.StringParameter(this, 'Auth0Audience', {
      parameterName: '/xpt-inv/auth0-audience',
      stringValue:   props.auth0Audience,
      description:   'Auth0 API audience',
    })
  }
}
