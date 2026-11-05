export const CONTENT_TYPES = ['image', 'video', 'text', 'audio', 'other'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export const ASSET_ROLES = ['output', 'reference', 'thumbnail'] as const
export type AssetRole = (typeof ASSET_ROLES)[number]

export interface VideoDetails {
  /** Link to where the video lives (it is never downloaded). */
  url: string
  durationSeconds: number | null
}

export interface Creation {
  id: string
  title: string
  prompt: string
  negativePrompt: string
  description: string
  /** AI tool or model, e.g. "Midjourney v7". */
  model: string
  contentType: ContentType
  category: string
  tags: string[]
  collectionIds: string[]
  aspectRatio: string
  resolution: string
  seed: string
  /** Free-form generation settings (steps, CFG, stylize…). */
  settings: string
  sourceUrl: string
  /** Date the creation was made, as YYYY-MM-DD. */
  createdOn: string
  video: VideoDetails | null
  favourite: boolean
  /** Ordered list of attached asset ids. */
  assetIds: string[]
  coverAssetId: string | null
  /** Set when this record is a variation of another one. */
  parentId: string | null
  parentTitle: string | null
  isSample: boolean
  addedAt: number
  updatedAt: number
  lastUsedAt: number | null
}

/**
 * An attached image. The small preview lives on this record so grids load
 * quickly; the untouched original lives separately in `AssetFile`.
 * Binary data is stored as ArrayBuffer because some browsers (e.g. Safari
 * private windows) can't store Blobs in IndexedDB.
 */
export interface Asset {
  id: string
  creationId: string
  role: AssetRole
  name: string
  mimeType: string
  size: number
  width: number | null
  height: number | null
  alt: string
  description: string
  /** Small preview used in grids; null if it wasn't needed or couldn't be generated. */
  thumb: ArrayBuffer | null
  thumbType: string | null
  addedAt: number
}

/** The original file bytes for an asset, stored untouched. */
export interface AssetFile {
  id: string
  data: ArrayBuffer
}

/** Asset metadata without binary data (used in exports and lists). */
export type AssetMeta = Omit<Asset, 'thumb' | 'thumbType'>

export interface Collection {
  id: string
  name: string
  description: string
  color: CollectionColor
  isSample: boolean
  createdAt: number
  updatedAt: number
}

export const COLLECTION_COLORS = ['amber', 'rose', 'violet', 'blue', 'teal', 'green', 'slate'] as const
export type CollectionColor = (typeof COLLECTION_COLORS)[number]

export interface MetaEntry {
  key: string
  value: unknown
}

export type CreationDraft = Omit<
  Creation,
  'id' | 'addedAt' | 'updatedAt' | 'lastUsedAt' | 'assetIds' | 'coverAssetId' | 'isSample' | 'parentId' | 'parentTitle'
> & {
  parentId?: string | null
  parentTitle?: string | null
}

export function emptyDraft(overrides: Partial<CreationDraft> = {}): CreationDraft {
  return {
    title: '',
    prompt: '',
    negativePrompt: '',
    description: '',
    model: '',
    contentType: 'image',
    category: '',
    tags: [],
    collectionIds: [],
    aspectRatio: '',
    resolution: '',
    seed: '',
    settings: '',
    sourceUrl: '',
    createdOn: todayISO(),
    video: null,
    favourite: false,
    ...overrides,
  }
}

export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
