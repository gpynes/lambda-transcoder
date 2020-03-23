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
    })
    const assemblerHandler = new TranscodeLambda(this, 'AssemblerHandler', {
      handler: 'assemblerHandler'
    })
    const transcodePartHandler = new TranscodeLambda(this, 'TranscodePartHandler',{
      handler : 'transcodePartHandler',
      timeout: Duration.minutes(3),
      memorySize: 512
    })

    // S3 Bucket
    const sourceBucket = new Bucket(this, 'SourceBucket')
    sourceBucket.grantRead(probeHandler)
    sourceBucket.grantReadWrite(transcodePartHandler)


    
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

import * as AWS from 'aws-sdk'
import { ReadStream } from 'fs'
import { spawn, execSync, ChildProcessWithoutNullStreams } from 'child_process'
import { PassThrough } from 'stream'
async function probeHandlerFunction(
  { Key, Bucket }: { Key: string; Bucket: string },
  context: any,
) {
  console.log('PROBING', Key, Bucket)
  const { spawn } = require('child_process')
  const aws = require('aws-sdk')
  const s3 = new aws.S3() as AWS.S3

  console.log('PROBE HANDLER', JSON.stringify({ Key, Bucket }, null, 2))
  console.log('PROBE CONTEXT', JSON.stringify(context, null, 2))

  const fileStream = s3
    .getObject({
      Bucket,
      Key,
    })
    .createReadStream()

  const output = await FFprobe(fileStream as ReadStream)
  const parts = new Array(Math.ceil(Number(output.format.duration) / 5))
    .fill(0)
    .map((_, idx) => ({
      start: idx * 5,
      end: (idx + 1) * 5,
      Key,
      Bucket,
      format: output.format.format_name.split(',')[0]
    }))
  return parts
  function FFprobe(source: ReadStream): Promise<FFProbeOutput> {
    return new Promise((res, rej) => {
      const ffprobe = spawn('ffprobe', [
        '-show_streams',
        '-show_format',
        '-print_format',
        'json',
        'pipe:0',
      ])

      ffprobe.stdin.on('error', (err: any) => {
        if (['ECONNRESET', 'EPIPE'].includes(err.code)) return
        rej(err)
      })

      ffprobe.stdin.on('close', () => {
        source.pause()
        source.unpipe(ffprobe.stdin)
      })

      source.pipe(ffprobe.stdin)
      ffprobe.on('error', rej)

      let data = ''
      ffprobe.stdout.on('data', (out: string) => (data += out))
      ffprobe.stdout.on('close', () => res(JSON.parse(data)))
    })
  }
}

async function assemblerHandlerFunction(
  { Key, Bucket, start, end, format }: any,
  context: any,
) {
  const { spawn } = require('child_process')
  const { PassThrough } = require('stream')
  const aws = require('aws-sdk')
  const s3 = new aws.S3() as AWS.S3
  console.log(
    'Assembler HANDLER',
    JSON.stringify({ Key, Bucket, start, end, format }, null, 2),
  )
  console.log('Assembler CONTEXT', JSON.stringify(context, null, 2))
  const partName = `${start}-${end}.mp4`
  const outputStream = new PassThrough()
  
  writePart(start, end, format, partName).stdout.pipe(outputStream)

  await s3.upload({
    Key: partName,
    Bucket,
    Body: outputStream
  }).promise()

  return {
    Key: partName,
    Bucket,
  }

  function ffmpeg(command: string[]) {
    const ffmpeg = spawn('ffmpeg', command)
    return ffmpeg
  }

  function writePart(start: number, end: number, format: string, outputName: any) {
    const partName = `${start}-${end}-${outputName}`
    const stream = ffmpeg([
      '-f',
      format,
      '-i',
      'pipe:',
      '-ss',
      start.toString(),
      '-to',
      end.toString(),
      '-f',
      'mp4',
      'pipe:',
    ]) as StreamWithName

    stream.partName = partName

    return stream
    type StreamWithName = ChildProcessWithoutNullStreams & { partName: string }
  }
}

async function transcodePartHandlerFunction(event: any, context: any) {
  const { spawnSync } = require('child_process')

  const output = spawnSync('ffmpeg')
  console.log(output.status)
  console.log(output.stdout.toString())
  console.log(output.stderr.toString())
  console.log('Transcode Part HANDLER', JSON.stringify(event, null, 2))
  console.log('Transcode Part CONTEXT', JSON.stringify(context, null, 2))
  return {
    event,
    returnVaule: 'from assembler',
  }
}

interface FFProbeOutput {
  streams: Stream[]
  format: Format
}

interface Format {
  filename: string
  nb_streams: number
  nb_programs: number
  format_name: string
  format_long_name: string
  start_time: string
  duration: string
  probe_score: number
  tags: Tags
}

interface Tags {
  major_brand: string
  minor_version: string
  compatible_brands: string
  creation_time: string
}

interface Stream {
  index: number
  codec_name: string
  codec_long_name: string
  profile: string
  codec_type: string
  codec_time_base: string
  codec_tag_string: string
  codec_tag: string
  width?: number
  height?: number
  coded_width?: number
  coded_height?: number
  has_b_frames?: number
  sample_aspect_ratio?: string
  display_aspect_ratio?: string
  pix_fmt?: string
  level?: number
  color_range?: string
  chroma_location?: string
  refs?: number
  is_avc?: string
  nal_length_size?: string
  r_frame_rate: string
  avg_frame_rate: string
  time_base: string
  start_pts: number
  start_time: string
  duration_ts: number
  duration: string
  bit_rate: string
  bits_per_raw_sample?: string
  nb_frames: string
  disposition: Function[]
  tags: Function[]
  sample_fmt?: string
  sample_rate?: string
  channels?: number
  channel_layout?: string
  bits_per_sample?: number
  max_bit_rate?: string
}
