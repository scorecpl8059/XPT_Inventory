import * as cdk from 'aws-cdk-lib'
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline'
import * as actions from 'aws-cdk-lib/aws-codepipeline-actions'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'

export interface PipelineStackProps extends cdk.StackProps {
  githubOwner:           string
  githubRepo:            string
  githubBranch:          string
  codeStarConnectionArn: string
  notificationEmail:     string

  stagingBucketName:      string
  stagingDistributionId:  string
  stagingApiUrl:          string

  prodBucketName:         string
  prodDistributionId:     string
  prodApiUrl:             string
}

/**
 * AWS CodePipeline CI/CD for XPT-Inventory.
 *
 * Pipeline stages:
 *   1. Source                — GitHub via CodeStar
 *   2. Build                 — lint + typecheck + test + compile backend
 *   3. Deploy_Staging_CDK    — cdk deploy all staging stacks
 *   4. Deploy_Staging_UI     — Next.js build + S3 sync + CloudFront invalidation
 *   5. Integration_Tests     — run integration tests against live staging API
 *   6. Approve_Production    — manual approval gate
 *   7. Deploy_Production_CDK — cdk deploy all prod stacks
 *   8. Deploy_Production_UI  — Next.js build + S3 sync + CloudFront invalidation
 */
export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props)

    cdk.Tags.of(this).add('project', 'xpt_inventory')

    // ── SNS topic for approval email ─────────────────────────────────────
    const approvalTopic = new sns.Topic(this, 'ApprovalTopic', {
      topicName:   'xpt-inv-deploy-approval',
      displayName: 'XPT-Inventory — Production Deploy Approval',
    })
    approvalTopic.addSubscription(
      new subscriptions.EmailSubscription(props.notificationEmail)
    )

    // ── Artifacts ────────────────────────────────────────────────────────
    const sourceArtifact = new codepipeline.Artifact('SourceArtifact')
    const buildArtifact  = new codepipeline.Artifact('BuildArtifact')

    // ── Shared deploy policy ─────────────────────────────────────────────
    const deployPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*', 'cloudfront:*', 'cloudformation:*', 'iam:*',
        'lambda:*', 'apigateway:*', 'dynamodb:*', 'ssm:*',
        'sns:*', 'logs:*', 'events:*', 'codebuild:*',
        'codepipeline:*', 'codestar-connections:*', 'codeconnections:*',
        'sts:AssumeRole',
      ],
      resources: ['*'],
    })

    // ── Shared SSM env vars (Auth0 config) ───────────────────────────────
    const auth0EnvVars = {
      AUTH0_DOMAIN: {
        value: '/xpt-inv/auth0-domain',
        type:  codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
      },
      AUTH0_CLIENT_ID: {
        value: '/xpt-inv/auth0-client-id',
        type:  codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
      },
      AUTH0_AUDIENCE: {
        value: '/xpt-inv/auth0-audience',
        type:  codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
      },
    }

    // ── CDK stack names for deploy commands ──────────────────────────────
    const stagingStacks = [
      'XptInvConfigStack',
      'XptInvUsersDbStagingStack', 'XptInvOrgsDbStagingStack',
      'XptInvProductsDbStagingStack', 'XptInvProposalsDbStagingStack',
      'XptInvInventoryDbStagingStack', 'XptInvTicketsDbStagingStack',
      'XptInvFrontendStagingStack', 'XptInvApiStagingStack',
      'XptInvPipelineStack',
    ].join(' ')

    const prodStacks = [
      'XptInvUsersDbProdStack', 'XptInvOrgsDbProdStack',
      'XptInvProductsDbProdStack', 'XptInvProposalsDbProdStack',
      'XptInvInventoryDbProdStack', 'XptInvTicketsDbProdStack',
      'XptInvFrontendProdStack', 'XptInvApiProdStack',
    ].join(' ')

    // ── Stage 2: Build ──────────────────────────────────────────────────
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: 'xpt-inv-build',
      environment: {
        buildImage:  codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': { nodejs: '20' },
            commands: ['npm ci'],
          },
          pre_build: {
            commands: [
              'echo "==> Type checking..."',
              'npm run typecheck',
              'echo "==> Linting..."',
              'npm run lint',
              'echo "==> Running unit tests..."',
              'npm run test',
            ],
          },
          build: {
            commands: [
              'echo "==> Compiling Lambda handlers..."',
              'npm run build --workspace=backend',
            ],
          },
        },
        artifacts: {
          'base-directory': '.',
          files: ['**/*'],
          'exclude-paths': [
            'node_modules/**', 'frontend/node_modules/**',
            'backend/node_modules/**', 'infrastructure/cdk/node_modules/**',
          ],
        },
        cache: {
          paths: ['node_modules/**', 'frontend/node_modules/**', 'backend/node_modules/**'],
        },
      }),
      environmentVariables: auth0EnvVars,
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.CUSTOM),
    })

    // ── Stage 3: Deploy Staging CDK ──────────────────────────────────────
    const stagingCdkDeploy = new codebuild.PipelineProject(this, 'StagingCdkDeploy', {
      projectName: 'xpt-inv-deploy-staging-cdk',
      environment: {
        buildImage:  codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': { nodejs: '20' },
            commands: [
              'npm install -g aws-cdk',
              'npm ci',
              'cd infrastructure/cdk && npm ci && cd ../..',
            ],
          },
          build: {
            commands: [
              'cd infrastructure/cdk',
              `cdk deploy ${stagingStacks} --require-approval never`,
            ],
          },
        },
      }),
    })
    stagingCdkDeploy.addToRolePolicy(deployPolicy)

    // ── Stage 4: Deploy Staging UI ───────────────────────────────────────
    const stagingUiDeploy = new codebuild.PipelineProject(this, 'StagingUiDeploy', {
      projectName: 'xpt-inv-deploy-staging-ui',
      environment: {
        buildImage:  codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': { nodejs: '20' },
            commands: ['npm ci'],
          },
          build: {
            commands: [
              'echo "NEXT_PUBLIC_AUTH0_DOMAIN=$AUTH0_DOMAIN" > frontend/.env.production',
              'echo "NEXT_PUBLIC_AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID" >> frontend/.env.production',
              'echo "NEXT_PUBLIC_AUTH0_AUDIENCE=$AUTH0_AUDIENCE" >> frontend/.env.production',
              'echo "NEXT_PUBLIC_API_BASE_URL=$STAGING_API_URL" >> frontend/.env.production',
              'npm run build --workspace=frontend',
              'aws s3 sync frontend/out/ s3://$STAGING_BUCKET --delete --exclude "*.html" --cache-control "max-age=31536000,public,immutable"',
              'aws s3 sync frontend/out/ s3://$STAGING_BUCKET --exclude "*" --include "*.html" --cache-control "no-cache,no-store,must-revalidate"',
              'aws cloudfront create-invalidation --distribution-id $STAGING_CF_ID --paths "/*"',
            ],
          },
        },
      }),
      environmentVariables: {
        STAGING_BUCKET:  { value: props.stagingBucketName },
        STAGING_CF_ID:   { value: props.stagingDistributionId },
        STAGING_API_URL: { value: props.stagingApiUrl },
        ...auth0EnvVars,
      },
    })
    stagingUiDeploy.addToRolePolicy(deployPolicy)

    // ── Stage 5: Integration Tests ──────────────────────────────────────
    const integrationTestProject = new codebuild.PipelineProject(this, 'IntegrationTestProject', {
      projectName: 'xpt-inv-integration-tests',
      environment: {
        buildImage:  codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': { nodejs: '20' },
            commands: ['npm ci'],
          },
          build: {
            commands: [
              'echo "==> Running integration tests against staging API..."',
              'npm run test:integration --workspace=backend',
            ],
          },
        },
      }),
      environmentVariables: {
        STAGING_API_URL: { value: props.stagingApiUrl },
        ...auth0EnvVars,
      },
    })
    // Grant DynamoDB access for test cleanup
    const stagingTableArns = [
      'xpt-inv-users-staging', 'xpt-inv-orgs-staging',
      'xpt-inv-products-staging', 'xpt-inv-proposals-staging',
      'xpt-inv-inventory-staging', 'xpt-inv-tickets-staging',
    ].map(name => `arn:aws:dynamodb:*:*:table/${name}`)
    integrationTestProject.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:Query', 'dynamodb:DeleteItem', 'dynamodb:BatchWriteItem'],
      resources: stagingTableArns,
    }))

    // ── Stage 7: Deploy Production CDK ──────────────────────────────────
    const prodCdkDeploy = new codebuild.PipelineProject(this, 'ProdCdkDeploy', {
      projectName: 'xpt-inv-deploy-prod-cdk',
      environment: {
        buildImage:  codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': { nodejs: '20' },
            commands: [
              'npm install -g aws-cdk',
              'npm ci',
              'cd infrastructure/cdk && npm ci && cd ../..',
            ],
          },
          build: {
            commands: [
              'cd infrastructure/cdk',
              `cdk deploy ${prodStacks} --require-approval never`,
            ],
          },
        },
      }),
    })
    prodCdkDeploy.addToRolePolicy(deployPolicy)

    // ── Stage 8: Deploy Production UI ────────────────────────────────────
    const prodUiDeploy = new codebuild.PipelineProject(this, 'ProdUiDeploy', {
      projectName: 'xpt-inv-deploy-prod-ui',
      environment: {
        buildImage:  codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': { nodejs: '20' },
            commands: ['npm ci'],
          },
          build: {
            commands: [
              'echo "NEXT_PUBLIC_AUTH0_DOMAIN=$AUTH0_DOMAIN" > frontend/.env.production',
              'echo "NEXT_PUBLIC_AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID" >> frontend/.env.production',
              'echo "NEXT_PUBLIC_AUTH0_AUDIENCE=$AUTH0_AUDIENCE" >> frontend/.env.production',
              'echo "NEXT_PUBLIC_API_BASE_URL=$PROD_API_URL" >> frontend/.env.production',
              'npm run build --workspace=frontend',
              'aws s3 sync frontend/out/ s3://$PROD_BUCKET --delete --exclude "*.html" --cache-control "max-age=31536000,public,immutable"',
              'aws s3 sync frontend/out/ s3://$PROD_BUCKET --exclude "*" --include "*.html" --cache-control "no-cache,no-store,must-revalidate"',
              'aws cloudfront create-invalidation --distribution-id $PROD_CF_ID --paths "/*"',
            ],
          },
        },
      }),
      environmentVariables: {
        PROD_BUCKET:  { value: props.prodBucketName },
        PROD_CF_ID:   { value: props.prodDistributionId },
        PROD_API_URL: { value: props.prodApiUrl },
        ...auth0EnvVars,
      },
    })
    prodUiDeploy.addToRolePolicy(deployPolicy)

    // ── Pipeline ──────────────────────────────────────────────────────────
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName:             'xpt-inv-pipeline',
      restartExecutionOnUpdate: true,
      crossAccountKeys:         false,
    })

    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new actions.CodeStarConnectionsSourceAction({
          actionName:    'GitHub_Source',
          owner:         props.githubOwner,
          repo:          props.githubRepo,
          branch:        props.githubBranch,
          connectionArn: props.codeStarConnectionArn,
          output:        sourceArtifact,
          triggerOnPush: true,
        }),
      ],
    })

    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'Lint_Test_Compile',
          project:    buildProject,
          input:      sourceArtifact,
          outputs:    [buildArtifact],
        }),
      ],
    })

    pipeline.addStage({
      stageName: 'Deploy_Staging_CDK',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'CDK_Deploy_Staging',
          project:    stagingCdkDeploy,
          input:      buildArtifact,
        }),
      ],
    })

    pipeline.addStage({
      stageName: 'Deploy_Staging_UI',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'UI_Deploy_Staging',
          project:    stagingUiDeploy,
          input:      buildArtifact,
        }),
      ],
    })

    pipeline.addStage({
      stageName: 'Integration_Tests',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'Run_Integration_Tests',
          project:    integrationTestProject,
          input:      buildArtifact,
        }),
      ],
    })

    pipeline.addStage({
      stageName: 'Approve_Production',
      actions: [
        new actions.ManualApprovalAction({
          actionName:            'Approve_Production_Deploy',
          notificationTopic:     approvalTopic,
          additionalInformation: 'Staging deploy complete. Review and approve to deploy to production.',
        }),
      ],
    })

    pipeline.addStage({
      stageName: 'Deploy_Production_CDK',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'CDK_Deploy_Production',
          project:    prodCdkDeploy,
          input:      buildArtifact,
        }),
      ],
    })

    pipeline.addStage({
      stageName: 'Deploy_Production_UI',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'UI_Deploy_Production',
          project:    prodUiDeploy,
          input:      buildArtifact,
        }),
      ],
    })

    pipeline.role.addToPrincipalPolicy(new iam.PolicyStatement({
      effect:    iam.Effect.ALLOW,
      actions:   ['codestar-connections:UseConnection', 'codeconnections:UseConnection'],
      resources: [props.codeStarConnectionArn],
    }))
  }
}
