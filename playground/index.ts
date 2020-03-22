import { spawn, execSync, ChildProcessWithoutNullStreams } from 'child_process'
import { writeFileSync } from 'fs'
import { finished } from 'stream'
import { promisify } from 'util'
const streamFinished = promisify(finished)

execSync('rm -rf ./test.mp4')

function ffmpeg(command: string[]) {
    const ffmpeg = spawn('ffmpeg', command)
    return ffmpeg
}

function writePart(start, end, inputName, outputName) {
    const partName = `${start}-${end}-${outputName}`
    const stream = ffmpeg([
        '-i',
        inputName,
        '-ss',
        start.toString(),
        '-to',
        end.toString(),
        partName,
    ]) as StreamWithName

    stream.partName = partName

    return stream
    type StreamWithName = ChildProcessWithoutNullStreams & { partName: string }
}

function concat(output: string, ...files: string[]) {
    const data = files.reduce((data, filename) => `${data}file '${filename}'\n`, '')
    const fileName = 'files.txt'
    writeFileSync(fileName, data)

    return ffmpeg([
        '-f',
        'concat',
        '-i',
        fileName,
        output
    ])
}
    

const inputName = './test.mov'
const outputName = 'test.mp4'
// writePart(0, 5, inputName, 'test.mp4')
// writePart(5, 10, inputName, 'test.mp4')

const streams = [
    [0, 5],
    [5, 10],
    [10, 15],
    [15, 20],
    [20, 25]
]
.map(([start, end]) => writePart(start, end, inputName, outputName))


async function main() {
    console.time('ASYNC RUN')
    try {
        await Promise.all(streams.map(stream => streamFinished(stream.stdout)))
        await streamFinished(concat('test.mp4', ...streams.map(stream => stream.partName)).stdout)
    } catch(err) {
        console.log('Error Happened', err)
    }
    console.timeEnd('ASYNC RUN')
}

main()