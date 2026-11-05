import { deleteAssetsOf } from './assets'
import { db } from './db'
import type { Asset, AssetRole, Collection, CollectionColor, Creation, CreationDraft } from './types'
import { newId, normaliseTags } from './utils'

/** An attachment as edited in the form, before it's saved. */
export interface AssetDraft {
  key: string
  /** Id of an already-saved asset, or null for a new upload. */
  id: string | null
  /** New file data (for new uploads or replacements). Null keeps the stored file. */
  blob: Blob | null
  thumb: Blob | null
  name: string
  mimeType: string
  size: number
  width: number | null
  height: number | null
  alt: string
  description: string
  role: AssetRole
}

export interface SaveCreationInput {
  id?: string
  draft: CreationDraft
  assets: AssetDraft[]
  /** Key of the asset to use as cover image. */
  coverKey?: string | null
}

export class StorageFullError extends Error {
  constructor() {
    super('Your browser storage is full. Free up space by removing large images or exporting and clearing old items.')
    this.name = 'StorageFullError'
  }
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: string; inner?: { name?: string } }
  return e.name === 'QuotaExceededError' || e.inner?.name === 'QuotaExceededError'
}

async function guardQuota<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (isQuotaError(error)) throw new StorageFullError()
    throw error
  }
}

function cleanDraft(draft: CreationDraft): CreationDraft {
  const video =
    draft.contentType === 'video'
      ? {
          url: draft.video?.url.trim() ?? '',
          durationSeconds:
            draft.video?.durationSeconds != null && Number.isFinite(draft.video.durationSeconds)
              ? Math.max(0, draft.video.durationSeconds)
              : null,
        }
      : null
  return {
    ...draft,
    title: draft.title.trim(),
    model: draft.model.trim(),
    category: draft.category.trim(),
    aspectRatio: draft.aspectRatio.trim(),
    resolution: draft.resolution.trim(),
    seed: draft.seed.trim(),
    sourceUrl: draft.sourceUrl.trim(),
    tags: normaliseTags(draft.tags),
    collectionIds: Array.from(new Set(draft.collectionIds)),
    video,
  }
}

export async function saveCreation({ id, draft, assets, coverKey }: SaveCreationInput): Promise<string> {
  // Read new file data first: IndexedDB transactions can't wait on other async work.
  const newData = new Map<string, { data: ArrayBuffer; thumb: ArrayBuffer | null; thumbType: string | null }>()
  for (const draftAsset of assets) {
    if (!draftAsset.blob) continue
    newData.set(draftAsset.key, {
      data: await draftAsset.blob.arrayBuffer(),
      thumb: draftAsset.thumb ? await draftAsset.thumb.arrayBuffer() : null,
      thumbType: draftAsset.thumb?.type || null,
    })
  }

  return guardQuota(() =>
    db.transaction('rw', db.creations, db.assets, db.assetFiles, async () => {
      const now = Date.now()
      const existing = id ? await db.creations.get(id) : undefined
      const creationId = existing?.id ?? id ?? newId()
      const clean = cleanDraft(draft)

      const previousAssets = existing ? await db.assets.where('creationId').equals(creationId).toArray() : []
      const keptIds = new Set(assets.filter((a) => a.id).map((a) => a.id as string))
      const removed = previousAssets.filter((a) => !keptIds.has(a.id)).map((a) => a.id)
      if (removed.length) await Promise.all([db.assets.bulkDelete(removed), db.assetFiles.bulkDelete(removed)])

      const previousById = new Map(previousAssets.map((a) => [a.id, a]))
      const keyToId = new Map<string, string>()
      const assetIds: string[] = []
      for (const draftAsset of assets) {
        const assetId = draftAsset.id ?? newId()
        const previous = draftAsset.id ? previousById.get(draftAsset.id) : undefined
        const fresh = newData.get(draftAsset.key)
        if (!fresh && !previous) continue
        keyToId.set(draftAsset.key, assetId)
        assetIds.push(assetId)
        const meta = {
          role: draftAsset.role,
          name: draftAsset.name,
          alt: draftAsset.alt.trim(),
          description: draftAsset.description.trim(),
        }
        if (fresh) {
          const record: Asset = {
            ...meta,
            id: assetId,
            creationId,
            mimeType: draftAsset.mimeType,
            size: draftAsset.size,
            width: draftAsset.width,
            height: draftAsset.height,
            thumb: fresh.thumb,
            thumbType: fresh.thumbType,
            addedAt: previous?.addedAt ?? now,
          }
          await db.assets.put(record)
          await db.assetFiles.put({ id: assetId, data: fresh.data })
        } else {
          await db.assets.update(assetId, meta)
        }
      }

      const preferredCover = coverKey ? keyToId.get(coverKey) : undefined
      const coverAssetId = pickCover(assetIds, assets.filter((a) => keyToId.has(a.key)), preferredCover)

      const record: Creation = {
        ...clean,
        id: creationId,
        assetIds,
        coverAssetId,
        parentId: clean.parentId ?? existing?.parentId ?? null,
        parentTitle: clean.parentTitle ?? existing?.parentTitle ?? null,
        // Editing a sample item makes it the user's own, so it survives "remove sample data".
        isSample: false,
        addedAt: existing?.addedAt ?? now,
        updatedAt: now,
        lastUsedAt: existing?.lastUsedAt ?? null,
      }
      await db.creations.put(record)
      return creationId
    }),
  )
}

function pickCover(assetIds: string[], drafts: AssetDraft[], preferred?: string): string | null {
  if (preferred && assetIds.includes(preferred)) return preferred
  const byRole = (role: AssetRole) => drafts.findIndex((d) => d.role === role)
  for (const role of ['output', 'thumbnail', 'reference'] as const) {
    const index = byRole(role)
    if (index >= 0) return assetIds[index]
  }
  return assetIds[0] ?? null
}

export async function deleteCreations(ids: string[]): Promise<void> {
  await db.transaction('rw', db.creations, db.assets, db.assetFiles, async () => {
    await deleteAssetsOf(ids)
    await db.creations.bulkDelete(ids)
  })
}

export async function toggleFavourite(id: string): Promise<boolean> {
  const creation = await db.creations.get(id)
  if (!creation) return false
  const favourite = !creation.favourite
  await db.creations.update(id, { favourite })
  return favourite
}

export async function markUsed(id: string): Promise<void> {
  await db.creations.update(id, { lastUsedAt: Date.now() })
}

/**
 * Creates an independent copy for experimenting with a new version.
 * Attachments are copied, so editing either record never affects the other.
 */
export async function duplicateCreation(id: string): Promise<string> {
  return guardQuota(() =>
    db.transaction('rw', db.creations, db.assets, db.assetFiles, async () => {
      const original = await db.creations.get(id)
      if (!original) throw new Error('The original item no longer exists.')
      const now = Date.now()
      const copyId = newId()
      const originalAssets = await db.assets.where('creationId').equals(id).toArray()
      const files = await db.assetFiles.bulkGet(originalAssets.map((a) => a.id))
      const idMap = new Map<string, string>()
      for (const [index, asset] of originalAssets.entries()) {
        const file = files[index]
        if (!file) continue
        const assetId = newId()
        idMap.set(asset.id, assetId)
        await db.assets.put({ ...asset, id: assetId, creationId: copyId, addedAt: now })
        await db.assetFiles.put({ id: assetId, data: file.data })
      }
      const copy: Creation = {
        ...original,
        id: copyId,
        title: variationTitle(original.title),
        assetIds: original.assetIds.map((a) => idMap.get(a)).filter((a): a is string => Boolean(a)),
        coverAssetId: original.coverAssetId ? (idMap.get(original.coverAssetId) ?? null) : null,
        parentId: original.id,
        parentTitle: original.title || 'Untitled',
        favourite: false,
        isSample: false,
        addedAt: now,
        updatedAt: now,
        lastUsedAt: null,
      }
      await db.creations.put(copy)
      return copyId
    }),
  )
}

function variationTitle(title: string): string {
  const base = title.trim() || 'Untitled'
  const match = /^(.*) \(variation(?: (\d+))?\)$/.exec(base)
  if (match) return `${match[1]} (variation ${Number(match[2] ?? 1) + 1})`
  return `${base} (variation)`
}

/** Returns the original and every variation in the same family, oldest first. */
export async function getVariationFamily(id: string): Promise<Creation[]> {
  const all = await db.creations.toArray()
  const byId = new Map(all.map((c) => [c.id, c]))
  let root = byId.get(id)
  const guard = new Set<string>()
  while (root?.parentId && byId.has(root.parentId) && !guard.has(root.id)) {
    guard.add(root.id)
    root = byId.get(root.parentId)
  }
  if (!root) return []
  const family: Creation[] = []
  const queue = [root]
  const seen = new Set<string>()
  while (queue.length) {
    const current = queue.shift()!
    if (seen.has(current.id)) continue
    seen.add(current.id)
    family.push(current)
    queue.push(...all.filter((c) => c.parentId === current.id))
  }
  return family.sort((a, b) => a.addedAt - b.addedAt)
}

// ---------------------------------------------------------------------------
// Collections

export async function createCollection(input: { name: string; description?: string; color?: CollectionColor }) {
  const name = input.name.trim()
  if (!name) throw new Error('Please give the collection a name.')
  const now = Date.now()
  const collection: Collection = {
    id: newId(),
    name: name.slice(0, 80),
    description: (input.description ?? '').trim(),
    color: input.color ?? 'amber',
    isSample: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.collections.add(collection)
  return collection
}

export async function updateCollection(id: string, changes: Partial<Pick<Collection, 'name' | 'description' | 'color'>>) {
  const update: Partial<Collection> = { ...changes, updatedAt: Date.now(), isSample: false }
  if (changes.name !== undefined) {
    const name = changes.name.trim()
    if (!name) throw new Error('Please give the collection a name.')
    update.name = name.slice(0, 80)
  }
  await db.collections.update(id, update)
}

/** Deletes a collection. Items inside it are kept — they're only unlinked. */
export async function deleteCollection(id: string) {
  await db.transaction('rw', db.collections, db.creations, async () => {
    await db.creations
      .where('collectionIds')
      .equals(id)
      .modify((c) => {
        c.collectionIds = c.collectionIds.filter((x) => x !== id)
      })
    await db.collections.delete(id)
  })
}

export async function setInCollection(creationIds: string[], collectionId: string, include: boolean) {
  await db.transaction('rw', db.creations, async () => {
    for (const id of creationIds) {
      const creation = await db.creations.get(id)
      if (!creation) continue
      const has = creation.collectionIds.includes(collectionId)
      if (include && !has) await db.creations.update(id, { collectionIds: [...creation.collectionIds, collectionId] })
      if (!include && has) {
        await db.creations.update(id, { collectionIds: creation.collectionIds.filter((x) => x !== collectionId) })
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Library-wide

export async function clearAllData() {
  await db.transaction('rw', [db.creations, db.assets, db.assetFiles, db.collections, db.meta], async () => {
    await Promise.all([db.creations.clear(), db.assets.clear(), db.assetFiles.clear(), db.collections.clear(), db.meta.clear()])
  })
}

export async function removeSampleData() {
  await db.transaction('rw', [db.creations, db.assets, db.assetFiles, db.collections], async () => {
    const samples = (await db.creations.filter((c) => c.isSample).primaryKeys()) as string[]
    await deleteAssetsOf(samples)
    await db.creations.bulkDelete(samples)

    const sampleCollections = await db.collections.filter((c) => c.isSample).toArray()
    for (const collection of sampleCollections) {
      const stillUsed = await db.creations.where('collectionIds').equals(collection.id).count()
      if (stillUsed > 0) await db.collections.update(collection.id, { isSample: false })
      else await db.collections.delete(collection.id)
    }
  })
}

export async function hasSampleData(): Promise<boolean> {
  const creation = await db.creations.filter((c) => c.isSample).first()
  return Boolean(creation)
}
