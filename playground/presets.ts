interface Format {
  quality: string
  audio_bitrate: number
  bitrate: {
    low: number
    high: number
  }
  resolution: {
    width: number
    height: number
  }
}

const presets: Format[] = [
  {
    quality: '240p',
    resolution: {
      width: 426,
      height: 240,
    },
    bitrate: {
      low: 400,
      high: 600,
    },
    audio_bitrate: 64,
  },
  {
    quality: '360p',
    resolution: {
      width: 640,
      height: 360,
    },
    bitrate: {
      low: 700,
      high: 900,
    },
    audio_bitrate: 96,
  },
  {
    quality: '480p',
    resolution: {
      width: 854,
      height: 480,
    },
    bitrate: {
      low: 1250,
      high: 1600,
    },
    audio_bitrate: 128,
  },
  {
    quality: 'HD 720p',
    resolution: {
      width: 1280,
      height: 720,
    },
    bitrate: {
      low: 2500,
      high: 3200,
    },
    audio_bitrate: 128,
  },
  {
    quality: 'HD 720p 60fps',
    resolution: {
      width: 1280,
      height: 720,
    },
    bitrate: {
      low: 3500,
      high: 4400,
    },
    audio_bitrate: 128,
  },
  {
    quality: 'Full HD 1080p',
    resolution: {
      width: 1920,
      height: 1080,
    },
    bitrate: {
      low: 4500,
      high: 5300,
    },
    audio_bitrate: 192,
  },
  {
    quality: 'Full HD 1080p 60fps',
    resolution: {
      width: 1920,
      height: 1080,
    },
    bitrate: {
      low: 5800,
      high: 7400,
    },
    audio_bitrate: 192,
  },
  {
    quality: '4k',
    resolution: {
      width: 3840,
      height: 2160,
    },
    bitrate: { low: 14000, high: 18200 },
    audio_bitrate: 192,
  },
  {
    quality: '4k 60fps',
    resolution: {
      width: 3840,
      height: 2160,
    },
    bitrate: { low: 23000, high: 29500 },
    audio_bitrate: 192,
  },
]

type Quality = '240p' | '360p' | '480p' | 'HD 720p' | 'HD 720p 60fps' | 'Full HD 1080p' | 'Full HD 1080p 60fps' | '4k' | '4k 60fps'
type Resolution = '426x240' | '640x360' | '854x480' | '1280x720' | '1280x720' | '1920x1080' | '1920x1080' | '3840x2160'
type Bitrate = '400k' | '600k' | '700k' | '900k' | '1250k' | '1600k' | '2500k' | '3200k' | '3500k' | '4400k' | '4500k' | '5300k' | '5800k' | '7400k' | '14000k' | '18200k' | '23000k' | '29500k'
type AudioBitrate = '64k' | '96k' | '128k' | '192k'
type Form = [Quality, Resolution, Bitrate, Bitrate, AudioBitrate]
const AcceptedForms: Form[] = [
    ['240p',                '426x240',    '400k',    '600k',    '64k'],
    ['360p',                '640x360',    '700k',    '900k',    '96k'],
    ['480p',                '854x480',    '1250k',   '1600k',   '128k'],
    ['HD 720p',             '1280x720',   '2500k',   '3200k',   '128k'],
    ['HD 720p 60fps',       '1280x720',   '3500k',   '4400k',   '128k'],
    ['Full HD 1080p',       '1920x1080',  '4500k',   '5300k',   '192k'],
    ['Full HD 1080p 60fps', '1920x1080',  '5800k',   '7400k',   '192k'],
    ['4k',                  '3840x2160',  '14000k',  '18200k',  '192k'],
    ['4k 60fps',            '3840x2160',  '23000k',  '29500k',  '128k']
]
