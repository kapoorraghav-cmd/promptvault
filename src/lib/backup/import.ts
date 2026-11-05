import { strFromU8, unzipSync } from 'fflate'
import { deleteAssetsOf } from '../assets'
import { db } from '../db'
import { MAX_IMAGE_BYTES, sniffImageType } from '../images'
import type { Asset, Collection, Creation } from '../types'
import { newId, normaliseTags } from '../utils'
import {
  assetEntrySchema,
  BACKUP_JSON_NAME,
  BACKUP_VERSION,
  backupSchema,
  collectionSchema,
  creationSchema,
} from './schema'

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024 * 1024
const MAX_JSON_BYTES = 200 * 1024 * 1024

export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

/** An asset from a backup, together with its original file bytes. */
export type ImportedAsset = Asset & { data: ArrayBuffer }

export interface ParsedBackup {
  exportedAt: string
  includesFiles: boolean
  collections: Collection[]
  creations: Creation[]
  assets: ImportedAsset[]
  /** Human-readable notes about entries that were skipped as invalid. */
  warnings: string[]
}

export interface ImportAnalysis {
  backup: ParsedBackup
  conflictingCreations: number
  conflictingCollections: number
}

export type ConflictStrategy = 'skip' | 'replace' | 'copy'

export interface ImportSummary {
  added: number
  replaced: number
  skipped: number
  collectionsAdded: number
  files: number
}

function isZip(bytes: Uint8Array) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

function readJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new ImportError('This file isn’t valid JSON. It may be damaged or incomplete.')
  }
}

/** Reads a .zip or .json PromptVault backup and validates every record. */
export async function parseBackupFile(file: Blob): Promise<ParsedBackup> {
  if (file.size === 0) throw new ImportError('This file is empty.')
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError('This file is too large to import (over 2 GB).')

  const bytes = new Uint8Array(await file.arrayBuffer())
  let raw: unknown
  let zipFiles: Record<string, Uint8Array> | null = null

  if (isZip(bytes)) {
    try {
      zipFiles = unzipSync(bytes, {
        filter: (entry) =>
          entry.name === BACKUP_JSON_NAME ||
          ((entry.name.startsWith('assets/') || entry.name.startsWith('thumbs/')) &&
            entry.originalSize <= MAX_IMAGE_BYTES * 1.1),
      })
    } catch {
      throw new ImportError('This zip file is damaged and can’t be opened.')
    }
    const jsonBytes = zipFiles[BACKUP_JSON_NAME]
    if (!jsonBytes) throw new ImportError('This zip file isn’t a PromptVault backup (promptvault-backup.json is missing).')
    raw = readJson(strFromU8(jsonBytes))
  } else {
    if (file.size > MAX_JSON_BYTES) throw new ImportError('This JSON file is too large to import.')
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^\uFEFF/, '')
    if (!/^\s*[{[]/.test(text)) {
      throw new ImportError('This doesn’t look like a PromptVault backup. Choose a .zip or .json file exported from PromptVault.')
    }
    raw = readJson(text)
  }

  const header = backupSchema.safeParse(raw)
  if (!header.success) {
    throw new ImportError('This file isn’t a PromptVault backup, or it was created by an incompatible app.')
  }
  if (header.data.version > BACKUP_VERSION) {
    throw new ImportError('This backup was made by a newer version of PromptVault. Please update the app and try again.')
  }

  const warnings: string[] = []
  const collections: Collection[] = []
  for (const entry of header.data.collections) {
    const parsed = collectionSchema.safeParse(entry)
    if (parsed.success) collections.push(parsed.data)
  }
  if (collections.length < header.data.collections.length) {
    warnings.push(`${header.data.collections.length - collections.length} collection(s) were unreadable and will be skipped.`)
  }

  const creations: Creation[] = []
  const seenCreationIds = new Set<string>()
  for (const entry of header.data.creations) {
    const parsed = creationSchema.safeParse(entry)
    if (parsed.success && !seenCreationIds.has(parsed.data.id)) {
      seenCreationIds.add(parsed.data.id)
      creations.push({ ...parsed.data, tags: normaliseTags(parsed.data.tags) })
    }
  }
  if (creations.length < header.data.creations.length) {
    warnings.push(`${header.data.creations.length - creations.length} item(s) were unreadable and will be skipped.`)
  }

  const assets: ImportedAsset[] = []
  let missingFiles = 0
  if (zipFiles) {
    for (const entry of header.data.assets) {
      const parsed = assetEntrySchema.safeParse(entry)
      if (!parsed.success || !seenCreationIds.has(parsed.data.creationId)) {
        missingFiles++
        continue
      }
      const data = zipFiles[parsed.data.file]
      const realType = data ? sniffImageType(data.subarray(0, 32)) : null
      if (!data || !realType) {
        missingFiles++
        continue
      }
      const thumbData = parsed.data.thumbFile ? zipFiles[parsed.data.thumbFile] : undefined
      const thumbType = thumbData ? sniffImageType(thumbData.subarray(0, 32)) : null
      const { file: _file, thumbFile: _thumbFile, ...meta } = parsed.data
      const hasThumb = Boolean(thumbData && thumbType)
      assets.push({
        ...meta,
        mimeType: realType,
        size: data.byteLength,
        data: data.slice().buffer,
        thumb: hasThumb ? thumbData!.slice().buffer : null,
        thumbType: hasThumb ? thumbType : null,
      })
    }
  }
  if (missingFiles) warnings.push(`${missingFiles} image file(s) were missing or invalid and will be skipped.`)

  if (!creations.length && !collections.length) {
    throw new ImportError('This backup doesn’t contain any items or collections.')
  }

  return {
    exportedAt: header.data.exportedAt,
    includesFiles: Boolean(zipFiles),
    collections,
    creations,
    assets,
    warnings,
  }
}

export async function analyseImport(backup: ParsedBackup): Promise<ImportAnalysis> {
  const [existingCreations, existingCollections] = await Promise.all([
    db.creations.bulkGet(backup.creations.map((c) => c.id)),
    db.collections.bulkGet(backup.collections.map((c) => c.id)),
  ])
  return {
    backup,
    conflictingCreations: existingCreations.filter(Boolean).length,
    conflictingCollections: existingCollections.filter(Boolean).length,
  }
}

/**
 * Writes a parsed backup into the library.
 * - skip: keep existing records that have the same id
 * - replace: overwrite existing records that have the same id
 * - copy: import duplicates as new, separate records
 */
export async function applyImport(backup: ParsedBackup, strategy: ConflictStrategy): Promise<ImportSummary> {
  const summary: ImportSummary = { added: 0, replaced: 0, skipped: 0, collectionsAdded: 0, files: 0 }

  await db.transaction('rw', [db.creations, db.assets, db.assetFiles, db.collections], async () => {
    const collectionIdMap = new Map<string, string>()
    for (const collection of backup.collections) {
      const existing = await db.collections.get(collection.id)
      if (!existing) {
        await db.collections.put(collection)
        collectionIdMap.set(collection.id, collection.id)
        summary.collectionsAdded++
      } else if (strategy === 'replace') {
        await db.collections.put(collection)
        collectionIdMap.set(collection.id, collection.id)
      } else if (strategy === 'copy' && existing.name !== collection.name) {
        const copy = { ...collection, id: newId() }
        await db.collections.put(copy)
        collectionIdMap.set(collection.id, copy.id)
        summary.collectionsAdded++
      } else {
        collectionIdMap.set(collection.id, existing.id)
      }
    }

    const knownCollections = new Set((await db.collections.toCollection().primaryKeys()) as string[])
    const assetsByCreation = new Map<string, ImportedAsset[]>()
    for (const asset of backup.assets) {
      const list = assetsByCreation.get(asset.creationId) ?? []
      list.push(asset)
      assetsByCreation.set(asset.creationId, list)
    }

    const creationIdMap = new Map<string, string>()
    const toWrite: { creation: Creation; assets: ImportedAsset[] }[] = []
    for (const creation of backup.creations) {
      const existing = await db.creations.get(creation.id)
      let targetId = creation.id
      if (existing) {
        if (strategy === 'skip') {
          summary.skipped++
          continue
        }
        if (strategy === 'replace') {
          await deleteAssetsOf([creation.id])
          summary.replaced++
        } else {
          targetId = newId()
          summary.added++
        }
      } else {
        summary.added++
      }
      creationIdMap.set(creation.id, targetId)
      toWrite.push({ creation, assets: assetsByCreation.get(creation.id) ?? [] })
    }

    for (const { creation, assets } of toWrite) {
      const targetId = creationIdMap.get(creation.id)!
      const assetIdMap = new Map<string, string>()
      for (const asset of assets) {
        const assetId = targetId === creation.id && !(await db.assets.get(asset.id)) ? asset.id : newId()
        assetIdMap.set(asset.id, assetId)
        const { data, ...record } = asset
        await db.assets.put({ ...record, id: assetId, creationId: targetId })
        await db.assetFiles.put({ id: assetId, data })
        summary.files++
      }
      const collectionIds = creation.collectionIds
        .map((id) => collectionIdMap.get(id) ?? id)
        .filter((id) => knownCollections.has(id))
      const parentId = creation.parentId ? (creationIdMap.get(creation.parentId) ?? creation.parentId) : null
      const assetIds = creation.assetIds.map((id) => assetIdMap.get(id)).filter((id): id is string => Boolean(id))
      await db.creations.put({
        ...creation,
        id: targetId,
        collectionIds: Array.from(new Set(collectionIds)),
        parentId,
        assetIds,
        coverAssetId: (creation.coverAssetId && assetIdMap.get(creation.coverAssetId)) || assetIds[0] || null,
      })
    }
  })

  return summary
}
