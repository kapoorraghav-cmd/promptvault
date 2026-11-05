import { strToU8, zipSync, type Zippable } from 'fflate'
import { db, META_KEYS, setMeta } from '../db'
import { extensionForMime } from '../images'
import type { Asset, Collection, Creation } from '../types'
import { BACKUP_FORMAT, BACKUP_JSON_NAME, BACKUP_VERSION, type AssetEntry } from './schema'

export type ExportScope = { kind: 'full' } | { kind: 'collections'; collectionIds: string[] } | { kind: 'items'; creationIds: string[] }

export interface ExportResult {
  blob: Blob
  filename: string
  counts: { creations: number; collections: number; files: number }
}

async function selectData(scope: ExportScope): Promise<{ creations: Creation[]; collections: Collection[] }> {
  if (scope.kind === 'full') {
    const [creations, collections] = await Promise.all([db.creations.toArray(), db.collections.toArray()])
    return { creations, collections }
  }
  if (scope.kind === 'collections') {
    const ids = new Set(scope.collectionIds)
    const collections = (await db.collections.bulkGet([...ids])).filter((c): c is Collection => Boolean(c))
    const creations = (await db.creations.where('collectionIds').anyOf([...ids]).toArray()).filter(
      (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i,
    )
    return { creations, collections }
  }
  const creations = (await db.creations.bulkGet(scope.creationIds)).filter((c): c is Creation => Boolean(c))
  const collectionIds = new Set(creations.flatMap((c) => c.collectionIds))
  const collections = (await db.collections.bulkGet([...collectionIds])).filter((c): c is Collection => Boolean(c))
  return { creations, collections }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Builds a backup. With `includeFiles`, produces a .zip containing the JSON
 * data plus every original image; otherwise a plain .json with text only.
 */
export async function exportBackup(scope: ExportScope, options: { includeFiles: boolean; filenameHint?: string }): Promise<ExportResult> {
  const { creations, collections } = await selectData(scope)
  const exportedIds = new Set(creations.map((c) => c.id))

  const assets: Asset[] = options.includeFiles ? await db.assets.where('creationId').anyOf([...exportedIds]).toArray() : []
  const originals = options.includeFiles ? await db.assetFiles.bulkGet(assets.map((a) => a.id)) : []

  const files: Zippable = {}
  const assetEntries: AssetEntry[] = []
  for (const [index, asset] of assets.entries()) {
    const original = originals[index]
    if (!original) continue
    const file = `assets/${asset.id}.${extensionForMime(asset.mimeType)}`
    files[file] = [new Uint8Array(original.data), { level: 0 }]
    let thumbFile: string | null = null
    if (asset.thumb) {
      thumbFile = `thumbs/${asset.id}.${asset.thumbType === 'image/jpeg' ? 'jpg' : 'webp'}`
      files[thumbFile] = [new Uint8Array(asset.thumb), { level: 0 }]
    }
    const { thumb: _thumb, thumbType: _thumbType, ...meta } = asset
    assetEntries.push({ ...meta, file, thumbFile })
  }

  const payload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'PromptVault',
    scope: scope.kind,
    includesFiles: options.includeFiles,
    collections,
    creations,
    assets: assetEntries,
  }
  const json = JSON.stringify(payload, null, 2)
  const base = options.filenameHint ? `promptvault-${options.filenameHint}` : 'promptvault-backup'

  let blob: Blob
  let filename: string
  if (options.includeFiles) {
    files[BACKUP_JSON_NAME] = [strToU8(json), { level: 6 }]
    const zipped = zipSync(files)
    blob = new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
    filename = `${base}-${dateStamp()}.zip`
  } else {
    blob = new Blob([json], { type: 'application/json' })
    filename = `${base}-${dateStamp()}.json`
  }

  if (scope.kind === 'full' && options.includeFiles) await setMeta(META_KEYS.lastBackupAt, Date.now())

  return {
    blob,
    filename,
    counts: { creations: creations.length, collections: collections.length, files: assetEntries.length },
  }
}
