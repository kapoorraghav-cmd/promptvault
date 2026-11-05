import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  CopyPlus,
  ExternalLink,
  Film,
  FolderPlus,
  GitBranch,
  GitCompare,
  Maximize2,
  MoreHorizontal,
  Pencil,
  Star,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { CollectionPickerDialog } from '../components/collections/collection-picker'
import { CreationMenu, useDuplicate } from '../components/creations/creation-menu'
import { Lightbox } from '../components/creations/lightbox'
import { AssetImage, TypeIcon } from '../components/creations/media'
import { Button, ButtonLink, IconButton } from '../components/ui/button'
import { Badge, EmptyState } from '../components/ui/misc'
import { copyPrompt, copyText } from '../lib/clipboard'
import { useCollections, useCreation, useCreationAssets } from '../lib/hooks'
import { ASSET_ROLE_LABELS, COLLECTION_COLOR_CLASSES, CONTENT_TYPE_LABELS } from '../lib/labels'
import { getVariationFamily, setInCollection, toggleFavourite } from '../lib/repo'
import type { Creation } from '../lib/types'
import { cn, formatDate, formatDateTime, formatDuration, safeExternalUrl } from '../lib/utils'

function CopyBlock({ label, text, onCopy, mono = true }: { label: string; text: string; onCopy: () => void; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="text-xs font-medium tracking-wide text-subtle uppercase">{label}</span>
        <button
          type="button"
          onClick={() => {
            onCopy()
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className={cn('px-4 py-3.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-fg', mono && 'font-mono')}>
        {text}
      </p>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-[13px]">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right break-words text-fg">{children}</dd>
    </div>
  )
}

function Variations({ creation }: { creation: Creation }) {
  const family = useLiveQuery(() => getVariationFamily(creation.id), [creation.id, creation.updatedAt])
  const duplicate = useDuplicate()
  if (!family) return null
  const others = family.filter((c) => c.id !== creation.id)

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <GitBranch className="size-4 text-muted" /> Versions
        </h2>
        <Button size="sm" variant="ghost" icon={<CopyPlus />} onClick={() => duplicate(creation)}>
          New variation
        </Button>
      </div>
      {creation.parentId && !family.some((c) => c.id === creation.parentId) && (
        <p className="mb-2 text-xs text-subtle">Created from “{creation.parentTitle}”, which has since been deleted.</p>
      )}
      {others.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted">
          Try a new idea without losing this one: make a variation, tweak the prompt, then compare the two side by side.
        </p>
      ) : (
        <ul className="-mx-1 flex flex-col">
          {family.map((item) => {
            const current = item.id === creation.id
            return (
              <li key={item.id} className={cn('flex items-center gap-2 rounded-md px-1 py-1', current && 'bg-surface-2')}>
                <span className={cn('size-1.5 shrink-0 rounded-full', current ? 'bg-accent' : 'bg-line-strong')} />
                {current ? (
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.title || 'Untitled'}</span>
                ) : (
                  <Link to={`/c/${item.id}`} className="min-w-0 flex-1 truncate text-[13px] text-muted hover:text-fg">
                    {item.title || 'Untitled'}
                  </Link>
                )}
                <span className="shrink-0 text-[11px] text-subtle">{item.parentId ? formatDate(item.addedAt) : 'Original'}</span>
                {!current && (
                  <Link
                    to={`/compare?a=${creation.id}&b=${item.id}`}
                    className="inline-flex h-6 shrink-0 items-center gap-1 rounded px-1.5 text-[11px] font-medium text-muted hover:bg-surface-3 hover:text-fg"
                    aria-label={`Compare with ${item.title || 'Untitled'}`}
                  >
                    <GitCompare className="size-3" /> Compare
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function CreationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const creation = useCreation(id)
  const assets = useCreationAssets(id)
  const collections = useCollections()
  const duplicate = useDuplicate()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [selected, setSelected] = useState(0)
  const [picking, setPicking] = useState(false)

  if (creation === undefined) return <div className="p-8 text-sm text-muted">Loading…</div>
  if (creation === null) {
    return (
      <EmptyState
        icon={<GitBranch />}
        title="This item doesn’t exist"
        description="It may have been deleted, or the link is out of date."
        action={
          <ButtonLink to="/library" variant="primary">
            Go to library
          </ButtonLink>
        }
      />
    )
  }

  const videoUrl = safeExternalUrl(creation.video?.url)
  const sourceUrl = safeExternalUrl(creation.sourceUrl)
  const linkedCollections = (collections ?? []).filter((c) => creation.collectionIds.includes(c.id))
  const hasAssets = (assets?.length ?? 0) > 0
  const coverIndex = Math.max(0, assets?.findIndex((a) => a.id === creation.coverAssetId) ?? 0)
  const activeIndex = selected < (assets?.length ?? 0) ? selected : coverIndex
  const activeAsset = assets?.[activeIndex]

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-16 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-[13px] text-subtle" aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 hover:text-fg">
          <ArrowLeft className="size-3.5" /> Back
        </button>
        <span aria-hidden>·</span>
        <Link to="/library" className="hover:text-fg">
          Library
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="truncate text-muted">{creation.title || 'Untitled'}</span>
      </nav>

      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Badge>
              <TypeIcon type={creation.contentType} />
              {CONTENT_TYPE_LABELS[creation.contentType]}
            </Badge>
            {creation.isSample && <Badge tone="info">Sample data</Badge>}
            {creation.parentId && (
              <Badge tone="accent">
                <GitBranch />
                Variation of{' '}
                <Link to={`/c/${creation.parentId}`} className="max-w-48 truncate underline-offset-2 hover:underline">
                  {creation.parentTitle}
                </Link>
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{creation.title || 'Untitled'}</h1>
          <p className="mt-1 text-[13px] text-subtle">
            {creation.model && <span className="text-muted">{creation.model} · </span>}
            Created {formatDate(creation.createdOn)} · Saved {formatDateTime(creation.addedAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="primary" icon={<Copy />} onClick={() => copyPrompt(creation)}>
            Copy prompt
          </Button>
          <IconButton
            label={creation.favourite ? 'Remove from favourites' : 'Add to favourites'}
            variant="outline"
            onClick={async () => {
              const fav = await toggleFavourite(creation.id)
              toast.success(fav ? 'Added to favourites' : 'Removed from favourites')
            }}
            className={cn('size-9', creation.favourite && 'text-accent')}
            aria-pressed={creation.favourite}
          >
            <Star className={cn(creation.favourite && 'fill-current')} />
          </IconButton>
          <Button variant="outline" icon={<Pencil />} onClick={() => navigate(`/c/${creation.id}/edit`)}>
            Edit
          </Button>
          <Button variant="outline" icon={<CopyPlus />} onClick={() => duplicate(creation)} className="max-sm:hidden">
            Duplicate
          </Button>
          <CreationMenu
            creation={creation}
            onDeleted={() => navigate('/library', { replace: true })}
            trigger={
              <IconButton label="More actions" variant="outline" className="size-9">
                <MoreHorizontal />
              </IconButton>
            }
          />
        </div>
      </header>

      <div className={cn('grid gap-6', hasAssets || videoUrl ? 'lg:grid-cols-[minmax(0,1fr)_380px]' : 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
        <div className="flex min-w-0 flex-col gap-5">
          {creation.contentType === 'video' && (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                <Film className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  Video {creation.video?.durationSeconds != null && <span className="text-muted">· {formatDuration(creation.video.durationSeconds)}</span>}
                </div>
                <div className="truncate text-xs text-subtle">{videoUrl ?? 'No video link saved'}</div>
              </div>
              {videoUrl && (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-[13px] font-medium hover:bg-surface-2"
                >
                  <ExternalLink className="size-4" /> Open video
                </a>
              )}
            </div>
          )}

          {hasAssets && activeAsset && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setLightboxIndex(activeIndex)}
                className="group relative overflow-hidden rounded-xl border border-line bg-surface-2"
                aria-label="Open full-size preview"
              >
                <AssetImage
                  assetId={activeAsset.id}
                  alt={activeAsset.alt || creation.title}
                  variant="full"
                  fit="contain"
                  className="flex max-h-[70vh] min-h-64 items-center justify-center bg-transparent"
                  imgClassName="max-h-[70vh]"
                />
                <span className="absolute top-3 right-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-black/60 px-2.5 text-xs font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                  <Maximize2 className="size-3.5" /> View full size
                </span>
                <span className="absolute bottom-3 left-3 inline-flex h-6 items-center rounded bg-black/60 px-2 text-[11px] font-medium text-white backdrop-blur">
                  {ASSET_ROLE_LABELS[activeAsset.role]}
                </span>
              </button>
              {(activeAsset.description || activeAsset.alt) && (
                <p className="text-[13px] text-muted">{activeAsset.description || activeAsset.alt}</p>
              )}
              {assets!.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {assets!.map((asset, index) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelected(index)}
                      aria-label={`Show image ${index + 1}`}
                      aria-current={index === activeIndex}
                      className={cn(
                        'size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors sm:size-20',
                        index === activeIndex ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100',
                      )}
                    >
                      <AssetImage assetId={asset.id} alt={asset.alt || asset.name} className="size-full" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {creation.prompt ? (
            <CopyBlock label="Prompt" text={creation.prompt} onCopy={() => copyPrompt(creation)} />
          ) : (
            <div className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
              No prompt saved yet.{' '}
              <Link to={`/c/${creation.id}/edit`} className="font-medium text-fg underline-offset-4 hover:underline">
                Add one
              </Link>
            </div>
          )}
          {creation.negativePrompt && (
            <CopyBlock
              label="Negative prompt"
              text={creation.negativePrompt}
              onCopy={async () => {
                if (await copyText(creation.negativePrompt)) toast.success('Negative prompt copied')
              }}
            />
          )}
          {creation.settings && (
            <CopyBlock
              label="Generation settings"
              text={creation.settings}
              onCopy={async () => {
                if (await copyText(creation.settings)) toast.success('Settings copied')
              }}
            />
          )}
          {creation.description && (
            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Notes</h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-fg">{creation.description}</p>
            </section>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <section className="rounded-xl border border-line bg-surface px-4 py-2">
            <dl className="divide-y divide-line">
              <DetailRow label="Type">{CONTENT_TYPE_LABELS[creation.contentType]}</DetailRow>
              <DetailRow label="Tool / model">{creation.model || <span className="text-subtle">—</span>}</DetailRow>
              {creation.category && <DetailRow label="Category">{creation.category}</DetailRow>}
              {creation.aspectRatio && <DetailRow label="Aspect ratio">{creation.aspectRatio}</DetailRow>}
              {creation.resolution && <DetailRow label="Resolution">{creation.resolution}</DetailRow>}
              {creation.seed && (
                <DetailRow label="Seed">
                  <button
                    type="button"
                    className="font-mono hover:text-accent"
                    title="Copy seed"
                    onClick={async () => {
                      if (await copyText(creation.seed)) toast.success('Seed copied')
                    }}
                  >
                    {creation.seed}
                  </button>
                </DetailRow>
              )}
              {creation.contentType === 'video' && creation.video?.durationSeconds != null && (
                <DetailRow label="Duration">{formatDuration(creation.video.durationSeconds)}</DetailRow>
              )}
              <DetailRow label="Created on">{formatDate(creation.createdOn)}</DetailRow>
              <DetailRow label="Last edited">{formatDateTime(creation.updatedAt)}</DetailRow>
              {creation.lastUsedAt && <DetailRow label="Last copied">{formatDateTime(creation.lastUsedAt)}</DetailRow>}
              {sourceUrl && (
                <DetailRow label="Source">
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-52 items-center gap-1 text-accent hover:underline">
                    <span className="truncate">{new URL(sourceUrl).hostname}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </DetailRow>
              )}
            </dl>
          </section>

          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-2.5 text-xs font-medium tracking-wide text-subtle uppercase">Tags</h2>
            {creation.tags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {creation.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/library?tag=${encodeURIComponent(tag)}`}
                    className="rounded-md bg-surface-2 px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-3 hover:text-fg"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-subtle">No tags yet.</p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-xs font-medium tracking-wide text-subtle uppercase">Collections</h2>
              <Button size="sm" variant="ghost" icon={<FolderPlus />} onClick={() => setPicking(true)}>
                Manage
              </Button>
            </div>
            {linkedCollections.length ? (
              <div className="flex flex-col gap-1">
                {linkedCollections.map((collection) => (
                  <div key={collection.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-2">
                    <span className={cn('size-2 rounded-full', COLLECTION_COLOR_CLASSES[collection.color].dot)} />
                    <Link to={`/collections/${collection.id}`} className="flex-1 truncate text-[13px] hover:underline">
                      {collection.name}
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        await setInCollection([creation.id], collection.id, false)
                        toast.success(`Removed from “${collection.name}”`)
                      }}
                      className="text-[11px] text-subtle opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-subtle">Not in any collection.</p>
            )}
          </section>

          <Variations creation={creation} />
        </aside>
      </div>

      {assets && (
        <Lightbox assets={assets} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
      <CollectionPickerDialog open={picking} onOpenChange={setPicking} creationIds={[creation.id]} />
    </div>
  )
}
