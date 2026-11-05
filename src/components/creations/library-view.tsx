import { ArrowDownUp, Check, ChevronDown, FolderOpen, LayoutGrid, List, Search, Sparkles, Star, X } from 'lucide-react'
import { Input } from '../ui/input'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useCollections, useCreations } from '../../lib/hooks'
import { COLLECTION_COLOR_CLASSES, CONTENT_TYPE_LABELS } from '../../lib/labels'
import { applyFilters, buildSearchIndex, DEFAULT_FILTERS, SORT_LABELS, type LibraryFilters, type SortOrder } from '../../lib/search'
import { CONTENT_TYPES, type ContentType, type Creation } from '../../lib/types'
import { cn, pluralise } from '../../lib/utils'
import { usePreferences, type ViewMode } from '../../store/preferences'
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '../ui/menu'
import { Segmented } from '../ui/misc'
import { CreationCard, CreationRow } from './creation-card'
import { TypeIcon } from './media'

export function useLibraryFilters(fixed: Partial<LibraryFilters> = {}) {
  const [params, setParams] = useSearchParams()
  const defaultView = usePreferences((s) => s.defaultView)

  const filters: LibraryFilters = {
    query: params.get('q') ?? '',
    types: (params.get('type')?.split(',').filter((t) => CONTENT_TYPES.includes(t as ContentType)) ?? []) as ContentType[],
    collectionId: params.get('collection'),
    favouritesOnly: params.get('fav') === '1',
    model: params.get('model'),
    tag: params.get('tag'),
    sort: (params.get('sort') as SortOrder) in SORT_LABELS ? (params.get('sort') as SortOrder) : DEFAULT_FILTERS.sort,
    ...fixed,
  }
  const view: ViewMode = params.get('view') === 'list' ? 'list' : params.get('view') === 'grid' ? 'grid' : defaultView

  function set(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  return { filters, view, set }
}

function FilterButton({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors [&_svg]:size-3.5',
        active ? 'border-accent/50 bg-accent-soft text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
      )}
    >
      {children}
    </span>
  )
}

export function LibraryToolbar({
  filters,
  view,
  set,
  creations,
  hideCollectionFilter,
  showSearch,
}: {
  filters: LibraryFilters
  view: ViewMode
  set: (changes: Record<string, string | null>) => void
  creations: Creation[]
  hideCollectionFilter?: boolean
  showSearch?: boolean
}) {
  const collections = useCollections()
  const models = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of creations) if (c.model) counts.set(c.model, (counts.get(c.model) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [creations])
  const selectedCollection = collections?.find((c) => c.id === filters.collectionId)

  function toggleType(type: ContentType) {
    const next = filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type]
    set({ type: next.length ? next.join(',') : null })
  }

  return (
    <div className="flex flex-col gap-3">
      {showSearch && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input
            type="search"
            value={filters.query}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search this collection…"
            aria-label="Search this collection"
            className="pl-9"
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="-mx-4 flex scrollbar-none items-center gap-1 overflow-x-auto px-4 max-sm:w-[calc(100%+2rem)] sm:mx-0 sm:flex-wrap sm:px-0"
          role="group"
          aria-label="Filter by type"
        >
          <button
            type="button"
            onClick={() => set({ type: null })}
            aria-pressed={filters.types.length === 0}
            className={cn(
              'h-8 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
              filters.types.length === 0 ? 'bg-surface-3 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            All
          </button>
          {CONTENT_TYPES.map((type) => {
            const active = filters.types.includes(type)
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                aria-pressed={active}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
                  active ? 'bg-surface-3 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <TypeIcon type={type} className="size-3.5" />
                {CONTENT_TYPE_LABELS[type]}
              </button>
            )
          })}
        </div>

        <div className="flex scrollbar-none items-center gap-2 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 sm:ml-auto sm:flex-wrap">
          <button
            type="button"
            aria-pressed={filters.favouritesOnly}
            onClick={() => set({ fav: filters.favouritesOnly ? null : '1' })}
          >
            <FilterButton active={filters.favouritesOnly}>
              <Star className={cn(filters.favouritesOnly && 'fill-current text-accent')} /> Favourites
            </FilterButton>
          </button>

          {!hideCollectionFilter && (
            <Menu modal={false}>
              <MenuTrigger aria-label="Filter by collection">
                <FilterButton active={Boolean(selectedCollection)}>
                  <FolderOpen />
                  <span className="max-w-32 truncate">{selectedCollection?.name ?? 'Collection'}</span>
                  <ChevronDown />
                </FilterButton>
              </MenuTrigger>
              <MenuContent className="max-h-80 overflow-y-auto">
                <MenuLabel>Collection</MenuLabel>
                <MenuItem onSelect={() => set({ collection: null })} icon={!filters.collectionId ? <Check /> : <span className="size-4" />}>
                  Any collection
                </MenuItem>
                {collections?.map((c) => (
                  <MenuItem
                    key={c.id}
                    onSelect={() => set({ collection: c.id })}
                    icon={filters.collectionId === c.id ? <Check /> : <span className={cn('m-1 size-2 rounded-full', COLLECTION_COLOR_CLASSES[c.color].dot)} />}
                  >
                    {c.name}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          )}

          <Menu modal={false}>
            <MenuTrigger aria-label="Filter by model">
              <FilterButton active={Boolean(filters.model)}>
                <Sparkles />
                <span className="max-w-32 truncate">{filters.model ?? 'Model'}</span>
                <ChevronDown />
              </FilterButton>
            </MenuTrigger>
            <MenuContent className="max-h-80 overflow-y-auto">
              <MenuLabel>Tool / model</MenuLabel>
              <MenuItem onSelect={() => set({ model: null })} icon={!filters.model ? <Check /> : <span className="size-4" />}>
                Any model
              </MenuItem>
              {models.length === 0 && <div className="px-2 py-1.5 text-xs text-subtle">No models recorded yet</div>}
              {models.map(([model, count]) => (
                <MenuItem
                  key={model}
                  onSelect={() => set({ model })}
                  icon={filters.model === model ? <Check /> : <span className="size-4" />}
                  shortcut={String(count)}
                >
                  {model}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>

          <Menu modal={false}>
            <MenuTrigger aria-label="Sort">
              <FilterButton>
                <ArrowDownUp />
                {SORT_LABELS[filters.sort]}
              </FilterButton>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Sort by</MenuLabel>
              {(Object.keys(SORT_LABELS) as SortOrder[])
                .filter((s) => s !== 'relevance' || filters.query)
                .map((sort) => (
                  <MenuCheckboxItem key={sort} checked={filters.sort === sort} onCheckedChange={() => set({ sort: sort === 'newest' ? null : sort })}>
                    {SORT_LABELS[sort]}
                  </MenuCheckboxItem>
                ))}
            </MenuContent>
          </Menu>

          <Segmented<ViewMode>
            label="View"
            size="sm"
            value={view}
            onChange={(v) => set({ view: v })}
            options={[
              { value: 'grid', label: 'Grid view', icon: <LayoutGrid />, hideLabel: true },
              { value: 'list', label: 'List view', icon: <List />, hideLabel: true },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

export function ActiveFilters({
  filters,
  set,
  count,
  hideCollection,
}: {
  filters: LibraryFilters
  set: (changes: Record<string, string | null>) => void
  count: number
  hideCollection?: boolean
}) {
  const collections = useCollections()
  const chips: { key: string; label: string; clear: Record<string, null> }[] = []
  if (filters.query) chips.push({ key: 'q', label: `“${filters.query}”`, clear: { q: null } })
  if (filters.tag) chips.push({ key: 'tag', label: `#${filters.tag}`, clear: { tag: null } })
  if (filters.model) chips.push({ key: 'model', label: filters.model, clear: { model: null } })
  if (!hideCollection && filters.collectionId) {
    chips.push({ key: 'collection', label: collections?.find((c) => c.id === filters.collectionId)?.name ?? 'Collection', clear: { collection: null } })
  }
  if (filters.favouritesOnly) chips.push({ key: 'fav', label: 'Favourites', clear: { fav: null } })
  for (const type of filters.types) chips.push({ key: type, label: CONTENT_TYPE_LABELS[type], clear: { type: null } })

  return (
    <div className="flex min-h-7 flex-wrap items-center gap-1.5 text-[13px]">
      <span className="mr-1 text-muted" aria-live="polite">
        {pluralise(count, 'result')}
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => set(chip.clear)}
          className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-2 pr-1 pl-2 text-xs text-fg hover:bg-surface-3"
          aria-label={`Remove filter ${chip.label}`}
        >
          {chip.label}
          <X className="size-3 text-subtle" />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={() => set({ q: null, tag: null, model: null, fav: null, type: null, ...(hideCollection ? {} : { collection: null }) })}
          className="px-1 text-xs text-muted hover:text-fg"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

export function CreationsGrid({ creations, view }: { creations: Creation[]; view: ViewMode }) {
  if (view === 'list') {
    return (
      <div className="overflow-hidden rounded-xl border border-line bg-surface" data-testid="creations-list">
        {creations.map((c) => (
          <CreationRow key={c.id} creation={c} />
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" data-testid="creations-grid">
      {creations.map((c) => (
        <CreationCard key={c.id} creation={c} />
      ))}
    </div>
  )
}

export function useFilteredCreations(filters: LibraryFilters) {
  const creations = useCreations()
  const index = useMemo(() => (creations ? buildSearchIndex(creations) : null), [creations])
  const filterKey = JSON.stringify(filters)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const results = useMemo(() => (creations ? applyFilters(creations, filters, index) : undefined), [creations, filterKey, index])
  return { all: creations, results }
}
