import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as logs from "aws-cdk-lib/aws-logs"
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudFront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as s3Deploy from "aws-cdk-lib/aws-s3-deployment";
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kendra from 'aws-cdk-lib/aws-kendra';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as rekognition from 'aws-cdk-lib/aws-rekognition';

const region = process.env.CDK_DEFAULT_REGION;    
const debug = false;
const stage = 'dev';
const s3_prefix = 'docs';
const projectName = `puppy-counseling`; 
const bucketName = `storage-for-${projectName}-${region}`; 


export class CdkPuppyCounselingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // s3 
    const s3Bucket = new s3.Bucket(this, `storage-${projectName}`,{
      bucketName: bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
      versioned: false,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ['*'],
        },
      ],
    });
    if(debug) {
      new cdk.CfnOutput(this, 'bucketName', {
        value: s3Bucket.bucketName,
        description: 'The nmae of bucket',
      });
      new cdk.CfnOutput(this, 's3Arn', {
        value: s3Bucket.bucketArn,
        description: 'The arn of s3',
      });
      new cdk.CfnOutput(this, 's3Path', {
        value: 's3://'+s3Bucket.bucketName,
        description: 'The path of s3',
      });
    }

    // copy web application files into s3 bucket
    new s3Deploy.BucketDeployment(this, `upload-HTML-for-${projectName}`, {
      sources: [s3Deploy.Source.asset("../html/")],
      destinationBucket: s3Bucket,
    });        
    new cdk.CfnOutput(this, 'HtmlUpdateCommend', {
      value: 'aws s3 cp ../html/ ' + 's3://' + s3Bucket.bucketName + '/ --recursive',
      description: 'copy commend for web pages',
    });

    // cloudfront
    const distribution = new cloudFront.Distribution(this, `cloudfront-for-${projectName}`, {
      defaultBehavior: {
        origin: new origins.S3Origin(s3Bucket),
        allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
        viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      priceClass: cloudFront.PriceClass.PRICE_CLASS_200,  
    });
    new cdk.CfnOutput(this, `distributionDomainName-for-${projectName}`, {
      value: distribution.domainName,
      description: 'The domain name of the Distribution',
    });

    // DynamoDB for call log
    const counselingTableName = `db-call-log-for-${projectName}`;
    const counselingDataTable = new dynamodb.Table(this, `db-call-log-for-${projectName}`, {
      tableName: counselingTableName,
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'request_time', type: dynamodb.AttributeType.STRING }, 
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const counselingIndexName = `index-type-for-${projectName}`;
    counselingDataTable.addGlobalSecondaryIndex({ // GSI
      indexName: counselingIndexName,
      partitionKey: { name: 'request_id', type: dynamodb.AttributeType.STRING },
    });

    // collection of rekognition
    const collectionId = `collectionId-for-${projectName}`;
    const cfnCollection = new rekognition.CfnCollection(this, 'MyCfnCollection', {
      collectionId: collectionId,
    });
    if (debug) {
      new cdk.CfnOutput(this, 'Collection-attrArn', {
        value: cfnCollection.attrArn,
        description: 'The arn of correction in Rekognition',
      }); 
    }

    // API Gateway
    const role = new iam.Role(this, `api-role-for-${projectName}`, {
      roleName: `api-role-for-${projectName}`,
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com")
    });
    role.addToPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['lambda:InvokeFunction']
    }));
    role.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/AWSLambdaExecute',
    });
    
    const api = new apiGateway.RestApi(this, `api-gw-for-${projectName}`, {
      description: `API Gateway for ${projectName}`,
      endpointTypes: [apiGateway.EndpointType.REGIONAL],
      binaryMediaTypes: ['*/*'],
      deployOptions: {
        stageName: stage,

        // logging for debug
        // loggingLevel: apiGateway.MethodLoggingLevel.INFO,
        // dataTraceEnabled: true,
      },
    });

    // Lambda - emotion
    const lambdaEmotion = new lambda.Function(this, "lambdaEmotion", {
      runtime: lambda.Runtime.NODEJS_16_X,
      functionName: "lambda-emotion",
      code: lambda.Code.fromAsset("../lambda-emotion"),
      handler: "index.handler",
      timeout: cdk.Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        bucketName: s3Bucket.bucketName,
        collectionId: collectionId
      }
    });
    s3Bucket.grantReadWrite(lambdaEmotion);
    //userDataTable.grantReadWriteData(lambdaEmotion); // permission for dynamo

    const RekognitionPolicy = new iam.PolicyStatement({
      actions: ['rekognition:*'],
      resources: ['*'],
    });
    lambdaEmotion.role?.attachInlinePolicy(
      new iam.Policy(this, 'rekognition-policy', {
        statements: [RekognitionPolicy],
      }),
    );    

    // POST method
    const resourceName = "emotion";
    const emotion = api.root.addResource(resourceName);
    emotion.addMethod('POST', new apiGateway.LambdaIntegration(lambdaEmotion, {
      passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      credentialsRole: role,
      integrationResponses: [{
        statusCode: '200',
      }],
      proxy: true,
    }), {
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          },
        }
      ]
    });

    // cloudfront setting for api gateway of emotion
    distribution.addBehavior("/emotion", new origins.RestApiOrigin(api), {
      cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });

    new cdk.CfnOutput(this, 'Enabler', {
      value: 'https://' + distribution.domainName + '/enabler.html',
      description: 'url of enabler',
    });     
  }
}
