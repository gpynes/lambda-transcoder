import { S3 } from 'aws-sdk'
import ffmpeg from 'fluent-ffmpeg'
import { Readable, PassThrough, finished } from 'stream'
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
    console.log('TRANSCODING', JSON.stringify(event, null, 2))
    
    const inputStream = s3.getObject({
        Key: event.Key,
        Bucket: event.Bucket
    }).createReadStream()
    const outputStream = new PassThrough()
    const outputFileName = outputName(event) + '.mp4'
    
    console.log('1')
    const command = ffmpeg(inputStream)
        .inputFormat('mov')
        .setStartTime(event.start)
        .setDuration(event.end - event.start)
        .format('mp4')
        .outputOption('-movflags', 'frag_keyframe+empty_moov')
        
    console.log('COMMAND', JSON.stringify(command._getArguments(), null, 2))
    
    // Pipe ffmpeg -> passThrough for output
    command.stream(outputStream)
    command.on('progress', d => console.log('PROGRESS', JSON.stringify(d, null, 2)))
    command.on('end', console.log)

    const upload = s3.upload({
        Key: outputFileName,
        Bucket: event.Bucket,
        Body: outputStream,
    })

    upload.on('httpUploadProgress', (progress) => console.log(`${progress.loaded / progress.total}% progress uploaded -- `, JSON.stringify(progress, null, 2)))

    const response = await upload.promise()

    console.log('UPLOADED', JSON.stringify(response, null, 2))
    
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`The script uses approximately ${used} MB`);
    const used2 = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`The script uses approximately ${used2} MB`);
    return {
        ...event,
        outputFileName
    }
}

export type AssemblerHandlerProps  = TranscodePartHandlerProps & {
    outputFileName: string
}
export const assemblerHandler = async (event: AssemblerHandlerProps[]) => {
    console.log('ASSEMBLING PARTS', JSON.stringify(event, null, 2))
}




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

function outputName(event: TranscodePartHandlerProps) {
    return `${event.start}-${event.end}-${event.Key}`
}