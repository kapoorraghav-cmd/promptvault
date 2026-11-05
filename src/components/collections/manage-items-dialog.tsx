import { Check, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useCreations } from '../../lib/hooks'
import { setInCollection } from '../../lib/repo'
import { applyFilters, buildSearchIndex, DEFAULT_FILTERS } from '../../lib/search'
import type { Collection } from '../../lib/types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, type ReturnFocus } from '../ui/dialog'
import { Input } from '../ui/input'
import { CreationCover, TypeIcon } from '../creations/media'

/** Add or remove library items to/from a collection. */
export function ManageItemsDialog({
  open,
  onOpenChange,
  collection,
  returnFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection: Collection
  returnFocus?: ReturnFocus
}) {
  const creations = useCreations()
  const [query, setQuery] = useState('')
  const index = useMemo(() => (creations ? buildSearchIndex(creations) : null), [creations])
  const results = useMemo(
    () => (creations ? applyFilters(creations, { ...DEFAULT_FILTERS, query }, index) : []),
    [creations, query, index],
  )

  async function toggle(id: string, included: boolean) {
    await setInCollection([id], collection.id, !included)
  }

  const count = creations?.filter((c) => c.collectionIds.includes(collection.id)).length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Items in “${collection.name}”`} description={`${count} selected. Click an item to add or remove it.`} size="lg" returnFocus={returnFocus}>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library…" className="pl-9" autoFocus />
        </div>
        <div className="-mx-1 flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto">
          {results.length === 0 && <p className="py-8 text-center text-sm text-muted">No items found.</p>}
          {results.map((creation) => {
            const included = creation.collectionIds.includes(collection.id)
            return (
              <button
                key={creation.id}
                type="button"
                role="checkbox"
                aria-checked={included}
                onClick={() => toggle(creation.id, included)}
                className="flex items-center gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-surface-2"
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded border',
                    included ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong',
                  )}
                >
                  {included && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="size-10 shrink-0 overflow-hidden rounded-md border border-line">
                  {creation.coverAssetId ? (
                    <CreationCover creation={creation} className="size-full" />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-surface-2 text-subtle">
                      <TypeIcon type={creation.contentType} />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{creation.title || 'Untitled'}</span>
                  <span className="block truncate text-xs text-subtle">{creation.model || creation.prompt}</span>
                </span>
              </button>
            )
          })}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="primary" onClick={() => toast.success('Collection updated')}>
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
