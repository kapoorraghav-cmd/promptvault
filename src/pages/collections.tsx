import { Download, FileText, FolderOpen, ListChecks, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { CollectionDialog } from '../components/collections/collection-dialog'
import { ManageItemsDialog } from '../components/collections/manage-items-dialog'
import { ActiveFilters, CreationsGrid, LibraryToolbar, useFilteredCreations, useLibraryFilters } from '../components/creations/library-view'
import { AssetImage } from '../components/creations/media'
import { Button, ButtonLink, IconButton } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, useAfterMenuClose } from '../components/ui/menu'
import { Badge, EmptyState, PageHeader } from '../components/ui/misc'
import { downloadBackup, downloadMarkdown } from '../lib/export-actions'
import { useCollections, useCreations } from '../lib/hooks'
import { COLLECTION_COLOR_CLASSES } from '../lib/labels'
import { deleteCollection } from '../lib/repo'
import type { Collection, Creation } from '../lib/types'
import { cn, pluralise } from '../lib/utils'

function CollectionActions({ collection, items, onDeleted }: { collection: Collection; items: Creation[]; onDeleted?: () => void }) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [managing, setManaging] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { afterClose, onCloseAutoFocus } = useAfterMenuClose()
  return (
    <>
      <Menu modal={false}>
        <MenuTrigger asChild ref={triggerRef}>
          <IconButton label="Collection actions" size="sm" tooltip={false} variant="ghost">
            <MoreHorizontal />
          </IconButton>
        </MenuTrigger>
        <MenuContent onCloseAutoFocus={onCloseAutoFocus}>
          <MenuItem icon={<Pencil />} onSelect={afterClose(() => setEditing(true))}>
            Rename or edit
          </MenuItem>
          <MenuItem icon={<ListChecks />} onSelect={afterClose(() => setManaging(true))}>
            Add or remove items
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Download />} onSelect={() => downloadBackup({ kind: 'collections', collectionIds: [collection.id] }, true, collection.name)}>
            Export with images (.zip)
          </MenuItem>
          <MenuItem icon={<FileText />} disabled={!items.length} onSelect={() => downloadMarkdown(items, collection.name, collection.name)}>
            Export prompts as Markdown
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 />} destructive onSelect={afterClose(() => setDeleting(true))}>
            Delete collection…
          </MenuItem>
        </MenuContent>
      </Menu>
      <CollectionDialog open={editing} onOpenChange={setEditing} collection={collection} returnFocus={triggerRef} />
      <ManageItemsDialog open={managing} onOpenChange={setManaging} collection={collection} returnFocus={triggerRef} />
      <ConfirmDialog
        returnFocus={triggerRef}
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${collection.name}”?`}
        description="The collection will be removed. The items inside it stay in your library."
        confirmLabel="Delete collection"
        destructive
        onConfirm={async () => {
          await deleteCollection(collection.id)
          toast.success('Collection deleted')
          onDeleted?.()
        }}
      />
    </>
  )
}

function Mosaic({ items }: { items: Creation[] }) {
  const covers = items.filter((c) => c.coverAssetId).slice(0, 3)
  if (!covers.length) {
    return (
      <div className="flex size-full items-center justify-center bg-surface-2 text-subtle">
        <FolderOpen className="size-6" />
      </div>
    )
  }
  return (
    <div className={cn('grid size-full gap-0.5', covers.length === 1 ? 'grid-cols-1' : 'grid-cols-[2fr_1fr] grid-rows-2')}>
      {covers.map((c, i) => (
        <AssetImage key={c.id} assetId={c.coverAssetId} alt="" className={cn('size-full', covers.length > 1 && i === 0 && 'row-span-2', covers.length === 2 && i === 1 && 'row-span-2')} />
      ))}
    </div>
  )
}

export function CollectionsPage() {
  const collections = useCollections()
  const creations = useCreations()
  const [creating, setCreating] = useState(false)

  const itemsByCollection = useMemo(() => {
    const map = new Map<string, Creation[]>()
    for (const c of [...(creations ?? [])].sort((a, b) => b.addedAt - a.addedAt)) {
      for (const id of c.collectionIds) map.set(id, [...(map.get(id) ?? []), c])
    }
    return map
  }, [creations])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <PageHeader
        title="Collections"
        description="Group related creations — by project, style, client or platform."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
            New collection
          </Button>
        }
      />
      {collections?.length === 0 ? (
        <EmptyState
          icon={<FolderOpen />}
          title="No collections yet"
          description="Try collections like “Cinematic Images”, “YouTube Shorts” or “Product Photography”. An item can live in several collections."
          action={
            <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
              Create a collection
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {collections?.map((collection) => {
            const items = itemsByCollection.get(collection.id) ?? []
            return (
              <article
                key={collection.id}
                className="group relative overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-pop"
              >
                <Link to={`/collections/${collection.id}`} className="absolute inset-0 z-0" aria-label={`Open ${collection.name}`} />
                <div className="pointer-events-none aspect-[16/9] border-b border-line">
                  <Mosaic items={items} />
                </div>
                <div className="pointer-events-none relative flex items-start gap-2.5 p-3.5">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', COLLECTION_COLOR_CLASSES[collection.color].dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-medium">{collection.name}</h3>
                      {collection.isSample && <Badge>Sample</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-subtle">
                      {pluralise(items.length, 'item')}
                      {collection.description ? ` · ${collection.description}` : ''}
                    </p>
                  </div>
                  <div className="pointer-events-auto -mt-1 -mr-1.5">
                    <CollectionActions collection={collection} items={items} />
                  </div>
                </div>
              </article>
            )
          })}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm text-muted transition-colors hover:border-subtle hover:text-fg"
          >
            <Plus className="size-5" />
            New collection
          </button>
        </div>
      )}
      <CollectionDialog open={creating} onOpenChange={setCreating} navigateOnCreate />
    </div>
  )
}

export function CollectionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const collections = useCollections()
  const collection = collections?.find((c) => c.id === id)
  const { filters, view, set } = useLibraryFilters({ collectionId: id ?? null })
  const { all, results } = useFilteredCreations(filters)
  const [managing, setManaging] = useState(false)
  const items = useMemo(() => (all ?? []).filter((c) => c.collectionIds.includes(id ?? '')), [all, id])

  if (collections === undefined) return null
  if (!collection) {
    return (
      <EmptyState
        icon={<FolderOpen />}
        title="Collection not found"
        description="It may have been deleted."
        action={
          <ButtonLink to="/collections" variant="primary">
            All collections
          </ButtonLink>
        }
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <nav className="-mb-2 text-[13px] text-subtle" aria-label="Breadcrumb">
        <Link to="/collections" className="hover:text-fg">
          Collections
        </Link>
      </nav>
      <PageHeader
        icon={<span className={cn('mt-2.5 size-3 shrink-0 rounded-full', COLLECTION_COLOR_CLASSES[collection.color].dot)} />}
        title={collection.name}
        description={collection.description || pluralise(items.length, 'item')}
        actions={
          <>
            <Button variant="outline" icon={<ListChecks />} onClick={() => setManaging(true)}>
              Add or remove items
            </Button>
            <ButtonLink to={`/new?collection=${collection.id}`} variant="primary" icon={<Plus />}>
              New in collection
            </ButtonLink>
            <CollectionActions collection={collection} items={items} onDeleted={() => navigate('/collections', { replace: true })} />
          </>
        }
      />
      {items.length > 0 && <LibraryToolbar filters={filters} view={view} set={set} creations={items} hideCollectionFilter showSearch />}
      {items.length > 0 && <ActiveFilters filters={filters} set={set} count={results?.length ?? 0} hideCollection />}
      {items.length === 0 ? (
        <EmptyState
          icon={<FolderOpen />}
          title="This collection is empty"
          description="Add existing items from your library, or create something new straight into this collection."
          action={
            <>
              <Button variant="primary" icon={<ListChecks />} onClick={() => setManaging(true)}>
                Add items
              </Button>
              <ButtonLink to={`/new?collection=${collection.id}`} variant="outline" icon={<Plus />}>
                New creation
              </ButtonLink>
            </>
          }
        />
      ) : results && results.length === 0 ? (
        <EmptyState icon={<FolderOpen />} title="Nothing matches" description="Try a different search or clear the filters." />
      ) : (
        results && <CreationsGrid creations={results} view={view} />
      )}
      <ManageItemsDialog open={managing} onOpenChange={setManaging} collection={collection} />
    </div>
  )
}
