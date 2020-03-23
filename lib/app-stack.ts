import { Stack, Construct, Duration } from '@aws-cdk/core'
import { Map, StateMachine, Task } from '@aws-cdk/aws-stepfunctions'
import { InvokeFunction } from '@aws-cdk/aws-stepfunctions-tasks'
import { Bucket } from '@aws-cdk/aws-s3'
import { TranscodeLambda } from './TranscodeLambda'

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
      memorySize: 2048
    })

    // S3 Bucket
    const sourceBucket = new Bucket(this, 'SourceBucket')
    sourceBucket.grantRead(probeHandler)
    sourceBucket.grantReadWrite(transcodePartHandler)
    sourceBucket.grantReadWrite(assemblerHandler)


    // Step Function Parts
    const probeTask = new Task(this, 'ProbeTask', {
      task: new InvokeFunction(probeHandler),
    })
    const assemblePartsTask = new Task(this, 'AssemblePartsTask', {
      task: new InvokeFunction(assemblerHandler),
    })
    const transcodePartTask = new Task(this, 'TranscodePartTask', {
      task: new InvokeFunction(transcodePartHandler),
    })
    
    
    // Step Function State Machine
    const transcodePartsTask = new Map(this, 'TranscodeParts')
    transcodePartsTask.iterator(transcodePartTask)
    const definition = probeTask.next(transcodePartsTask).next(assemblePartsTask)
    const stateMachine = new StateMachine(this, 'ElasticTranscodeMachine', {
      definition,
      timeout: Duration.minutes(3),
    })
  }
}
