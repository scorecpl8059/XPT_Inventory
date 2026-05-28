/**
 * API Gateway v2 (HTTP API) + Lambda functions for XPT-Inventory.
 *
 * All org-scoped endpoints live under /organizations/{orgId}/...
 * The withOrgAuth middleware verifies the caller's membership for each request.
 *
 * Route groups:
 *   /bootstrap                                — first-login bootstrap
 *   /user/profile                             — user profile
 *   /organizations                            — CRUD organizations
 *   /organizations/{orgId}/members            — member management
 *   /organizations/{orgId}/invitations        — invitation management
 *   /invitations/join                         — accept invitation by code
 *   /organizations/{orgId}/proposals          — proposal workflow
 *   /organizations/{orgId}/products           — product CRUD
 *   /organizations/{orgId}/locations          — warehouse/location management
 *   /organizations/{orgId}/stock              — stock levels
 *   /organizations/{orgId}/movements          — stock movements
 *   /organizations/{orgId}/tickets            — support tickets (org-scoped)
 *   /tickets/{id}                             — ticket detail + messages
 *   /organizations/{orgId}/billing            — Stripe billing
 *   /webhooks/stripe                          — Stripe webhook
 *   /admin/*                                  — system admin endpoints
 */
import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import * as path from 'path'

export interface ApiStackProps extends cdk.StackProps {
  stage:           'staging' | 'prod'
  usersTable:      dynamodb.Table
  orgsTable:       dynamodb.Table
  productsTable:   dynamodb.Table
  proposalsTable:  dynamodb.Table
  inventoryTable:  dynamodb.Table
  ticketsTable:    dynamodb.Table
  auth0Domain:     string
  auth0Audience:   string
  frontendDomain:  string
  customFrontendDomain?: string
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    cdk.Tags.of(this).add('project', 'xpt_inventory')
    cdk.Tags.of(this).add('stage', props.stage)

    // ── S3 uploads bucket (product images) ─────────────────────────────────
    const uploadBucket = new s3.Bucket(this, 'UploadBucket', {
      bucketName:        `xpt-inv-uploads-${props.stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption:        s3.BucketEncryption.S3_MANAGED,
      versioned:         false,
      lifecycleRules: [{
        expiration: cdk.Duration.days(365 * 7),
      }],
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT],
        allowedOrigins: [
          `https://${props.frontendDomain}`,
          ...(props.customFrontendDomain ? [`https://${props.customFrontendDomain}`] : []),
          'http://localhost:3000',
        ],
        allowedHeaders: ['*'],
        maxAge: 3000,
      }],
    })
    cdk.Tags.of(uploadBucket).add('project', 'xpt_inventory')

    const frontendUrl = props.customFrontendDomain
      ? `https://${props.customFrontendDomain}`
      : `https://${props.frontendDomain}`

    // ── Common environment variables for all Lambdas ────────────────────────
    const commonEnv: Record<string, string> = {
      USERS_TABLE_NAME:     props.usersTable.tableName,
      ORGS_TABLE_NAME:      props.orgsTable.tableName,
      PRODUCTS_TABLE_NAME:  props.productsTable.tableName,
      PROPOSALS_TABLE_NAME: props.proposalsTable.tableName,
      INVENTORY_TABLE_NAME: props.inventoryTable.tableName,
      TICKETS_TABLE_NAME:   props.ticketsTable.tableName,
      AUTH0_DOMAIN:         props.auth0Domain,
      AUTH0_AUDIENCE:       props.auth0Audience,
      UPLOAD_BUCKET_NAME:   uploadBucket.bucketName,
      FRONTEND_URL:         frontendUrl,
      NODE_ENV:             props.stage === 'prod' ? 'production' : 'staging',
    }

    // Helper: create a Lambda function
    const fn = (id: string, handlerPath: string, extraEnv?: Record<string, string>) =>
      new lambda.Function(this, `${id}Fn`, {
        runtime:      lambda.Runtime.NODEJS_20_X,
        timeout:      cdk.Duration.seconds(30),
        memorySize:   256,
        environment:  { ...commonEnv, ...extraEnv },
        functionName: `xpt-inv-${handlerPath.replace(/\//g, '-')}-${props.stage}`,
        code: lambda.Code.fromAsset(
          path.join(__dirname, '..', '..', '..', 'backend', 'dist', 'handlers', handlerPath)
        ),
        handler: 'index.handler',
      })

    // ── Lambda functions ───────────────────────────────────────────────────
    const handlers = {
      // Bootstrap
      bootstrap:         fn('Bootstrap',       'bootstrap/seed'),

      // User profile
      userGetProfile:    fn('UserGetProfile',  'user/getProfile'),
      userUpdateProfile: fn('UserUpdateProfile', 'user/updateProfile'),

      // Organizations
      orgCreate:         fn('OrgCreate',       'organizations/create'),
      orgList:           fn('OrgList',         'organizations/list'),
      orgGet:            fn('OrgGet',          'organizations/get'),
      orgUpdate:         fn('OrgUpdate',       'organizations/update'),

      // Members
      memList:           fn('MemList',         'members/list'),
      memUpdateRole:     fn('MemUpdateRole',   'members/updateRole'),
      memRemove:         fn('MemRemove',       'members/remove'),

      // Invitations
      invCreate:         fn('InvCreate',       'invitations/create'),
      invList:           fn('InvList',         'invitations/list'),
      invJoin:           fn('InvJoin',         'invitations/join'),

      // Proposals
      propCreate:        fn('PropCreate',      'proposals/create'),
      propList:          fn('PropList',        'proposals/list'),
      propGet:           fn('PropGet',         'proposals/get'),
      propUpdate:        fn('PropUpdate',      'proposals/update'),
      propSubmit:        fn('PropSubmit',      'proposals/submit'),
      propReview:        fn('PropReview',      'proposals/review'),
      propApprove:       fn('PropApprove',     'proposals/approve'),
      propReject:        fn('PropReject',      'proposals/reject'),
      propAddComment:    fn('PropAddComment',  'proposals/addComment'),
      propListComments:  fn('PropListComments', 'proposals/listComments'),

      // Products
      prodCreate:        fn('ProdCreate',      'products/create'),
      prodList:          fn('ProdList',        'products/list'),
      prodGet:           fn('ProdGet',         'products/get'),
      prodUpdate:        fn('ProdUpdate',      'products/update'),
      prodDelete:        fn('ProdDelete',      'products/delete'),

      // Locations
      locCreate:         fn('LocCreate',       'locations/create'),
      locList:           fn('LocList',         'locations/list'),
      locUpdate:         fn('LocUpdate',       'locations/update'),
      locDelete:         fn('LocDelete',       'locations/delete'),

      // Stock
      stockList:         fn('StockList',       'stock/list'),
      stockGetByProduct: fn('StockGetByProd',  'stock/getByProduct'),

      // Movements
      movCreate:         fn('MovCreate',       'movements/create'),
      movList:           fn('MovList',         'movements/list'),

      // Tickets (org-scoped)
      tktCreate:         fn('TktCreate',       'tickets/create'),
      tktList:           fn('TktList',         'tickets/list'),
      tktGet:            fn('TktGet',          'tickets/get'),
      tktUpdate:         fn('TktUpdate',       'tickets/update'),
      tktAddMessage:     fn('TktAddMsg',       'tickets/addMessage'),
      tktListMessages:   fn('TktListMsg',      'tickets/listMessages'),

      // Billing
      billingCheckout:   fn('BillingCheckout', 'billing/createCheckout'),
      billingGet:        fn('BillingGet',      'billing/getSubscription'),
      billingPortal:     fn('BillingPortal',   'billing/createPortal'),
      billingWebhook:    fn('BillingWebhook',  'billing/stripeWebhook'),

      // Admin
      adminListTickets:  fn('AdminTickets',    'admin/listTickets'),
      adminListOrgs:     fn('AdminOrgs',       'admin/listOrganizations'),
      adminAnalytics:    fn('AdminAnalytics',  'admin/analytics'),
    }

    // ── Grant DynamoDB access ─────────────────────────────────────────────
    const allTables = [
      props.usersTable, props.orgsTable, props.productsTable,
      props.proposalsTable, props.inventoryTable, props.ticketsTable,
    ]
    Object.values(handlers).forEach((f) => {
      allTables.forEach((table) => table.grantReadWriteData(f))
    })

    // ── S3 upload permission ──────────────────────────────────────────────
    // TODO: Add upload-url handler when product image upload is implemented
    // uploadBucket.grantPut(handlers.prodUploadUrl)

    // ── SES permission for invitations ────────────────────────────────────
    handlers.invCreate.addToRolePolicy(new iam.PolicyStatement({
      actions:   ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }))

    // ── HTTP API (v2) ──────────────────────────────────────────────────────
    const api = new apigwv2.HttpApi(this, 'Api', {
      apiName: `xpt-inv-api-${props.stage}`,
      corsPreflight: {
        allowOrigins: [
          `https://${props.frontendDomain}`,
          ...(props.customFrontendDomain ? [`https://${props.customFrontendDomain}`] : []),
          'http://localhost:3000',
        ],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge:       cdk.Duration.days(1),
      },
    })

    // Helper: add a route
    const route = (
      method: apigwv2.HttpMethod,
      routePath: string,
      handler: lambda.Function
    ) =>
      api.addRoutes({
        methods:     [method],
        path:        routePath,
        integration: new integrations.HttpLambdaIntegration(
          `${routePath.replace(/[/{}]/g, '-')}-${method}`,
          handler
        ),
      })

    // ── Routes ─────────────────────────────────────────────────────────────

    // Bootstrap
    route(apigwv2.HttpMethod.POST,   '/bootstrap',                                          handlers.bootstrap)

    // User profile
    route(apigwv2.HttpMethod.GET,    '/user/profile',                                       handlers.userGetProfile)
    route(apigwv2.HttpMethod.PATCH,  '/user/profile',                                       handlers.userUpdateProfile)

    // Organizations
    route(apigwv2.HttpMethod.POST,   '/organizations',                                      handlers.orgCreate)
    route(apigwv2.HttpMethod.GET,    '/organizations',                                      handlers.orgList)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}',                               handlers.orgGet)
    route(apigwv2.HttpMethod.PATCH,  '/organizations/{orgId}',                               handlers.orgUpdate)

    // Members
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/members',                       handlers.memList)
    route(apigwv2.HttpMethod.PATCH,  '/organizations/{orgId}/members/{memberId}',            handlers.memUpdateRole)
    route(apigwv2.HttpMethod.DELETE, '/organizations/{orgId}/members/{memberId}',            handlers.memRemove)

    // Invitations
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/invitations',                   handlers.invCreate)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/invitations',                   handlers.invList)
    route(apigwv2.HttpMethod.POST,   '/invitations/join',                                    handlers.invJoin)

    // Proposals
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/proposals',                     handlers.propCreate)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/proposals',                     handlers.propList)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/proposals/{id}',                handlers.propGet)
    route(apigwv2.HttpMethod.PATCH,  '/organizations/{orgId}/proposals/{id}',                handlers.propUpdate)
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/proposals/{id}/submit',         handlers.propSubmit)
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/proposals/{id}/review',         handlers.propReview)
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/proposals/{id}/approve',        handlers.propApprove)
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/proposals/{id}/reject',         handlers.propReject)
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/proposals/{id}/comments',       handlers.propAddComment)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/proposals/{id}/comments',       handlers.propListComments)

    // Products
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/products',                      handlers.prodCreate)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/products',                      handlers.prodList)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/products/{id}',                 handlers.prodGet)
    route(apigwv2.HttpMethod.PATCH,  '/organizations/{orgId}/products/{id}',                 handlers.prodUpdate)
    route(apigwv2.HttpMethod.DELETE, '/organizations/{orgId}/products/{id}',                 handlers.prodDelete)

    // Locations
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/locations',                     handlers.locCreate)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/locations',                     handlers.locList)
    route(apigwv2.HttpMethod.PATCH,  '/organizations/{orgId}/locations/{id}',                handlers.locUpdate)
    route(apigwv2.HttpMethod.DELETE, '/organizations/{orgId}/locations/{id}',                handlers.locDelete)

    // Stock
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/stock',                         handlers.stockList)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/stock/{productId}',             handlers.stockGetByProduct)

    // Movements
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/movements',                     handlers.movCreate)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/movements',                     handlers.movList)

    // Tickets (org-scoped creation + listing)
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/tickets',                       handlers.tktCreate)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/tickets',                       handlers.tktList)
    // Tickets (direct access by ID — for both org users and admins)
    route(apigwv2.HttpMethod.GET,    '/tickets/{id}',                                        handlers.tktGet)
    route(apigwv2.HttpMethod.PATCH,  '/tickets/{id}',                                        handlers.tktUpdate)
    route(apigwv2.HttpMethod.POST,   '/tickets/{id}/messages',                               handlers.tktAddMessage)
    route(apigwv2.HttpMethod.GET,    '/tickets/{id}/messages',                               handlers.tktListMessages)

    // Billing
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/billing/checkout',              handlers.billingCheckout)
    route(apigwv2.HttpMethod.GET,    '/organizations/{orgId}/billing',                       handlers.billingGet)
    route(apigwv2.HttpMethod.POST,   '/organizations/{orgId}/billing/portal',                handlers.billingPortal)
    route(apigwv2.HttpMethod.POST,   '/webhooks/stripe',                                     handlers.billingWebhook)

    // Admin
    route(apigwv2.HttpMethod.GET,    '/admin/tickets',                                       handlers.adminListTickets)
    route(apigwv2.HttpMethod.GET,    '/admin/organizations',                                 handlers.adminListOrgs)
    route(apigwv2.HttpMethod.GET,    '/admin/analytics',                                     handlers.adminAnalytics)

    this.apiUrl = api.apiEndpoint

    new cdk.CfnOutput(this, 'ApiUrl', {
      value:       api.apiEndpoint,
      description: 'API Gateway endpoint URL',
      exportName:  `xpt-inv-api-url-${props.stage}`,
    })
  }
}
