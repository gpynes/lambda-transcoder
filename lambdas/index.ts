import { S3 } from 'aws-sdk'
import * as ffmpeg from 'fluent-ffmpeg'
import { ReadStream } from 'fs'
import { Readable } from 'stream'
import { Duration } from '@aws-cdk/core'

const s3 = new S3()
const SPLIT_SIZE = 5
export interface ProbeHandlerProps {
    Key: string
    Bucket: string
}
export const probeHandler = async (event: ProbeHandlerProps): Promise<TranscodePartHandlerProps[]> => {
    console.log('PROBING', JSON.stringify(event, null, 2))
    const fileStream = s3.getObject(event).createReadStream()
    const output = await probe(fileStream)
    console.log('PROBE', JSON.stringify(output, null, 2))
    const parts = getPartsFromDuration(SPLIT_SIZE, output.format.duration)
    console.log('PART SIZE', SPLIT_SIZE, 'PARTS COUNT', parts.length)
    console.log('PARTS', JSON.stringify(parts, null, 2))

    return parts.map(part => ({
        ...part,
        ...event,
        probe: output
    }))
}

export type TranscodePartHandlerProps = TranscodePartTime & ProbeHandlerProps & {
    probe: ffmpeg.FfprobeData
}
export const transcodePartHandler = async (event: TranscodePartHandlerProps) => {
    
}

export interface AssemblerHandlerProps {}
export const assemblerHandler = async (event: AssemblerHandlerProps) => {}




// Helpers
function probe(input: string | Readable): Promise<ffmpeg.FfprobeData> {
    return new Promise((res, rej) => {
        ffmpeg(input).ffprobe((err, data) => {
            if (err) {
                return rej(err)
            }
            res(data)
        })
    })
}

interface TranscodePartTime { start: number, end: number }
function getPartsFromDuration(partSize: number, duration?: number): TranscodePartTime[] {
    const amountOfPartsToSplitInto = Math.ceil(Number(duration) / partSize)
    return new Array(amountOfPartsToSplitInto).fill(0).map((_, idx) => ({
        start: idx * partSize,
        end: idx * partSize + partSize
    }))
}
