import { Stack, Construct, Duration } from '@aws-cdk/core'
import { Map, StateMachine, Task } from '@aws-cdk/aws-stepfunctions'
import { InvokeFunction } from '@aws-cdk/aws-stepfunctions-tasks'
import { Bucket, EventType } from '@aws-cdk/aws-s3'
import { S3EventSource } from '@aws-cdk/aws-lambda-event-sources'
import { TranscodeLambda } from './TranscodeLambda'
import { S3CreateEvent } from 'aws-lambda'
import { InlineCode, Function, Runtime } from '@aws-cdk/aws-lambda'

export class ElasticTranscode extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    // Lambdas
    const probeHandler = new TranscodeLambda(this, 'ProbeHandler', {
      handler: 'probeHandler',
      timeout: Duration.minutes(2),
      memorySize: 2048
    })
    const transcodePartHandler = new TranscodeLambda(this, 'TranscodePartHandler',{
      handler : 'transcodePartHandler',
      timeout: Duration.minutes(3),
      memorySize: 2048
    })
    const assemblerHandler = new TranscodeLambda(this, 'AssemblerHandler', {
      handler: 'assemblerHandler',
      timeout: Duration.minutes(3),
      memorySize: 3008
    })
    const cleanupHandler = new TranscodeLambda(this, 'CleanUpHandler', {
      handler: 'cleanupHandler',
      timeout: Duration.minutes(1),
      memorySize: 128
    })

    // S3 Bucket
    const sourceBucket = new Bucket(this, 'SourceBucket')
    sourceBucket.grantRead(probeHandler)
    sourceBucket.grantReadWrite(transcodePartHandler)
    sourceBucket.grantReadWrite(assemblerHandler)
    sourceBucket.grantDelete(cleanupHandler)


    // Step Function Parts
    const probeTask = new Task(this, 'ProbeTask', {
      task: new InvokeFunction(probeHandler),
    })

    const transcodePartTask = new Task(this, 'TranscodePartTask', {
      task: new InvokeFunction(transcodePartHandler),
    })
    const transcodePartsTask = new Map(this, 'TranscodeParts')
    transcodePartsTask.iterator(transcodePartTask)
    
    const assemblePartsTask = new Task(this, 'AssemblePartsTask', {
      task: new InvokeFunction(assemblerHandler),
    })
    const cleanUpTask = new Task(this, 'CleanUpTask', {
      task: new InvokeFunction(cleanupHandler),
    })
    
    // Step Function State Machine
    const definition = probeTask.next(transcodePartsTask).next(assemblePartsTask).next(cleanUpTask)
    const stateMachine = new StateMachine(this, 'TranscodeMachine', {
      definition,
      timeout: Duration.minutes(3),
    })

    // S3 Bucket Upload Trigger
    const onUploadEvent = new S3EventSource(sourceBucket, {
      events: [
        EventType.OBJECT_CREATED,
      ],
      filters: [{
        prefix: 'source/'
      }]
    })

    const onUploadInitTranscode = new Function(this, 'OnUploadInitTranscodeHandler', {
      code: new InlineCode(`
        module.exports.handler = ${onUploadInitTranscodeHandler.toString()
          // Replace the code string of the statemachine arn with the actual arn
          .replace('stateMachine.stateMachineArn', `'${stateMachine.stateMachineArn}'`)}
      `),
      handler: 'index.handler',
      runtime: Runtime.NODEJS_12_X,
      timeout: Duration.seconds(10)
    })
    // Allow Init to start the step function
    stateMachine.grantStartExecution(onUploadInitTranscode)
    
    // Connect the s3 lifecycle event to transcode init handler
    onUploadInitTranscode.addEventSource(onUploadEvent)

    // Handler Definition
    async function onUploadInitTranscodeHandler(event: S3CreateEvent) {
      try {
        const { StepFunctions } = require('aws-sdk')
        const step = new StepFunctions()
        const { bucket, object } = event.Records[0].s3
        const Bucket = bucket.name
        const Key = object.key
        const stateMachineArn = stateMachine.stateMachineArn
        
        console.log('Initializing', stateMachineArn)
        console.log('WITH', Bucket, Key)
        
        return step.startExecution({
          stateMachineArn,
          input: JSON.stringify({ Bucket, Key })
        }).promise()
      } catch(err) {
        console.log('Error', err)
      }
    }
  }
}
