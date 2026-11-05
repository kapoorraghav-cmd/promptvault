import MiniSearch from 'minisearch'
import type { ContentType, Creation } from './types'

export type SortOrder = 'newest' | 'oldest' | 'updated' | 'az' | 'za' | 'relevance'

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  updated: 'Recently edited',
  az: 'Title A–Z',
  za: 'Title Z–A',
  relevance: 'Best match',
}

export interface LibraryFilters {
  query: string
  types: ContentType[]
  collectionId: string | null
  favouritesOnly: boolean
  model: string | null
  tag: string | null
  sort: SortOrder
}

export const DEFAULT_FILTERS: LibraryFilters = {
  query: '',
  types: [],
  collectionId: null,
  favouritesOnly: false,
  model: null,
  tag: null,
  sort: 'newest',
}

const SEARCH_FIELDS = ['title', 'prompt', 'tags', 'model', 'description', 'category', 'negativePrompt'] as const

/** Builds a local, in-memory full-text index. Nothing leaves the device. */
export function buildSearchIndex(creations: Creation[]) {
  const index = new MiniSearch<Creation>({
    fields: [...SEARCH_FIELDS],
    storeFields: [],
    extractField: (document, field) => {
      const value = document[field as keyof Creation]
      if (Array.isArray(value)) return value.join(' ')
      return typeof value === 'string' ? value : ''
    },
    searchOptions: {
      boost: { title: 3, tags: 2, model: 2, category: 1.5 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.15 : false),
      combineWith: 'AND',
    },
  })
  index.addAll(creations)
  return index
}

function compareTitles(a: Creation, b: Creation) {
  return (a.title || 'Untitled').localeCompare(b.title || 'Untitled', undefined, { sensitivity: 'base', numeric: true })
}

/** Applies search text, filters and sorting. Search results keep relevance order unless a sort is chosen. */
export function applyFilters(
  creations: Creation[],
  filters: LibraryFilters,
  index: MiniSearch<Creation> | null,
): Creation[] {
  let results = creations
  const query = filters.query.trim()
  let relevance: Map<string, number> | null = null

  if (query) {
    relevance = new Map()
    const hits = index ? index.search(query) : []
    for (const hit of hits) relevance.set(String(hit.id), hit.score)
    // Plain substring match as a fallback for punctuation-heavy text like "--ar 16:9".
    const needle = query.toLowerCase()
    for (const c of creations) {
      if (relevance.has(c.id)) continue
      const haystack = [c.title, c.prompt, c.description, c.model, c.category, c.negativePrompt, c.tags.join(' ')]
        .join('\n')
        .toLowerCase()
      if (haystack.includes(needle)) relevance.set(c.id, 0.01)
    }
    results = results.filter((c) => relevance!.has(c.id))
  }

  if (filters.types.length) results = results.filter((c) => filters.types.includes(c.contentType))
  if (filters.collectionId) results = results.filter((c) => c.collectionIds.includes(filters.collectionId!))
  if (filters.favouritesOnly) results = results.filter((c) => c.favourite)
  if (filters.model) {
    const model = filters.model.toLowerCase()
    results = results.filter((c) => c.model.toLowerCase() === model)
  }
  if (filters.tag) results = results.filter((c) => c.tags.includes(filters.tag!))

  const sorted = [...results]
  switch (filters.sort) {
    case 'oldest':
      sorted.sort((a, b) => a.addedAt - b.addedAt)
      break
    case 'updated':
      sorted.sort((a, b) => b.updatedAt - a.updatedAt)
      break
    case 'az':
      sorted.sort(compareTitles)
      break
    case 'za':
      sorted.sort((a, b) => compareTitles(b, a))
      break
    case 'relevance':
      if (relevance) {
        sorted.sort((a, b) => (relevance!.get(b.id) ?? 0) - (relevance!.get(a.id) ?? 0) || b.addedAt - a.addedAt)
        break
      }
      sorted.sort((a, b) => b.addedAt - a.addedAt)
      break
    default:
      sorted.sort((a, b) => b.addedAt - a.addedAt)
  }
  return sorted
}
