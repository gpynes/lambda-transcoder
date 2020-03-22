import { spawn, spawnSync } from 'child_process'
import { createReadStream, createWriteStream, ReadStream } from 'fs'
import { resolve } from 'path'
import { pipeline, finished as finishedCb, PassThrough, Duplex } from 'stream'
import { promisify } from 'util'
import { Converter } from 'ffmpeg-stream'
import * as ffmpeg from 'fluent-ffmpeg'
const finished = promisify(finishedCb)
const pipe = promisify(pipeline)

const FILE_NAME = resolve(__dirname, 'test.mov')
const input = createReadStream(FILE_NAME)

FFprobe(input)
  .then(console.log)
  .catch(console.log)
// ffmpeg(input).ffprobe((err, data) => {
//     input.emit('end')
//     console.log(data)
// })

function FFprobe(source: ReadStream) {
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
    ffprobe.stdout.on('data', out => (data += out))
    ffprobe.stdout.on('close', () => res(JSON.parse(data)))
  })
}

// const probe = ffprobe()

// finished(probe.stdout).then(console.log).catch(console.log)
// finished(probe.stderr).then(console.log).catch(console.log)

// pipe(input,
//     probe.,
// )
// .then(console.log)
// .catch(console.log)

// function ffprobe() {
//     return spawn('ffprobe', [
//         '-show_format',
//         '-print_format',
//         'json',
//         '-pretty',
//         '-loglevel',
//         'quiet',
//         '-' // this allows us to pipe the input
//     ])
// }
