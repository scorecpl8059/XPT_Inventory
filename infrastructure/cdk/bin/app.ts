#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { ConfigStack }       from '../lib/config-stack'
import { UsersDbStack }      from '../lib/users-db-stack'
import { OrgsDbStack }       from '../lib/orgs-db-stack'
import { ProductsDbStack }   from '../lib/products-db-stack'
import { ProposalsDbStack }  from '../lib/proposals-db-stack'
import { InventoryDbStack }  from '../lib/inventory-db-stack'
import { TicketsDbStack }    from '../lib/tickets-db-stack'
import { FrontendStack }     from '../lib/frontend-stack'
import { ApiStack }          from '../lib/api-stack'
import { PipelineStack }     from '../lib/pipeline-stack'

const app = new cdk.App()

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? '322337309000',
  region:  process.env.AWS_REGION ?? 'us-east-1',
}

// ── Auth0 config ──────────────────────────────────────────────────────────
// TODO: Update these after creating the Auth0 application for XPT-Inventory
const auth0Domain   = process.env.AUTH0_DOMAIN   ?? 'xpt-tech.us.auth0.com'
const auth0Audience = process.env.AUTH0_AUDIENCE  ?? 'https://api.inv.xpt-tech.com'
const auth0ClientId = process.env.AUTH0_CLIENT_ID ?? 'xtQxCfEJ8hZ4Io6sisEsbZUkIAw0ocFO'

// ── GitHub / CodeStar config ──────────────────────────────────────────────
const githubOwner           = process.env.GITHUB_OWNER            ?? 'scorecpl8059'
const githubRepo            = process.env.GITHUB_REPO             ?? 'XPT_Inventory'
const codeStarConnectionArn = process.env.CODESTAR_CONNECTION_ARN ?? 'arn:aws:codeconnections:us-east-1:322337309000:connection/b81c81e2-9fc5-4d62-8877-c01880d32229'
const notificationEmail     = process.env.NOTIFICATION_EMAIL      ?? 'peiling.cai@xpt-tech.com'

// ── SSM config parameters ─────────────────────────────────────────────────
new ConfigStack(app, 'XptInvConfigStack', {
  env,
  description:   'xpt-inv SSM parameters for Auth0 config',
  auth0Domain,
  auth0ClientId,
  auth0Audience,
})

// ── Staging infrastructure ────────────────────────────────────────────────

const stagingUsersDb     = new UsersDbStack(app, 'XptInvUsersDbStagingStack',     { env, stage: 'staging', description: 'xpt-inv users table (staging)' })
const stagingOrgsDb      = new OrgsDbStack(app, 'XptInvOrgsDbStagingStack',       { env, stage: 'staging', description: 'xpt-inv orgs table (staging)' })
const stagingProductsDb  = new ProductsDbStack(app, 'XptInvProductsDbStagingStack', { env, stage: 'staging', description: 'xpt-inv products table (staging)' })
const stagingProposalsDb = new ProposalsDbStack(app, 'XptInvProposalsDbStagingStack', { env, stage: 'staging', description: 'xpt-inv proposals table (staging)' })
const stagingInventoryDb = new InventoryDbStack(app, 'XptInvInventoryDbStagingStack', { env, stage: 'staging', description: 'xpt-inv inventory table (staging)' })
const stagingTicketsDb   = new TicketsDbStack(app, 'XptInvTicketsDbStagingStack',   { env, stage: 'staging', description: 'xpt-inv tickets table (staging)' })

const stagingFrontend = new FrontendStack(app, 'XptInvFrontendStagingStack', {
  env,
  stage:       'staging',
  description: 'xpt-inv S3 + CloudFront (staging)',
})

const stagingApi = new ApiStack(app, 'XptInvApiStagingStack', {
  env,
  stage:          'staging',
  usersTable:     stagingUsersDb.table,
  orgsTable:      stagingOrgsDb.table,
  productsTable:  stagingProductsDb.table,
  proposalsTable: stagingProposalsDb.table,
  inventoryTable: stagingInventoryDb.table,
  ticketsTable:   stagingTicketsDb.table,
  auth0Domain,
  auth0Audience,
  frontendDomain: stagingFrontend.distributionDomainName,
  description:    'xpt-inv API Gateway + Lambda (staging)',
})

// ── Production infrastructure ─────────────────────────────────────────────

const prodUsersDb     = new UsersDbStack(app, 'XptInvUsersDbProdStack',     { env, stage: 'prod', description: 'xpt-inv users table (production)' })
const prodOrgsDb      = new OrgsDbStack(app, 'XptInvOrgsDbProdStack',       { env, stage: 'prod', description: 'xpt-inv orgs table (production)' })
const prodProductsDb  = new ProductsDbStack(app, 'XptInvProductsDbProdStack', { env, stage: 'prod', description: 'xpt-inv products table (production)' })
const prodProposalsDb = new ProposalsDbStack(app, 'XptInvProposalsDbProdStack', { env, stage: 'prod', description: 'xpt-inv proposals table (production)' })
const prodInventoryDb = new InventoryDbStack(app, 'XptInvInventoryDbProdStack', { env, stage: 'prod', description: 'xpt-inv inventory table (production)' })
const prodTicketsDb   = new TicketsDbStack(app, 'XptInvTicketsDbProdStack',   { env, stage: 'prod', description: 'xpt-inv tickets table (production)' })

// TODO: Set these after creating the ACM certificate for inv.xpt-tech.com
// const prodDomainName   = 'inv.xpt-tech.com'
// const prodCertificateArn = 'arn:aws:acm:us-east-1:322337309000:certificate/XXXXXXXX'

const prodFrontend = new FrontendStack(app, 'XptInvFrontendProdStack', {
  env,
  stage:       'prod',
  // domainName:     prodDomainName,
  // certificateArn: prodCertificateArn,
  description: 'xpt-inv S3 + CloudFront (production)',
})

const prodApi = new ApiStack(app, 'XptInvApiProdStack', {
  env,
  stage:          'prod',
  usersTable:     prodUsersDb.table,
  orgsTable:      prodOrgsDb.table,
  productsTable:  prodProductsDb.table,
  proposalsTable: prodProposalsDb.table,
  inventoryTable: prodInventoryDb.table,
  ticketsTable:   prodTicketsDb.table,
  auth0Domain,
  auth0Audience,
  frontendDomain: prodFrontend.distributionDomainName,
  // customFrontendDomain: prodDomainName,
  description:    'xpt-inv API Gateway + Lambda (production)',
})

// ── CI/CD Pipeline ────────────────────────────────────────────────────────
new PipelineStack(app, 'XptInvPipelineStack', {
  env,
  description: 'xpt-inv CodePipeline CI/CD',

  githubOwner,
  githubRepo,
  githubBranch:          'main',
  codeStarConnectionArn,
  notificationEmail,

  stagingBucketName:     stagingFrontend.bucketName,
  stagingDistributionId: stagingFrontend.distributionId,
  stagingApiUrl:         stagingApi.apiUrl,

  prodBucketName:        prodFrontend.bucketName,
  prodDistributionId:    prodFrontend.distributionId,
  prodApiUrl:            prodApi.apiUrl,
})
