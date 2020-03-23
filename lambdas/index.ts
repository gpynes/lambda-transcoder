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
    const inputUrls = event.map(({ Bucket, Key }) => s3.getSignedUrl('getObject', { Bucket, Key }))
    const command = ffmpeg()
    
    inputUrls.map(url => command.addInput(url))
    
    const outputStream = new PassThrough()
    
    const finalOutputName = `${event[0].Key.split('.')[0]}-output.mp4`
    const upload = s3.upload({
        Bucket: event[0].Bucket,
        Key: finalOutputName,
        Body: outputStream
    })

    command
    .format('mp4')
    .outputOption('-movflags', 'frag_keyframe+empty_moov')
    .pipe(outputStream)
    
    command.on('progress', d => console.log('PROGRESS', JSON.stringify(d, null, 2)))
    command.on('end', console.log)
    upload.on('httpUploadProgress', (progress) => console.log(`${progress.loaded / progress.total}% progress uploaded -- `, JSON.stringify(progress, null, 2)))
    
    const response = await upload.promise()
    
    console.log('UPLOADED', JSON.stringify(response, null, 2))
    
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`The script uses approximately ${used} MB`);
    const used2 = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`The script uses approximately ${used2} MB`);
    return response
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


assemblerHandler([
  {
    "start": 0,
    "end": 5,
    "Key": "blah.mov",
    "Bucket": "split-n-stitchstack-sourcebucketddd2130a-y549evk299a2",
    "probe": {
      "streams": [
        {
          "index": 0,
          "codec_name": "h264",
          "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
          "profile": "Baseline",
          "codec_type": "video",
          "codec_time_base": "1/50",
          "codec_tag_string": "avc1",
          "codec_tag": "0x31637661",
          "width": 1920,
          "height": 1080,
          "coded_width": 1920,
          "coded_height": 1088,
          "has_b_frames": 0,
          "sample_aspect_ratio": "1:1",
          "display_aspect_ratio": "16:9",
          "pix_fmt": "yuv420p",
          "level": 40,
          "color_range": "tv",
          "color_space": "unknown",
          "color_transfer": "unknown",
          "color_primaries": "unknown",
          "chroma_location": "left",
          "field_order": "unknown",
          "timecode": "N/A",
          "refs": 1,
          "is_avc": "true",
          "nal_length_size": 4,
          "id": "N/A",
          "r_frame_rate": "25/1",
          "avg_frame_rate": "25/1",
          "time_base": "1/25000",
          "start_pts": 0,
          "start_time": 0,
          "duration_ts": 582000,
          "duration": 23.28,
          "bit_rate": 20001286,
          "max_bit_rate": "N/A",
          "bits_per_raw_sample": 8,
          "nb_frames": 582,
          "nb_read_frames": "N/A",
          "nb_read_packets": "N/A",
          "tags": {
            "creation_time": "2013-06-27T15:17:35.000000Z",
            "language": "eng",
            "handler_name": "Mainconcept MP4 Video Media Handler",
            "encoder": "AVC Coding"
          },
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0
          }
        },
        {
          "index": 1,
          "codec_name": "aac",
          "codec_long_name": "AAC (Advanced Audio Coding)",
          "profile": "LC",
          "codec_type": "audio",
          "codec_time_base": "1/48000",
          "codec_tag_string": "mp4a",
          "codec_tag": "0x6134706d",
          "sample_fmt": "fltp",
          "sample_rate": 48000,
          "channels": 2,
          "channel_layout": "stereo",
          "bits_per_sample": 0,
          "id": "N/A",
          "r_frame_rate": "0/0",
          "avg_frame_rate": "0/0",
          "time_base": "1/48000",
          "start_pts": 0,
          "start_time": 0,
          "duration_ts": 1117440,
          "duration": 23.28,
          "bit_rate": 157375,
          "max_bit_rate": 157500,
          "bits_per_raw_sample": "N/A",
          "nb_frames": 1093,
          "nb_read_frames": "N/A",
          "nb_read_packets": "N/A",
          "tags": {
            "creation_time": "2013-06-27T15:17:35.000000Z",
            "language": "eng",
            "handler_name": "Mainconcept MP4 Sound Media Handler"
          },
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0
          }
        }
      ],
      "format": {
        "filename": "pipe:0",
        "nb_streams": 2,
        "nb_programs": 0,
        "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
        "format_long_name": "QuickTime / MOV",
        "start_time": 0,
        "duration": 23.317333,
        "size": "N/A",
        "bit_rate": "N/A",
        "probe_score": 100,
        "tags": {
          "major_brand": "M4V ",
          "minor_version": "1",
          "compatible_brands": "M4V mp42isom",
          "creation_time": "2013-06-27T15:17:35.000000Z"
        }
      },
      "chapters": []
    },
    "outputFileName": "0-5-blah.mov.mp4"
  },
  {
    "start": 5,
    "end": 10,
    "Key": "blah.mov",
    "Bucket": "split-n-stitchstack-sourcebucketddd2130a-y549evk299a2",
    "probe": {
      "streams": [
        {
          "index": 0,
          "codec_name": "h264",
          "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
          "profile": "Baseline",
          "codec_type": "video",
          "codec_time_base": "1/50",
          "codec_tag_string": "avc1",
          "codec_tag": "0x31637661",
          "width": 1920,
          "height": 1080,
          "coded_width": 1920,
          "coded_height": 1088,
          "has_b_frames": 0,
          "sample_aspect_ratio": "1:1",
          "display_aspect_ratio": "16:9",
          "pix_fmt": "yuv420p",
          "level": 40,
          "color_range": "tv",
          "color_space": "unknown",
          "color_transfer": "unknown",
          "color_primaries": "unknown",
          "chroma_location": "left",
          "field_order": "unknown",
          "timecode": "N/A",
          "refs": 1,
          "is_avc": "true",
          "nal_length_size": 4,
          "id": "N/A",
          "r_frame_rate": "25/1",
          "avg_frame_rate": "25/1",
          "time_base": "1/25000",
          "start_pts": 0,
          "start_time": 0,
          "duration_ts": 582000,
          "duration": 23.28,
          "bit_rate": 20001286,
          "max_bit_rate": "N/A",
          "bits_per_raw_sample": 8,
          "nb_frames": 582,
          "nb_read_frames": "N/A",
          "nb_read_packets": "N/A",
          "tags": {
            "creation_time": "2013-06-27T15:17:35.000000Z",
            "language": "eng",
            "handler_name": "Mainconcept MP4 Video Media Handler",
            "encoder": "AVC Coding"
          },
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0
          }
        },
        {
          "index": 1,
          "codec_name": "aac",
          "codec_long_name": "AAC (Advanced Audio Coding)",
          "profile": "LC",
          "codec_type": "audio",
          "codec_time_base": "1/48000",
          "codec_tag_string": "mp4a",
          "codec_tag": "0x6134706d",
          "sample_fmt": "fltp",
          "sample_rate": 48000,
          "channels": 2,
          "channel_layout": "stereo",
          "bits_per_sample": 0,
          "id": "N/A",
          "r_frame_rate": "0/0",
          "avg_frame_rate": "0/0",
          "time_base": "1/48000",
          "start_pts": 0,
          "start_time": 0,
          "duration_ts": 1117440,
          "duration": 23.28,
          "bit_rate": 157375,
          "max_bit_rate": 157500,
          "bits_per_raw_sample": "N/A",
          "nb_frames": 1093,
          "nb_read_frames": "N/A",
          "nb_read_packets": "N/A",
          "tags": {
            "creation_time": "2013-06-27T15:17:35.000000Z",
            "language": "eng",
            "handler_name": "Mainconcept MP4 Sound Media Handler"
          },
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0
          }
        }
      ],
      "format": {
        "filename": "pipe:0",
        "nb_streams": 2,
        "nb_programs": 0,
        "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
        "format_long_name": "QuickTime / MOV",
        "start_time": 0,
        "duration": 23.317333,
        "size": "N/A",
        "bit_rate": "N/A",
        "probe_score": 100,
        "tags": {
          "major_brand": "M4V ",
          "minor_version": "1",
          "compatible_brands": "M4V mp42isom",
          "creation_time": "2013-06-27T15:17:35.000000Z"
        }
      },
      "chapters": []
    },
    "outputFileName": "5-10-blah.mov.mp4"
  },
  {
    "start": 10,
    "end": 15,
    "Key": "blah.mov",
    "Bucket": "split-n-stitchstack-sourcebucketddd2130a-y549evk299a2",
    "probe": {
      "streams": [
        {
          "index": 0,
          "codec_name": "h264",
          "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
          "profile": "Baseline",
          "codec_type": "video",
          "codec_time_base": "1/50",
          "codec_tag_string": "avc1",
          "codec_tag": "0x31637661",
          "width": 1920,
          "height": 1080,
          "coded_width": 1920,
          "coded_height": 1088,
          "has_b_frames": 0,
          "sample_aspect_ratio": "1:1",
          "display_aspect_ratio": "16:9",
          "pix_fmt": "yuv420p",
          "level": 40,
          "color_range": "tv",
          "color_space": "unknown",
          "color_transfer": "unknown",
          "color_primaries": "unknown",
          "chroma_location": "left",
          "field_order": "unknown",
          "timecode": "N/A",
          "refs": 1,
          "is_avc": "true",
          "nal_length_size": 4,
          "id": "N/A",
          "r_frame_rate": "25/1",
          "avg_frame_rate": "25/1",
          "time_base": "1/25000",
          "start_pts": 0,
          "start_time": 0,
          "duration_ts": 582000,
          "duration": 23.28,
          "bit_rate": 20001286,
          "max_bit_rate": "N/A",
          "bits_per_raw_sample": 8,
          "nb_frames": 582,
          "nb_read_frames": "N/A",
          "nb_read_packets": "N/A",
          "tags": {
            "creation_time": "2013-06-27T15:17:35.000000Z",
            "language": "eng",
            "handler_name": "Mainconcept MP4 Video Media Handler",
            "encoder": "AVC Coding"
          },
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0
          }
        },
        {
          "index": 1,
          "codec_name": "aac",
          "codec_long_name": "AAC (Advanced Audio Coding)",
          "profile": "LC",
          "codec_type": "audio",
          "codec_time_base": "1/48000",
          "codec_tag_string": "mp4a",
          "codec_tag": "0x6134706d",
          "sample_fmt": "fltp",
          "sample_rate": 48000,
          "channels": 2,
          "channel_layout": "stereo",
          "bits_per_sample": 0,
          "id": "N/A",
          "r_frame_rate": "0/0",
          "avg_frame_rate": "0/0",
          "time_base": "1/48000",
          "start_pts": 0,
          "start_time": 0,
          "duration_ts": 1117440,
          "duration": 23.28,
          "bit_rate": 157375,
          "max_bit_rate": 157500,
          "bits_per_raw_sample": "N/A",
          "nb_frames": 1093,
          "nb_read_frames": "N/A",
          "nb_read_packets": "N/A",
          "tags": {
            "creation_time": "2013-06-27T15:17:35.000000Z",
            "language": "eng",
            "handler_name": "Mainconcept MP4 Sound Media Handler"
          },
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0
          }
        }
      ],
      "format": {
        "filename": "pipe:0",
        "nb_streams": 2,
        "nb_programs": 0,
        "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
        "format_long_name": "QuickTime / MOV",
        "start_time": 0,
        "duration": 23.317333,
        "size": "N/A",
        "bit_rate": "N/A",
        "probe_score": 100,
        "tags": {
          "major_brand": "M4V ",
          "minor_version": "1",
          "compatible_brands": "M4V mp42isom",
          "creation_time": "2013-06-27T15:17:35.000000Z"
        }
      },
      "chapters": []
    },
    "outputFileName": "10-15-blah.mov.mp4"
  },
  {
    "start": 15,
    "end": 20,
    "Key": "blah.mov",
    "Bucket": "split-n-stitchstack-sourcebucketddd2130a-y549evk299a2",
    "probe": {
      "streams": [
        {
          "index": 0,
          "codec_name": "h264",
          "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
          "profile": "Baseline",
          "codec_type": "video",
          "codec_time_base": "1/50",
          "codec_tag_string": "avc1",
          "codec_tag": "0x31637661",
          "width": 1920,
          "height": 1080,
          "coded_width": 1920,
          "coded_height": 1088,
          "has_b_frames": 0,
          "sample_aspect_ratio": "1:1",
          "display_aspect_ratio": "16:9",
          "pix_fmt": "yuv420p",
          "level": 40,
          "color_range": "tv",
          "color_space": "unknown",
          "color_transfer": "unknown",
          "color_primaries": "unknown",
          "chroma_location": "left",
          "field_order": "unknown",
          "timecode": "N/A",
          "refs": 1,
          "is_avc": "true",
          "nal_length_size": 4,
          "id": "N/A",
          "r_frame_rate": "25/1",
          "avg_frame_rate": "25/1",
          "time_base": "1/25000",
          "start_pts": 0,
          "start_time": 0,
          "duration_ts": 582000,
          "duration": 23.28,
          "bit_rate": 20001286,
          "max_bit_rate": "N/A",
          "bits_per_raw_sample": 8,
          "nb_frames": 582,
          "nb_read_frames": "N/A",
          "nb_read_packets": "N/A",
          "tags": {
            "creation_time": "2013-06-27T15:17:35.000000Z",
            "language": "eng",
            "handler_name": "Mainconcept MP4 Video Media Handler",
            "encoder": "AVC Coding"
          },
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0
          }
        },
        {
          "index": 1,
          "codec_name": "aac",
          "codec_long_name": "AAC (Advanced Audio Coding)",
          "profile": "LC",
          "codec_type": "audio",
          "codec_time_base": "1/48000",
          "codec_tag_string": "mp4a",
          "codec_tag": "0x6134706d",
          "sample_fmt": "fltp",
          "sample_rate": 48000,
          "channels": 2,
          "channel_layout": "stereo",
          "bits_per_sample": 0,
          "id": "N/A",
          "r_frame_rate": "0/0",
          "avg_frame_rate": "0/0",
          "time_base": "1/48000",
          "start_pts": 0,
          "start_time": 0,
          "duration_ts": 1117440,
          "duration": 23.28,
          "bit_rate": 157375,
          "max_bit_rate": 157500,
          "bits_per_raw_sample": "N/A",
          "nb_frames": 1093,
          "nb_read_frames": "N/A",
          "nb_read_packets": "N/A",
          "tags": {
            "creation_time": "2013-06-27T15:17:35.000000Z",
            "language": "eng",
            "handler_name": "Mainconcept MP4 Sound Media Handler"
          },
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0
          }
        }
      ],
      "format": {
        "filename": "pipe:0",
        "nb_streams": 2,
        "nb_programs": 0,
        "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
        "format_long_name": "QuickTime / MOV",
        "start_time": 0,
        "duration": 23.317333,
        "size": "N/A",
        "bit_rate": "N/A",
        "probe_score": 100,
        "tags": {
          "major_brand": "M4V ",
          "minor_version": "1",
          "compatible_brands": "M4V mp42isom",
          "creation_time": "2013-06-27T15:17:35.000000Z"
        }
      },
      "chapters": []
    },
    "outputFileName": "15-20-blah.mov.mp4"
  },
  {
    "start": 20,
    "end": 25,
    "Key": "blah.mov",
    "Bucket": "split-n-stitchstack-sourcebucketddd2130a-y549evk299a2",
    "probe": {
      "streams": [
        {
          "index": 0,
          "codec_name": "h264",
          "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
          "profile": "Baseline",
          "codec_type": "video",
          "codec_time_base": "1/50",
          "codec_tag_string": "avc1",
          "codec_tag": "0x31637661",
          "width": 1920,
          "height": 1080,
          "coded_width": 1920,
          "coded_height": 1088,
          "has_b_frames": 0,
          "sample_aspect_ratio": "1:1",
          "display_aspect_ratio": "16:9",
          "pix_fmt": "yuv420p",
          "level": 40,
          "color_range": "tv",
          "color_space": "unknown",
          "color_transfer": "unknown",
          "color_primaries": "unknown",
          "chroma_location": "left",
          "field_order": "unknown",
          "timecode": "N/A",
          "refs": 1,
          "is_avc": "true",
          "nal_length_size": 4,
          "id": "N/A",
          "r_frame_rate": "25/1",
          "avg_frame_rate": "25/1",
          "time_base": "1/25000",
          "start_pts": 0,
          "start_time": 0,
          "duration_ts": 582000,
          "duration": 23.28,
          "bit_rate": 20001286,
          "max_bit_rate": "N/A",
          "bits_per_raw_sample": 8,
          "nb_frames": 582,
          "nb_read_frames": "N/A",
          "nb_read_packets": "N/A",
          "tags": {
            "creation_time": "2013-06-27T15:17:35.000000Z",
            "language": "eng",
            "handler_name": "Mainconcept MP4 Video Media Handler",
            "encoder": "AVC Coding"
          },
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0
          }
        },
        {
          "index": 1,
          "codec_name": "aac",
          "codec_long_name": "AAC (Advanced Audio Coding)",
          "profile": "LC",
          "codec_type": "audio",
          "codec_time_base": "1/48000",
          "codec_tag_string": "mp4a",
          "codec_tag": "0x6134706d",
          "sample_fmt": "fltp",
          "sample_rate": 48000,
          "channels": 2,
          "channel_layout": "stereo",
          "bits_per_sample": 0,
          "id": "N/A",
          "r_frame_rate": "0/0",
          "avg_frame_rate": "0/0",
          "time_base": "1/48000",
          "start_pts": 0,
          "start_time": 0,
          "duration_ts": 1117440,
          "duration": 23.28,
          "bit_rate": 157375,
          "max_bit_rate": 157500,
          "bits_per_raw_sample": "N/A",
          "nb_frames": 1093,
          "nb_read_frames": "N/A",
          "nb_read_packets": "N/A",
          "tags": {
            "creation_time": "2013-06-27T15:17:35.000000Z",
            "language": "eng",
            "handler_name": "Mainconcept MP4 Sound Media Handler"
          },
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0
          }
        }
      ],
      "format": {
        "filename": "pipe:0",
        "nb_streams": 2,
        "nb_programs": 0,
        "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
        "format_long_name": "QuickTime / MOV",
        "start_time": 0,
        "duration": 23.317333,
        "size": "N/A",
        "bit_rate": "N/A",
        "probe_score": 100,
        "tags": {
          "major_brand": "M4V ",
          "minor_version": "1",
          "compatible_brands": "M4V mp42isom",
          "creation_time": "2013-06-27T15:17:35.000000Z"
        }
      },
      "chapters": []
    },
    "outputFileName": "20-25-blah.mov.mp4"
  }
] as any[])