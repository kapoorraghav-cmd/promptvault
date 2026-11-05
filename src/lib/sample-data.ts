import { db } from './db'
import { processImage, sniffImageType } from './images'
import type { Asset, AssetFile, AssetRole, Collection, CollectionColor, ContentType, Creation } from './types'

/**
 * Demonstration content shown on first run. Every record is flagged with
 * `isSample` so it can be removed in one click. The images are original
 * illustrations rendered by scripts/generate-sample-art.mjs — they are not
 * outputs of the AI tools named in the sample metadata.
 */

interface SampleImage {
  file: string
  role: AssetRole
  alt: string
  description?: string
}

interface SampleCreation {
  key: string
  title: string
  prompt: string
  negativePrompt?: string
  description?: string
  model: string
  contentType: ContentType
  category?: string
  tags: string[]
  collections: string[]
  aspectRatio?: string
  resolution?: string
  seed?: string
  settings?: string
  video?: { url: string; durationSeconds: number | null }
  favourite?: boolean
  images?: SampleImage[]
  parent?: string
  daysAgo: number
  usedHoursAgo?: number
}

const SAMPLE_COLLECTIONS: { key: string; name: string; description: string; color: CollectionColor }[] = [
  { key: 'landscapes', name: 'Cinematic Landscapes', description: 'Moody scenery and wide establishing shots', color: 'violet' },
  { key: 'posters', name: 'Graphic Posters', description: 'Print-style layouts and typography', color: 'rose' },
  { key: 'wallpapers', name: 'Phone Wallpapers', description: 'Vertical 9:16 backgrounds', color: 'teal' },
  { key: 'shorts', name: 'YouTube Shorts', description: 'Hooks, scripts and vertical visuals', color: 'amber' },
  { key: 'video', name: 'AI Video Experiments', description: 'Motion tests and camera moves', color: 'blue' },
  { key: 'marketing', name: 'Marketing Creatives', description: 'Ads, banners and campaign assets', color: 'green' },
]

const SAMPLE_CREATIONS: SampleCreation[] = [
  {
    key: 'dawn',
    title: 'Misty mountain layers at dawn',
    prompt:
      'minimalist layered mountain landscape at dawn, six receding ridgelines fading into soft morning haze, pale sun low on the horizon, small flock of birds, dusty rose and lavender palette, flat vector illustration, subtle film grain --ar 16:9 --style raw --stylize 200',
    description: 'Clean layering came from asking for an exact number of ridgelines. Stylize above 300 started adding unwanted detail.',
    model: 'Midjourney v7',
    contentType: 'image',
    category: 'Landscape',
    tags: ['landscape', 'minimal', 'vector', 'dawn'],
    collections: ['landscapes'],
    aspectRatio: '16:9',
    resolution: '1600×900',
    settings: '--style raw --stylize 200',
    favourite: true,
    images: [{ file: 'mountains-dawn.jpg', role: 'output', alt: 'Layered pink and purple mountain ridges under a pale rising sun' }],
    daysAgo: 12,
    usedHoursAgo: 3,
  },
  {
    key: 'dusk',
    title: 'Misty mountain layers at dusk',
    prompt:
      'minimalist layered mountain landscape at dusk, six receding ridgelines fading into evening haze, bright full moon with soft halo, scattered stars, deep indigo and violet palette, flat vector illustration, subtle film grain --ar 16:9 --style raw --stylize 200',
    description: 'Same structure as the dawn version, swapping the time of day and palette. Night version works better as a desktop wallpaper.',
    model: 'Midjourney v7',
    contentType: 'image',
    category: 'Landscape',
    tags: ['landscape', 'minimal', 'vector', 'night'],
    collections: ['landscapes', 'wallpapers'],
    aspectRatio: '16:9',
    resolution: '1600×900',
    settings: '--style raw --stylize 200',
    images: [{ file: 'mountains-dusk.jpg', role: 'output', alt: 'Purple mountain ridges at night under a glowing full moon and stars' }],
    parent: 'dawn',
    daysAgo: 11,
  },
  {
    key: 'aurora',
    title: 'Aurora over a frozen lake',
    prompt:
      'northern lights dancing over a still frozen lake, green and teal aurora curtains with violet edges, dark mountain silhouette on the horizon, mirror-like reflection on the ice, star-filled sky, long exposure night photography look, calm and silent atmosphere',
    negativePrompt: 'people, buildings, text, watermark, oversaturated, lens flare, blurry foreground',
    description: 'Seed 840213 gives the most even curtain shape. Increasing CFG past 7 made the aurora look painted.',
    model: 'Stable Diffusion XL',
    contentType: 'image',
    category: 'Landscape',
    tags: ['aurora', 'night', 'reflection', 'landscape'],
    collections: ['landscapes'],
    aspectRatio: '4:3',
    resolution: '1600×1200',
    seed: '840213',
    settings: 'Steps: 32\nCFG scale: 6.5\nSampler: DPM++ 2M Karras\nRefiner: on (0.8 switch)',
    favourite: true,
    images: [{ file: 'aurora.jpg', role: 'output', alt: 'Green and violet aurora above dark mountains reflected in a frozen lake' }],
    daysAgo: 9,
    usedHoursAgo: 30,
  },
  {
    key: 'bauhaus',
    title: 'Bauhaus exhibition poster',
    prompt:
      'Bauhaus-inspired exhibition poster, bold primary geometry — red circle, blue half circle, yellow block, black rectangle and outline ring — on warm off-white paper, strict grid, large heavy sans-serif headline “FORM FOLLOWS FEELING” with the word FEELING in red, small caps footer line, printed paper texture',
    description: 'Ideogram handled the headline text perfectly on the first try. Use “strict grid” or the shapes drift.',
    model: 'Ideogram 3',
    contentType: 'image',
    category: 'Poster',
    tags: ['poster', 'typography', 'bauhaus', 'print'],
    collections: ['posters'],
    aspectRatio: '3:4',
    resolution: '1200×1600',
    settings: 'Style: Design\nMagic prompt: off',
    images: [{ file: 'bauhaus.jpg', role: 'output', alt: 'Geometric poster with red circle, blue half circle and the words Form Follows Feeling' }],
    daysAgo: 7,
  },
  {
    key: 'orbs',
    title: 'Soft gradient orbs wallpaper',
    prompt:
      'abstract phone wallpaper, large soft blurred colour orbs in coral, violet, teal, pink and amber floating on a near-black background, smooth gradients, fine film grain, calm and premium, no text',
    model: 'Flux 1.1 Pro',
    contentType: 'image',
    category: 'Wallpaper',
    tags: ['wallpaper', 'abstract', 'gradient', '9:16'],
    collections: ['wallpapers'],
    aspectRatio: '9:16',
    resolution: '900×1600',
    seed: '19022',
    images: [{ file: 'orbs.jpg', role: 'output', alt: 'Blurred coral, violet, teal and amber colour orbs on a dark background' }],
    daysAgo: 6,
    usedHoursAgo: 52,
  },
  {
    key: 'dunes',
    title: 'Desert dunes, minimal poster',
    prompt:
      'minimal desert poster, four sweeping sand dunes with crisp light and shadow sides, pale sun with halo in a soft blue-to-cream sky, warm terracotta and peach tones, flat illustration, generous empty sky for a title',
    model: 'GPT Image',
    contentType: 'image',
    category: 'Poster',
    tags: ['desert', 'minimal', 'poster', 'warm'],
    collections: ['posters', 'wallpapers'],
    aspectRatio: '4:5',
    resolution: '1280×1600',
    images: [{ file: 'dunes.jpg', role: 'output', alt: 'Flat illustration of orange sand dunes under a pale sun' }],
    daysAgo: 4,
  },
  {
    key: 'summer',
    title: 'Summer drop — social ad',
    prompt:
      'square social media ad for a summer collection launch, warm peach background, big retro sun, layered coral wave pattern along the bottom, bold dark brown headline “SUMMER DROP”, small label “NEW SEASON”, pill-shaped “SHOP NOW” button, sparkles, clean flat design',
    description: 'Version used for the Instagram feed test. Headline legibility scored best with dark brown instead of black.',
    model: 'GPT Image',
    contentType: 'image',
    category: 'Advertising',
    tags: ['ad', 'instagram', 'summer', 'typography'],
    collections: ['marketing'],
    aspectRatio: '1:1',
    resolution: '1200×1200',
    images: [{ file: 'summer-drop.jpg', role: 'output', alt: 'Peach summer advert with a big sun, coral waves and the words Summer Drop' }],
    daysAgo: 3,
    usedHoursAgo: 6,
  },
  {
    key: 'synthwave',
    title: 'Retro synthwave drive — loop',
    prompt:
      'seamless looping shot gliding forward over a glowing magenta wireframe grid toward a huge striped retro sun, purple mountain silhouettes on both sides, starry sky, 1980s synthwave aesthetic, smooth constant camera speed, no camera shake',
    description: 'Thumbnail is the first frame. The loop point is cleanest at exactly 8 seconds.',
    model: 'Runway Gen-4',
    contentType: 'video',
    category: 'Motion loop',
    tags: ['synthwave', 'loop', 'retro', 'camera-move'],
    collections: ['video', 'shorts'],
    aspectRatio: '16:9',
    resolution: '1280×720',
    video: { url: 'https://example.com/your-video-link', durationSeconds: 8 },
    favourite: true,
    images: [
      {
        file: 'synthwave.jpg',
        role: 'thumbnail',
        alt: 'Striped orange sun setting behind purple mountains over a neon pink grid',
        description: 'First frame of the loop',
      },
    ],
    daysAgo: 2,
  },
  {
    key: 'neon',
    title: 'Rainy neon city — vertical Short',
    prompt:
      'vertical 9:16 slow upward crane shot over a rainy neon city at night, dense skyscrapers with magenta, cyan and gold windows, soft pink moon glow, rain streaks catching the light, reflective street at the bottom, cinematic, 24fps',
    description: 'Used as the background for a Shorts voiceover. Added the city still as a reference image for consistent colours.',
    model: 'Kling 2.1',
    contentType: 'video',
    category: 'Shorts background',
    tags: ['neon', 'city', 'rain', 'vertical'],
    collections: ['video', 'shorts'],
    aspectRatio: '9:16',
    resolution: '1080×1920',
    video: { url: 'https://example.com/your-video-link', durationSeconds: 10 },
    images: [{ file: 'neon-city.jpg', role: 'reference', alt: 'Neon skyscrapers in the rain at night', description: 'Reference still used for the colour palette' }],
    daysAgo: 1,
    usedHoursAgo: 1,
  },
  {
    key: 'hooks',
    title: 'Shorts hook writer',
    prompt:
      'You are a short-form video scriptwriter. Write 5 opening hooks for a 30-second YouTube Short about {topic}.\n\nRules:\n- Each hook is under 12 words\n- Lead with a surprising fact, a bold claim or a direct question\n- No greetings, no “in this video”\n- Make the viewer need the next sentence\n\nThen pick the strongest hook and write the full 30-second script (about 75 words) with on-screen text cues in [brackets].',
    description: 'Swap {topic} for the subject. Works best when you also paste 2–3 hooks from Shorts that performed well.',
    model: 'ChatGPT',
    contentType: 'text',
    category: 'Script',
    tags: ['script', 'hooks', 'youtube', 'template'],
    collections: ['shorts'],
    favourite: true,
    daysAgo: 5,
    usedHoursAgo: 20,
  },
  {
    key: 'lofi',
    title: 'Rainy evening lo-fi beat',
    prompt:
      'lo-fi hip hop instrumental, mellow Rhodes piano chords, warm vinyl crackle, soft boom-bap drums with lazy swing, gentle rain ambience, deep round bass, 75 BPM, nostalgic rainy evening mood, no vocals',
    description: 'Good background for the neon city Short. Extend to 2 minutes for a full loop.',
    model: 'Suno',
    contentType: 'audio',
    category: 'Music',
    tags: ['lofi', 'music', 'background', 'instrumental'],
    collections: ['shorts'],
    settings: 'Instrumental: on\nLength: 2:00',
    daysAgo: 8,
  },
]

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

function isoDate(timestamp: number) {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function fetchSampleImage(file: string): Promise<Blob> {
  const url = new URL(`${import.meta.env.BASE_URL}samples/${file}`, window.location.href)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Couldn’t load sample image ${file}`)
  const blob = await response.blob()
  const type = sniffImageType(new Uint8Array(await blob.slice(0, 32).arrayBuffer()))
  if (!type) throw new Error(`Sample image ${file} is not a valid image`)
  return blob.type === type ? blob : new Blob([blob], { type })
}

/** Adds the sample library. Existing user data is never modified. */
export async function loadSampleData(): Promise<void> {
  const now = Date.now()

  // Fetch and process all images before opening the database transaction.
  const imageFiles = Array.from(new Set(SAMPLE_CREATIONS.flatMap((c) => c.images?.map((i) => i.file) ?? [])))
  const processed = new Map<
    string,
    { data: ArrayBuffer; type: string; thumb: ArrayBuffer | null; thumbType: string | null; width: number | null; height: number | null }
  >()
  await Promise.all(
    imageFiles.map(async (file) => {
      const blob = await fetchSampleImage(file)
      let info: { thumb: Blob | null; width: number | null; height: number | null } = { thumb: null, width: null, height: null }
      try {
        info = await processImage(blob, blob.type)
      } catch {
        // Keep the original even if a preview can't be generated.
      }
      processed.set(file, {
        data: await blob.arrayBuffer(),
        type: blob.type,
        thumb: info.thumb ? await info.thumb.arrayBuffer() : null,
        thumbType: info.thumb?.type || null,
        width: info.width,
        height: info.height,
      })
    }),
  )

  const collectionIds = new Map<string, string>()
  const collections: Collection[] = SAMPLE_COLLECTIONS.map((c, i) => {
    const id = `sample-collection-${c.key}`
    collectionIds.set(c.key, id)
    return {
      id,
      name: c.name,
      description: c.description,
      color: c.color,
      isSample: true,
      createdAt: now - (20 - i) * DAY,
      updatedAt: now - (20 - i) * DAY,
    }
  })

  const creations: Creation[] = []
  const assets: Asset[] = []
  const files: AssetFile[] = []
  for (const sample of SAMPLE_CREATIONS) {
    const id = `sample-${sample.key}`
    const addedAt = now - sample.daysAgo * DAY - Math.round(sample.daysAgo * 37) * 60_000
    const assetIds: string[] = []
    for (const [index, image] of (sample.images ?? []).entries()) {
      const data = processed.get(image.file)!
      const assetId = `${id}-asset-${index}`
      assetIds.push(assetId)
      assets.push({
        id: assetId,
        creationId: id,
        role: image.role,
        name: image.file,
        mimeType: data.type,
        size: data.data.byteLength,
        width: data.width,
        height: data.height,
        alt: image.alt,
        description: image.description ?? '',
        thumb: data.thumb,
        thumbType: data.thumbType,
        addedAt,
      })
      files.push({ id: assetId, data: data.data })
    }
    const parent = sample.parent ? SAMPLE_CREATIONS.find((c) => c.key === sample.parent) : undefined
    creations.push({
      id,
      title: sample.title,
      prompt: sample.prompt,
      negativePrompt: sample.negativePrompt ?? '',
      description: sample.description ?? '',
      model: sample.model,
      contentType: sample.contentType,
      category: sample.category ?? '',
      tags: sample.tags,
      collectionIds: sample.collections.map((key) => collectionIds.get(key)!),
      aspectRatio: sample.aspectRatio ?? '',
      resolution: sample.resolution ?? '',
      seed: sample.seed ?? '',
      settings: sample.settings ?? '',
      sourceUrl: '',
      createdOn: isoDate(addedAt),
      video: sample.video ?? null,
      favourite: sample.favourite ?? false,
      assetIds,
      coverAssetId: assetIds[0] ?? null,
      parentId: parent ? `sample-${parent.key}` : null,
      parentTitle: parent?.title ?? null,
      isSample: true,
      addedAt,
      updatedAt: addedAt,
      lastUsedAt: sample.usedHoursAgo !== undefined ? now - sample.usedHoursAgo * HOUR : null,
    })
  }

  await db.transaction('rw', [db.creations, db.assets, db.assetFiles, db.collections], async () => {
    await db.collections.bulkPut(collections)
    await db.assets.bulkPut(assets)
    await db.assetFiles.bulkPut(files)
    await db.creations.bulkPut(creations)
  })
}

export const SAMPLE_COUNTS = { creations: SAMPLE_CREATIONS.length, collections: SAMPLE_COLLECTIONS.length }
