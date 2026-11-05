import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useCollections, useCreations } from '../../lib/hooks'
import { COLLECTION_COLOR_CLASSES } from '../../lib/labels'
import { setInCollection } from '../../lib/repo'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, type ReturnFocus } from '../ui/dialog'
import { CollectionDialog } from './collection-dialog'

/** Lets the user add/remove one or more items to/from collections. */
export function CollectionPickerDialog({
  open,
  onOpenChange,
  creationIds,
  returnFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  creationIds: string[]
  returnFocus?: ReturnFocus
}) {
  const collections = useCollections()
  const creations = useCreations()
  const [creating, setCreating] = useState(false)
  const selected = (creations ?? []).filter((c) => creationIds.includes(c.id))

  async function toggle(collectionId: string, name: string) {
    const allIn = selected.length > 0 && selected.every((c) => c.collectionIds.includes(collectionId))
    await setInCollection(creationIds, collectionId, !allIn)
    toast.success(allIn ? `Removed from “${name}”` : `Added to “${name}”`)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title="Add to collections"
          description={selected.length > 1 ? `${selected.length} items selected` : 'Choose where this item belongs. Items can be in several collections.'}
          size="sm"
          returnFocus={returnFocus}
        >
          <div className="-mx-2 flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {collections?.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted">You don’t have any collections yet.</p>
            )}
            {collections?.map((collection) => {
              const count = selected.filter((c) => c.collectionIds.includes(collection.id)).length
              const state = count === 0 ? 'none' : count === selected.length ? 'all' : 'some'
              return (
                <button
                  key={collection.id}
                  type="button"
                  role="checkbox"
                  aria-checked={state === 'all' ? true : state === 'some' ? 'mixed' : false}
                  onClick={() => toggle(collection.id, collection.name)}
                  className="flex h-9 items-center gap-3 rounded-md px-2 text-left text-sm hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded border',
                      state === 'none' ? 'border-line-strong' : 'border-accent bg-accent text-accent-fg',
                    )}
                  >
                    {state === 'all' && <Check className="size-3" strokeWidth={3} />}
                    {state === 'some' && <span className="h-0.5 w-2 rounded bg-accent-fg" />}
                  </span>
                  <span className={cn('size-2 rounded-full', COLLECTION_COLOR_CLASSES[collection.color].dot)} />
                  <span className="flex-1 truncate">{collection.name}</span>
                </button>
              )
            })}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" icon={<Plus />} onClick={() => setCreating(true)}>
              New collection
            </Button>
            <DialogClose asChild>
              <Button variant="primary">Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CollectionDialog open={creating} onOpenChange={setCreating} addCreationIds={creationIds} />
    </>
  )
}
