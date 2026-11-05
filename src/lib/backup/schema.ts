import { z } from 'zod'
import { ASSET_ROLES, COLLECTION_COLORS, CONTENT_TYPES } from '../types'

export const BACKUP_FORMAT = 'promptvault-backup'
export const BACKUP_VERSION = 1
export const BACKUP_JSON_NAME = 'promptvault-backup.json'

const MAX_TEXT = 100_000
const shortText = (max = 2_000) => z.string().max(max).catch('')
const longText = () => z.string().max(MAX_TEXT).catch('')
const id = z.string().min(1).max(100)
const timestamp = z.number().finite().nonnegative()

export const collectionSchema = z.object({
  id,
  name: z.string().trim().min(1).max(200),
  description: shortText(5_000).default(''),
  color: z.enum(COLLECTION_COLORS).catch('amber'),
  isSample: z.boolean().catch(false),
  createdAt: timestamp.catch(() => Date.now()),
  updatedAt: timestamp.catch(() => Date.now()),
})

export const creationSchema = z.object({
  id,
  title: shortText(500).default(''),
  prompt: longText().default(''),
  negativePrompt: longText().default(''),
  description: longText().default(''),
  model: shortText(200).default(''),
  contentType: z.enum(CONTENT_TYPES).catch('other'),
  category: shortText(200).default(''),
  tags: z.array(z.string().max(100)).max(200).catch([]),
  collectionIds: z.array(id).max(500).catch([]),
  aspectRatio: shortText(50).default(''),
  resolution: shortText(50).default(''),
  seed: shortText(200).default(''),
  settings: longText().default(''),
  sourceUrl: shortText(2_000).default(''),
  createdOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .catch(() => new Date().toISOString().slice(0, 10)),
  video: z
    .object({
      url: shortText(2_000).default(''),
      durationSeconds: z.number().finite().nonnegative().nullable().catch(null),
    })
    .nullable()
    .catch(null),
  favourite: z.boolean().catch(false),
  assetIds: z.array(id).max(500).catch([]),
  coverAssetId: id.nullable().catch(null),
  parentId: id.nullable().catch(null),
  parentTitle: z.string().max(500).nullable().catch(null),
  isSample: z.boolean().catch(false),
  addedAt: timestamp.catch(() => Date.now()),
  updatedAt: timestamp.catch(() => Date.now()),
  lastUsedAt: timestamp.nullable().catch(null),
})

export const assetEntrySchema = z.object({
  id,
  creationId: id,
  role: z.enum(ASSET_ROLES).catch('output'),
  name: shortText(500).default('image'),
  mimeType: z.string().max(100),
  size: z.number().finite().nonnegative().catch(0),
  width: z.number().finite().positive().nullable().catch(null),
  height: z.number().finite().positive().nullable().catch(null),
  alt: shortText(2_000).default(''),
  description: shortText(5_000).default(''),
  addedAt: timestamp.catch(() => Date.now()),
  /** Path of the original file inside the zip. */
  file: z.string().max(300),
  /** Path of the thumbnail inside the zip, if any. */
  thumbFile: z.string().max(300).nullable().catch(null),
})

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().positive(),
  exportedAt: z.string().max(100).catch(''),
  scope: z.enum(['full', 'collections', 'items']).catch('full'),
  includesFiles: z.boolean().catch(false),
  collections: z.array(z.unknown()).max(10_000).catch([]),
  creations: z.array(z.unknown()).max(100_000).catch([]),
  assets: z.array(z.unknown()).max(200_000).catch([]),
})

export type BackupFile = z.infer<typeof backupSchema>
export type CollectionEntry = z.infer<typeof collectionSchema>
export type CreationEntry = z.infer<typeof creationSchema>
export type AssetEntry = z.infer<typeof assetEntrySchema>
