import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { getOriginalBlob, thumbBlob } from './assets'
import { db } from './db'
import type { Asset, Collection, Creation } from './types'

export function useCreations(): Creation[] | undefined {
  return useLiveQuery(() => db.creations.toArray(), [])
}

export function useCollections(): Collection[] | undefined {
  return useLiveQuery(() => db.collections.orderBy('createdAt').toArray(), [])
}

export function useCreation(id: string | undefined): Creation | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.creations.get(id)) ?? null) : null), [id])
}

export function useCreationAssets(creationId: string | undefined): Asset[] | undefined {
  return useLiveQuery(async () => {
    if (!creationId) return []
    const creation = await db.creations.get(creationId)
    const assets = await db.assets.where('creationId').equals(creationId).toArray()
    const order = new Map((creation?.assetIds ?? []).map((id, index) => [id, index]))
    return assets.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
  }, [creationId])
}

/**
 * Object URLs are shared and reference-counted so many cards showing the same
 * image don't create duplicate copies in memory.
 */
const urlCache = new Map<string, { url: string; refs: number }>()

function acquireUrl(key: string, blob: Blob): string {
  const cached = urlCache.get(key)
  if (cached) {
    cached.refs++
    return cached.url
  }
  const url = URL.createObjectURL(blob)
  urlCache.set(key, { url, refs: 1 })
  return url
}

function releaseUrl(key: string) {
  const cached = urlCache.get(key)
  if (!cached) return
  cached.refs--
  if (cached.refs <= 0) {
    // Delay so quick re-mounts (e.g. switching views) reuse the URL.
    setTimeout(() => {
      const current = urlCache.get(key)
      if (current && current.refs <= 0) {
        URL.revokeObjectURL(current.url)
        urlCache.delete(key)
      }
    }, 5_000)
  }
}

/** Returns a displayable URL for an asset, preferring the thumbnail when asked. */
export function useAssetUrl(assetId: string | null | undefined, variant: 'thumb' | 'full' = 'thumb') {
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    const held: { key: string | null } = { key: null }
    setMissing(false)
    if (!assetId) {
      setUrl(null)
      return
    }
    ;(async () => {
      const asset = await db.assets.get(assetId)
      if (cancelled) return
      if (!asset) {
        setMissing(true)
        setUrl(null)
        return
      }
      const useThumb = variant === 'thumb' && asset.thumb
      const cacheKey = `${asset.id}:${useThumb ? 'thumb' : 'full'}:${asset.size}`
      const cached = urlCache.get(cacheKey)
      const blob = cached ? null : useThumb ? thumbBlob(asset) : await getOriginalBlob(asset)
      if (cancelled) return
      if (!cached && !blob) {
        setMissing(true)
        return
      }
      held.key = cacheKey
      setUrl(acquireUrl(cacheKey, blob ?? new Blob()))
    })().catch(() => !cancelled && setMissing(true))
    return () => {
      cancelled = true
      if (held.key) releaseUrl(held.key)
    }
  }, [assetId, variant])

  return { url, missing }
}

/** Object URL for a not-yet-saved file (form previews). */
export function useBlobUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches)
  useEffect(() => {
    const media = window.matchMedia?.(query)
    if (!media) return
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}
