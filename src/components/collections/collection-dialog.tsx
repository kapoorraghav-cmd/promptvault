import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { COLLECTION_COLOR_CLASSES } from '../../lib/labels'
import { createCollection, setInCollection, updateCollection } from '../../lib/repo'
import { COLLECTION_COLORS, type Collection, type CollectionColor } from '../../lib/types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, type ReturnFocus } from '../ui/dialog'
import { Field, Input, Textarea } from '../ui/input'

export function CollectionDialog({
  open,
  onOpenChange,
  collection,
  addCreationIds,
  navigateOnCreate = false,
  onCreated,
  returnFocus,
}: {
  returnFocus?: ReturnFocus
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog edits (renames) this collection. */
  collection?: Collection
  /** Items to add to a newly created collection. */
  addCreationIds?: string[]
  navigateOnCreate?: boolean
  onCreated?: (collection: Collection) => void
}) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<CollectionColor>('amber')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(collection?.name ?? '')
      setDescription(collection?.description ?? '')
      setColor(collection?.color ?? COLLECTION_COLORS[Math.floor(Math.random() * COLLECTION_COLORS.length)])
      setError(null)
    }
  }, [open, collection])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Please give the collection a name.')
      return
    }
    setSaving(true)
    try {
      if (collection) {
        await updateCollection(collection.id, { name, description, color })
        toast.success('Collection updated')
      } else {
        const created = await createCollection({ name, description, color })
        if (addCreationIds?.length) await setInCollection(addCreationIds, created.id, true)
        toast.success(`Created “${created.name}”`)
        onCreated?.(created)
        if (navigateOnCreate) navigate(`/collections/${created.id}`)
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={collection ? 'Edit collection' : 'New collection'}
        description={collection ? undefined : 'Collections group related creations, like “Product Photography” or “YouTube Shorts”.'}
        size="sm"
        returnFocus={returnFocus}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Name" error={error}>
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                placeholder="e.g. Cinematic Images"
                maxLength={80}
                autoFocus
              />
            )}
          </Field>
          <Field label="Description" optional>
            {(id) => (
              <Textarea
                id={id}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What belongs in this collection?"
                rows={2}
                className="min-h-16"
              />
            )}
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium">Colour</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Collection colour">
              {COLLECTION_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={color === option}
                  aria-label={option}
                  onClick={() => setColor(option)}
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full border transition-colors',
                    color === option ? 'border-fg/60' : 'border-transparent hover:border-line-strong',
                  )}
                >
                  <span className={cn('size-4 rounded-full', COLLECTION_COLOR_CLASSES[option].dot)} />
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={saving}>
              {collection ? 'Save changes' : 'Create collection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
