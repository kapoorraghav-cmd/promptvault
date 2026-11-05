import type { AssetRole, CollectionColor, ContentType } from './types'

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  image: 'Image',
  video: 'Video',
  text: 'Text',
  audio: 'Audio',
  other: 'Other',
}

export const ASSET_ROLE_LABELS: Record<AssetRole, string> = {
  output: 'Result',
  reference: 'Reference',
  thumbnail: 'Thumbnail',
}

export const COLLECTION_COLOR_CLASSES: Record<CollectionColor, { dot: string; soft: string; text: string }> = {
  amber: { dot: 'bg-amber-400', soft: 'bg-amber-400/12', text: 'text-amber-500 dark:text-amber-300' },
  rose: { dot: 'bg-rose-400', soft: 'bg-rose-400/12', text: 'text-rose-500 dark:text-rose-300' },
  violet: { dot: 'bg-violet-400', soft: 'bg-violet-400/12', text: 'text-violet-500 dark:text-violet-300' },
  blue: { dot: 'bg-sky-400', soft: 'bg-sky-400/12', text: 'text-sky-600 dark:text-sky-300' },
  teal: { dot: 'bg-teal-400', soft: 'bg-teal-400/12', text: 'text-teal-600 dark:text-teal-300' },
  green: { dot: 'bg-emerald-400', soft: 'bg-emerald-400/12', text: 'text-emerald-600 dark:text-emerald-300' },
  slate: { dot: 'bg-zinc-400', soft: 'bg-zinc-400/12', text: 'text-zinc-600 dark:text-zinc-300' },
}

/** Suggestions only — users can type any tool or model name. */
export const MODEL_SUGGESTIONS = [
  'Midjourney v7',
  'Midjourney v6.1',
  'DALL·E 3',
  'GPT Image',
  'Stable Diffusion XL',
  'Stable Diffusion 3.5',
  'Flux 1.1 Pro',
  'Flux Dev',
  'Ideogram 3',
  'Adobe Firefly',
  'Leonardo',
  'Imagen 4',
  'Runway Gen-4',
  'Sora',
  'Veo 3',
  'Kling 2.1',
  'Luma Dream Machine',
  'Pika',
  'ChatGPT',
  'Claude',
  'Gemini',
  'Suno',
  'Udio',
  'ElevenLabs',
]

export const ASPECT_RATIO_SUGGESTIONS = ['1:1', '4:5', '3:4', '2:3', '9:16', '4:3', '3:2', '16:9', '21:9']
