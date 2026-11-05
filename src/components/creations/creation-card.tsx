import { Copy, GitBranch, Star } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { copyPrompt } from '../../lib/clipboard'
import { CONTENT_TYPE_LABELS } from '../../lib/labels'
import { toggleFavourite } from '../../lib/repo'
import type { Creation } from '../../lib/types'
import { cn, formatDate, formatRelative } from '../../lib/utils'
import { Badge } from '../ui/misc'
import { CreationMenu } from './creation-menu'
import { CreationCover, TypeIcon } from './media'

function FavouriteButton({ creation, className }: { creation: Creation; className?: string }) {
  return (
    <button
      type="button"
      aria-label={creation.favourite ? 'Remove from favourites' : 'Add to favourites'}
      aria-pressed={creation.favourite}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        const fav = await toggleFavourite(creation.id)
        toast.success(fav ? 'Added to favourites' : 'Removed from favourites')
      }}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md transition-colors',
        creation.favourite ? 'text-accent' : 'text-subtle hover:text-fg',
        className,
      )}
    >
      <Star className={cn('size-4', creation.favourite && 'fill-current')} />
    </button>
  )
}

export function CreationCard({ creation }: { creation: Creation }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-pop focus-within:border-line-strong">
      <Link to={`/c/${creation.id}`} className="absolute inset-0 z-0 rounded-xl" aria-label={`Open ${creation.title || 'Untitled'}`} />
      <div className="pointer-events-none relative">
        <CreationCover creation={creation} className="aspect-[4/3] w-full" />
        <div className="absolute top-2 left-2 flex gap-1">
          {creation.isSample && <Badge className="border-transparent bg-black/55 text-white/90 backdrop-blur">Sample</Badge>}
          {creation.contentType !== 'image' && creation.coverAssetId && (
            <Badge className="border-transparent bg-black/55 text-white/90 backdrop-blur">
              <TypeIcon type={creation.contentType} />
              {CONTENT_TYPE_LABELS[creation.contentType]}
            </Badge>
          )}
        </div>
        <div className="pointer-events-auto absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              copyPrompt(creation)
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-black/60 px-2 text-xs font-medium text-white backdrop-blur hover:bg-black/75"
          >
            <Copy className="size-3.5" />
            Copy
          </button>
        </div>
      </div>
      <div className="pointer-events-none relative flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-1 flex-1 text-sm font-medium tracking-tight">{creation.title || 'Untitled'}</h3>
          <div className="pointer-events-auto -mt-1 -mr-1.5 flex items-center">
            <FavouriteButton creation={creation} />
            <CreationMenu creation={creation} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-subtle">
          <TypeIcon type={creation.contentType} className="size-3.5" />
          <span className="truncate">{creation.model || CONTENT_TYPE_LABELS[creation.contentType]}</span>
          {creation.parentId && (
            <>
              <span aria-hidden>·</span>
              <GitBranch className="size-3" aria-label="Variation" />
            </>
          )}
          <span className="ml-auto shrink-0">{formatDate(creation.createdOn)}</span>
        </div>
        {creation.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 overflow-hidden" style={{ maxHeight: '1.25rem' }}>
            {creation.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] leading-none text-muted">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

export function CreationRow({ creation }: { creation: Creation }) {
  return (
    <div className="group relative flex items-center gap-3 border-b border-line px-3 py-2.5 transition-colors last:border-b-0 hover:bg-surface-2/60 sm:gap-4 sm:px-4">
      <Link to={`/c/${creation.id}`} className="absolute inset-0 z-0" aria-label={`Open ${creation.title || 'Untitled'}`} />
      <div className="pointer-events-none relative size-11 shrink-0 overflow-hidden rounded-lg border border-line">
        {creation.coverAssetId ? (
          <CreationCover creation={creation} className="size-full" />
        ) : (
          <div className="flex size-full items-center justify-center bg-surface-2 text-subtle">
            <TypeIcon type={creation.contentType} />
          </div>
        )}
      </div>
      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{creation.title || 'Untitled'}</span>
          {creation.isSample && <Badge>Sample</Badge>}
          {creation.parentId && <GitBranch className="size-3 shrink-0 text-subtle" aria-label="Variation" />}
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-subtle">{creation.prompt || 'No prompt yet'}</p>
      </div>
      <div className="pointer-events-none relative hidden w-36 shrink-0 truncate text-xs text-muted md:block">{creation.model || '—'}</div>
      <div className="pointer-events-none relative hidden w-24 shrink-0 text-xs text-muted lg:flex lg:items-center lg:gap-1.5">
        <TypeIcon type={creation.contentType} className="size-3.5" />
        {CONTENT_TYPE_LABELS[creation.contentType]}
      </div>
      <div className="pointer-events-none relative hidden w-20 shrink-0 text-right text-xs text-subtle sm:block">
        {formatRelative(creation.addedAt)}
      </div>
      <div className="relative flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => copyPrompt(creation)}
          aria-label="Copy prompt"
          title="Copy prompt"
          className="inline-flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-3 hover:text-fg"
        >
          <Copy className="size-4" />
        </button>
        <FavouriteButton creation={creation} />
        <CreationMenu creation={creation} />
      </div>
    </div>
  )
}
