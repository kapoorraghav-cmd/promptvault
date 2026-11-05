import { db } from './db'
import type { Asset } from './types'

export function thumbBlob(asset: Pick<Asset, 'thumb' | 'thumbType'>): Blob | null {
  return asset.thumb ? new Blob([asset.thumb], { type: asset.thumbType ?? 'image/webp' }) : null
}

/** Loads the untouched original file for an asset. */
export async function getOriginalBlob(asset: Pick<Asset, 'id' | 'mimeType'>): Promise<Blob | null> {
  const file = await db.assetFiles.get(asset.id)
  return file ? new Blob([file.data], { type: asset.mimeType }) : null
}

/** Deletes every asset (preview and original) attached to the given items. Call inside a transaction. */
export async function deleteAssetsOf(creationIds: string[]) {
  const ids = (await db.assets.where('creationId').anyOf(creationIds).primaryKeys()) as string[]
  await Promise.all([db.assets.bulkDelete(ids), db.assetFiles.bulkDelete(ids)])
}
