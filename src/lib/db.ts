import Dexie, { type EntityTable } from 'dexie'
import type { Asset, AssetFile, Collection, Creation, MetaEntry } from './types'

/**
 * All library data lives in the browser's IndexedDB on the user's device.
 * Image previews are in `assets` and the untouched originals in `assetFiles`,
 * so browsing never loads full-size files. Nothing large goes in localStorage.
 */
export class PromptVaultDB extends Dexie {
  creations!: EntityTable<Creation, 'id'>
  assets!: EntityTable<Asset, 'id'>
  assetFiles!: EntityTable<AssetFile, 'id'>
  collections!: EntityTable<Collection, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor(name = 'promptvault') {
    super(name)
    this.version(1).stores({
      creations: 'id, addedAt, updatedAt, lastUsedAt, contentType, parentId, isSample, *collectionIds, *tags',
      assets: 'id, creationId',
      assetFiles: 'id',
      collections: 'id, name, createdAt, isSample',
      meta: 'key',
    })
  }
}

export const db = new PromptVaultDB()

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const entry = await db.meta.get(key)
  return entry === undefined ? fallback : (entry.value as T)
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export const META_KEYS = {
  onboardingDone: 'onboardingDone',
  lastBackupAt: 'lastBackupAt',
  gettingStartedDismissed: 'gettingStartedDismissed',
} as const
