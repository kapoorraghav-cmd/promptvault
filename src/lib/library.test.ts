// @vitest-environment node
import 'fake-indexeddb/auto'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup } from './backup/export'
import { analyseImport, applyImport, ImportError, parseBackupFile } from './backup/import'
import { creationToMarkdown } from './backup/markdown'
import { BACKUP_JSON_NAME } from './backup/schema'
import { db } from './db'
import { checkImageFile, sniffImageType } from './images'
import {
  clearAllData,
  createCollection,
  deleteCollection,
  deleteCreations,
  duplicateCreation,
  getVariationFamily,
  markUsed,
  removeSampleData,
  saveCreation,
  setInCollection,
  toggleFavourite,
  updateCollection,
  type AssetDraft,
} from './repo'
import { applyFilters, buildSearchIndex, DEFAULT_FILTERS } from './search'
import { emptyDraft, type CreationDraft } from './types'
import { normaliseTags, safeExternalUrl } from './utils'

// Minimal valid PNG (1×1 pixel).
const PNG_BYTES = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)

function pngBlob() {
  return new Blob([PNG_BYTES], { type: 'image/png' })
}

function imageDraft(overrides: Partial<AssetDraft> = {}): AssetDraft {
  const blob = pngBlob()
  return {
    key: crypto.randomUUID(),
    id: null,
    blob,
    thumb: null,
    name: 'result.png',
    mimeType: 'image/png',
    size: blob.size,
    width: 1,
    height: 1,
    alt: 'A tiny test image',
    description: '',
    role: 'output',
    ...overrides,
  }
}

function draft(overrides: Partial<CreationDraft> = {}): CreationDraft {
  return emptyDraft({
    title: 'Neon alley',
    prompt: 'cinematic neon alley in the rain, 35mm, moody',
    model: 'Midjourney v7',
    tags: ['neon', 'city'],
    ...overrides,
  })
}

beforeEach(async () => {
  await clearAllData()
})

describe('creations', () => {
  it('adds a prompt with an image and reads it back', async () => {
    const id = await saveCreation({ draft: draft(), assets: [imageDraft()] })
    const saved = await db.creations.get(id)
    expect(saved?.title).toBe('Neon alley')
    expect(saved?.prompt).toContain('neon alley')
    expect(saved?.assetIds).toHaveLength(1)
    expect(saved?.coverAssetId).toBe(saved?.assetIds[0])
    const asset = await db.assets.get(saved!.assetIds[0])
    expect(asset?.mimeType).toBe('image/png')
    expect((await db.assetFiles.get(saved!.assetIds[0]))?.data.byteLength).toBe(PNG_BYTES.byteLength)
  })

  it('saves incomplete records', async () => {
    const id = await saveCreation({ draft: emptyDraft({ title: 'Idea for later' }), assets: [] })
    const saved = await db.creations.get(id)
    expect(saved?.prompt).toBe('')
    expect(saved?.title).toBe('Idea for later')
  })

  it('edits a prompt and replaces/removes images', async () => {
    const id = await saveCreation({ draft: draft(), assets: [imageDraft(), imageDraft({ name: 'ref.png', role: 'reference' })] })
    const saved = (await db.creations.get(id))!
    const [first, second] = saved.assetIds
    await saveCreation({
      id,
      draft: draft({ title: 'Neon alley v2', tags: ['Neon', '#rain', 'neon'] }),
      assets: [imageDraft({ key: first, id: first, blob: null, alt: 'Updated alt' })],
    })
    const updated = (await db.creations.get(id))!
    expect(updated.title).toBe('Neon alley v2')
    expect(updated.tags).toEqual(['neon', 'rain'])
    expect(updated.assetIds).toEqual([first])
    expect(await db.assets.get(second)).toBeUndefined()
    expect(await db.assetFiles.get(second)).toBeUndefined()
    expect((await db.assets.get(first))?.alt).toBe('Updated alt')
    expect((await db.assetFiles.get(first))?.data.byteLength).toBe(PNG_BYTES.byteLength)
  })

  it('deletes a prompt and its images', async () => {
    const id = await saveCreation({ draft: draft(), assets: [imageDraft()] })
    const assetId = (await db.creations.get(id))!.assetIds[0]
    await deleteCreations([id])
    expect(await db.creations.get(id)).toBeUndefined()
    expect(await db.assets.where('creationId').equals(id).count()).toBe(0)
    expect(await db.assetFiles.get(assetId)).toBeUndefined()
  })

  it('toggles favourites and records usage', async () => {
    const id = await saveCreation({ draft: draft(), assets: [] })
    expect(await toggleFavourite(id)).toBe(true)
    expect(await toggleFavourite(id)).toBe(false)
    await markUsed(id)
    expect((await db.creations.get(id))?.lastUsedAt).toBeTypeOf('number')
  })

  it('duplicates as an independent variation', async () => {
    const id = await saveCreation({ draft: draft(), assets: [imageDraft()] })
    const copyId = await duplicateCreation(id)
    const copy = (await db.creations.get(copyId))!
    expect(copy.parentId).toBe(id)
    expect(copy.parentTitle).toBe('Neon alley')
    expect(copy.title).toBe('Neon alley (variation)')
    expect(copy.assetIds[0]).not.toBe((await db.creations.get(id))!.assetIds[0])

    await saveCreation({ id: copyId, draft: draft({ prompt: 'changed prompt' }), assets: [] })
    expect((await db.creations.get(id))?.prompt).toBe('cinematic neon alley in the rain, 35mm, moody')
    expect((await db.creations.get(id))?.assetIds).toHaveLength(1)

    await saveCreation({ id: copyId, draft: draft({ title: 'Neon alley (variation)', prompt: 'changed prompt' }), assets: [] })
    const secondCopy = await duplicateCreation(copyId)
    expect((await db.creations.get(secondCopy))?.title).toBe('Neon alley (variation 2)')
    const family = await getVariationFamily(secondCopy)
    expect(family.map((c) => c.id)).toEqual([id, copyId, secondCopy])
  })
})

describe('collections', () => {
  it('creates, renames, assigns and deletes collections', async () => {
    const collection = await createCollection({ name: '  Cinematic Images ' })
    expect(collection.name).toBe('Cinematic Images')
    await updateCollection(collection.id, { name: 'Cinematic' })
    expect((await db.collections.get(collection.id))?.name).toBe('Cinematic')

    const a = await saveCreation({ draft: draft(), assets: [] })
    const b = await saveCreation({ draft: draft({ title: 'Other' }), assets: [] })
    await setInCollection([a, b], collection.id, true)
    expect(await db.creations.where('collectionIds').equals(collection.id).count()).toBe(2)
    await setInCollection([b], collection.id, false)
    expect(await db.creations.where('collectionIds').equals(collection.id).count()).toBe(1)

    await deleteCollection(collection.id)
    expect(await db.collections.get(collection.id)).toBeUndefined()
    expect((await db.creations.get(a))?.collectionIds).toEqual([])
    expect(await db.creations.get(a)).toBeDefined()
  })

  it('rejects empty collection names', async () => {
    await expect(createCollection({ name: '   ' })).rejects.toThrow()
  })
})

describe('search and filters', () => {
  it('finds items by title, prompt, tag, model and description; filters and sorts', async () => {
    const collection = await createCollection({ name: 'Wildlife' })
    const tick = () => new Promise((r) => setTimeout(r, 5))
    await saveCreation({ draft: draft({ title: 'Snow leopard', prompt: 'snow leopard on a ridge', tags: ['wildlife'], model: 'Flux', collectionIds: [collection.id] }), assets: [] })
    await tick()
    await saveCreation({ draft: draft({ title: 'Product shot', prompt: 'perfume bottle', description: 'travertine plinth', model: 'SDXL', contentType: 'image' }), assets: [] })
    await tick()
    await saveCreation({ draft: draft({ title: 'Ad script', prompt: 'write hooks', contentType: 'text', model: 'ChatGPT', favourite: true }), assets: [] })

    const all = await db.creations.toArray()
    const index = buildSearchIndex(all)
    const titles = (q: string, extra = {}) => applyFilters(all, { ...DEFAULT_FILTERS, query: q, ...extra }, index).map((c) => c.title)

    expect(titles('leopard')).toEqual(['Snow leopard'])
    expect(titles('perfume')).toEqual(['Product shot'])
    expect(titles('wildlife')).toEqual(['Snow leopard'])
    expect(titles('chatgpt')).toEqual(['Ad script'])
    expect(titles('travertine')).toEqual(['Product shot'])
    expect(titles('--ar')).toEqual([])
    expect(titles('', { types: ['text'] })).toEqual(['Ad script'])
    expect(titles('', { collectionId: collection.id })).toEqual(['Snow leopard'])
    expect(titles('', { favouritesOnly: true })).toEqual(['Ad script'])
    expect(titles('', { sort: 'az' })).toEqual(['Ad script', 'Product shot', 'Snow leopard'])
    expect(titles('', { sort: 'oldest' })[0]).toBe('Snow leopard')
    expect(titles('', { sort: 'newest' })[0]).toBe('Ad script')
  })
})

describe('backup and restore', () => {
  it('exports a full zip backup and restores it into an empty library', async () => {
    const collection = await createCollection({ name: 'Shorts' })
    const id = await saveCreation({ draft: draft({ collectionIds: [collection.id] }), assets: [imageDraft()] })
    const variation = await duplicateCreation(id)

    const backup = await exportBackup({ kind: 'full' }, { includeFiles: true })
    expect(backup.filename).toMatch(/^promptvault-backup-\d{4}-\d{2}-\d{2}\.zip$/)
    expect(backup.counts).toEqual({ creations: 2, collections: 1, files: 2 })

    await clearAllData()
    const parsed = await parseBackupFile(backup.blob)
    const analysis = await analyseImport(parsed)
    expect(analysis.conflictingCreations).toBe(0)
    const summary = await applyImport(parsed, 'skip')
    expect(summary).toMatchObject({ added: 2, skipped: 0, collectionsAdded: 1, files: 2 })

    const restored = (await db.creations.get(id))!
    expect(restored.collectionIds).toEqual([collection.id])
    expect((await db.creations.get(variation))?.parentId).toBe(id)
    const file = await db.assetFiles.get(restored.assetIds[0])
    expect(new Uint8Array(file!.data)).toEqual(PNG_BYTES)
  })

  it('handles duplicates with skip, replace and keep-both strategies', async () => {
    const id = await saveCreation({ draft: draft(), assets: [imageDraft()] })
    const backup = await exportBackup({ kind: 'full' }, { includeFiles: true })
    await saveCreation({ id, draft: draft({ title: 'Edited locally' }), assets: [] })

    const parsed = await parseBackupFile(backup.blob)
    expect((await analyseImport(parsed)).conflictingCreations).toBe(1)

    expect(await applyImport(parsed, 'skip')).toMatchObject({ added: 0, skipped: 1 })
    expect((await db.creations.get(id))?.title).toBe('Edited locally')

    expect(await applyImport(parsed, 'replace')).toMatchObject({ replaced: 1 })
    expect((await db.creations.get(id))?.title).toBe('Neon alley')
    expect((await db.creations.get(id))?.assetIds).toHaveLength(1)

    expect(await applyImport(parsed, 'copy')).toMatchObject({ added: 1 })
    expect(await db.creations.count()).toBe(2)
    expect(await db.assets.count()).toBe(2)
  })

  it('exports a data-only JSON backup without files', async () => {
    await saveCreation({ draft: draft(), assets: [imageDraft()] })
    const backup = await exportBackup({ kind: 'full' }, { includeFiles: false })
    expect(backup.filename).toMatch(/\.json$/)
    const json = JSON.parse(await backup.blob.text())
    expect(json.format).toBe('promptvault-backup')
    expect(json.assets).toEqual([])
    await clearAllData()
    const parsed = await parseBackupFile(backup.blob)
    await applyImport(parsed, 'skip')
    const [restored] = await db.creations.toArray()
    expect(restored.title).toBe('Neon alley')
    expect(restored.assetIds).toEqual([])
    expect(restored.coverAssetId).toBeNull()
  })

  it('exports only selected collections or items', async () => {
    const keep = await createCollection({ name: 'Keep' })
    await createCollection({ name: 'Other' })
    await saveCreation({ draft: draft({ title: 'In keep', collectionIds: [keep.id] }), assets: [] })
    const loose = await saveCreation({ draft: draft({ title: 'Loose' }), assets: [] })

    const byCollection = await exportBackup({ kind: 'collections', collectionIds: [keep.id] }, { includeFiles: true })
    expect(byCollection.counts).toMatchObject({ creations: 1, collections: 1 })
    const byItem = await exportBackup({ kind: 'items', creationIds: [loose] }, { includeFiles: false })
    expect(byItem.counts).toMatchObject({ creations: 1, collections: 0 })
  })

  it('rejects invalid, corrupted and foreign files with a clear message', async () => {
    const cases: Blob[] = [
      new Blob([]),
      new Blob(['not json at all'], { type: 'text/plain' }),
      new Blob(['{"broken": '], { type: 'application/json' }),
      new Blob([JSON.stringify({ hello: 'world' })], { type: 'application/json' }),
      new Blob([JSON.stringify({ format: 'promptvault-backup', version: 99, creations: [{ id: 'x' }] })]),
      new Blob([JSON.stringify({ format: 'promptvault-backup', version: 1, creations: [], collections: [] })]),
      new Blob([Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5])]),
      new Blob([zipSync({ 'readme.txt': strToU8('hi') }) as Uint8Array<ArrayBuffer>]),
    ]
    for (const file of cases) {
      await expect(parseBackupFile(file)).rejects.toBeInstanceOf(ImportError)
    }
    expect(await db.creations.count()).toBe(0)
  })

  it('skips invalid records and fake image files but imports the rest', async () => {
    const id = await saveCreation({ draft: draft(), assets: [imageDraft()] })
    const backup = await exportBackup({ kind: 'full' }, { includeFiles: true })
    const files = unzipSync(new Uint8Array(await backup.blob.arrayBuffer()))
    const data = JSON.parse(new TextDecoder().decode(files[BACKUP_JSON_NAME]))
    data.creations.push({ title: 'missing id' }, 'garbage')
    data.creations[0].title = '<img src=x onerror=alert(1)>'
    const assetPath = data.assets[0].file
    files[assetPath] = strToU8('<script>alert(1)</script>')
    files[BACKUP_JSON_NAME] = strToU8(JSON.stringify(data))

    await clearAllData()
    const parsed = await parseBackupFile(new Blob([zipSync(files) as Uint8Array<ArrayBuffer>]))
    expect(parsed.creations).toHaveLength(1)
    expect(parsed.assets).toHaveLength(0)
    expect(parsed.warnings.length).toBeGreaterThanOrEqual(2)
    await applyImport(parsed, 'skip')
    const restored = (await db.creations.get(id))!
    // Text is stored as plain text; React escapes it when rendering.
    expect(restored.title).toBe('<img src=x onerror=alert(1)>')
    expect(restored.assetIds).toEqual([])
  })
})

describe('sample data', () => {
  it('removes only sample items and unused sample collections', async () => {
    const own = await saveCreation({ draft: draft({ title: 'Mine' }), assets: [] })
    await db.collections.put({ id: 'sample-c', name: 'Sample C', description: '', color: 'amber', isSample: true, createdAt: 1, updatedAt: 1 })
    await db.creations.put({ ...(await db.creations.get(own))!, id: 'sample-1', title: 'Sample', isSample: true, collectionIds: ['sample-c'] })
    await removeSampleData()
    expect(await db.creations.get('sample-1')).toBeUndefined()
    expect(await db.collections.get('sample-c')).toBeUndefined()
    expect(await db.creations.get(own)).toBeDefined()
  })
})

describe('helpers', () => {
  it('sniffs real image types and rejects disguised files', async () => {
    expect(sniffImageType(PNG_BYTES)).toBe('image/png')
    expect(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(strToU8('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(sniffImageType(strToU8('<svg onload=alert(1)>'))).toBeNull()

    expect((await checkImageFile(pngBlob())).ok).toBe(true)
    expect((await checkImageFile(new Blob([]))).ok).toBe(false)
    const fake = new File(['<html></html>'], 'photo.png', { type: 'image/png' })
    expect(await checkImageFile(fake)).toMatchObject({ ok: false })
    const svg = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })
    const svgCheck = await checkImageFile(svg)
    expect(svgCheck.ok).toBe(false)
    expect(!svgCheck.ok && svgCheck.reason).toMatch(/SVG/)
  })

  it('only allows http(s) links', () => {
    expect(safeExternalUrl('https://example.com/video')).toBe('https://example.com/video')
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('data:text/html,hi')).toBeNull()
    expect(safeExternalUrl('not a url')).toBeNull()
  })

  it('normalises tags', () => {
    expect(normaliseTags([' #Neon ', 'neon', 'Golden  Hour', ''])).toEqual(['neon', 'golden hour'])
  })

  it('exports Markdown that keeps prompt text intact', async () => {
    const id = await saveCreation({ draft: draft({ prompt: 'use ``` fences carefully', negativePrompt: 'blurry' }), assets: [] })
    const md = creationToMarkdown((await db.creations.get(id))!)
    expect(md).toContain('## Neon alley')
    expect(md).toContain('````text\nuse ``` fences carefully\n````')
    expect(md).toContain('### Negative prompt')
    expect(md).toContain('**Model:** Midjourney v7')
  })
})
