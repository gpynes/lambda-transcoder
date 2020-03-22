import { pipeline, finished } from 'stream'
import { promisify } from 'util'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { resolve } from 'path'
import { createReadStream, createWriteStream } from 'fs'

// const pipe = promisify(pipeline)

// function ffmpeg(command: string[]) {
//   const ffmpeg = spawn('ffmpeg', command)
//   return ffmpeg
// }

// function writePart(start: number, end: number, format: string) {
//   const args = [
//     '-f',
//     format,
//     '-i',
//     'pipe:0',
//     // '-ss',
//     // start.toString(),
//     // '-to',
//     // end.toString(),
//     'meep.mp4'
//     // '-f',
//     // 'mp4',
//     // 'pipe:',
//   ]
//   console.log(args.join(' '))
//   const stream = ffmpeg(args)

// //   stream.stdin.on('error', (err) => {
// //     if (err.message.includes('ECONNRESET') || err.message.includes('EPIPE')) return
// //     stream.emit('error', err)
// //   })

//   stream.stdin.on('data', console.log)

//   return stream
// }

// const format_name = 'mov'
// const input = createReadStream(resolve(__dirname, 'test.mov'))
// const output = createWriteStream('part.mp4')

// const probe = writePart(0, 100, 'mov')
// // probe.stdout.on('data', console.log)
// // probe.stdout.pipe(output)
// // input.pipe(probe.stdin)
// // input.on('data', console.log)
// // probe.stdin.on('data', console.log)
// input.pipe(probe.stdin)

function spawnFfmpeg(format) {
    const args = ['-f', format, '-i', 'pipe:0', '-c:a', 'aac', '-movflags', 'pipe:1']

    const ffmpeg = spawn('ffmpeg', args)

    console.log('Spawning ffmpeg ' + args.join(' '))

    // @ts-ignore
    // ffmpeg.finished = new Promise((res, rej) => {
    //     ffmpeg.on('exit', res)
    // })

    ffmpeg.stderr.on('data', function(data) {
      console.log('grep stderr: ' + data)
    })

    return ffmpeg
}

const input = createReadStream(resolve(__dirname, 'test.mov'))
const output = createWriteStream('part.mp4')
const probe = spawnFfmpeg('mov')

probe.stdout.pipe(output)
input.pipe(probe.stdin)