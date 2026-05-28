import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import { Construct } from 'constructs'

export interface FrontendStackProps extends cdk.StackProps {
  stage: 'staging' | 'prod'
  domainName?: string
  certificateArn?: string
}

/**
 * S3 + CloudFront for the Next.js static export.
 *
 * Architecture:
 *   Browser → CloudFront (HTTPS) → S3 (private bucket via OAC)
 *
 * SPA routing:
 *   S3 returns 403/404 for unknown paths → CloudFront rewrites to /index.html (200)
 */
export class FrontendStack extends cdk.Stack {
  public readonly distributionDomainName: string
  public readonly distributionId: string
  public readonly bucketName: string

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props)

    cdk.Tags.of(this).add('project', 'xpt_inventory')
    cdk.Tags.of(this).add('stage', props.stage)

    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName:           `xpt-inv-frontend-${props.stage}-${this.account}`,
      blockPublicAccess:    s3.BlockPublicAccess.BLOCK_ALL,
      versioned:            true,
      removalPolicy:        cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects:    false,
      enforceSSL:           true,
    })

    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      description: `xpt-inv OAC for ${props.stage}`,
      signing:     cloudfront.Signing.SIGV4_NO_OVERRIDE,
    })

    // CloudFront Function: rewrite directory paths to page-specific index.html
    const urlRewriteFn = new cloudfront.Function(this, 'UrlRewrite', {
      functionName: `xpt-inv-url-rewrite-${props.stage}`,
      runtime:      cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var uri = event.request.uri;
  if (uri.includes('.')) return event.request;
  if (uri.length > 1 && uri.endsWith('/')) {
    uri = uri.slice(0, -1);
  }
  event.request.uri = (uri === '' || uri === '/') ? '/index.html' : uri + '/index.html';
  return event.request;
}
`),
    })

    const certificate = props.certificateArn
      ? acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn)
      : undefined

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment:           `xpt-inv-frontend-${props.stage}`,
      defaultRootObject: 'index.html',
      ...(props.domainName && certificate ? {
        domainNames: [props.domainName],
        certificate,
      } : {}),
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy:          cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods:       cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        functionAssociations: [{
          function:  urlRewriteFn,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      errorResponses: [
        {
          httpStatus:         403,
          responseHttpStatus: 200,
          responsePagePath:   '/index.html',
          ttl:                cdk.Duration.seconds(0),
        },
        {
          httpStatus:         404,
          responseHttpStatus: 200,
          responsePagePath:   '/index.html',
          ttl:                cdk.Duration.seconds(0),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    })

    this.distributionDomainName = distribution.distributionDomainName
    this.distributionId         = distribution.distributionId
    this.bucketName             = bucket.bucketName

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value:       distribution.distributionDomainName,
      exportName:  `xpt-inv-cf-domain-${props.stage}`,
    })

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value:       distribution.distributionId,
      exportName:  `xpt-inv-cf-id-${props.stage}`,
    })

    new cdk.CfnOutput(this, 'BucketName', {
      value:       bucket.bucketName,
      exportName:  `xpt-inv-bucket-name-${props.stage}`,
    })
  }
}
