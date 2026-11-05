import { AudioLines, FileText, Film, ImageIcon, ImageOff, Shapes } from 'lucide-react'
import type { ContentType, Creation } from '../../lib/types'
import { useAssetUrl } from '../../lib/hooks'
import { cn } from '../../lib/utils'

export const TYPE_ICONS: Record<ContentType, typeof ImageIcon> = {
  image: ImageIcon,
  video: Film,
  text: FileText,
  audio: AudioLines,
  other: Shapes,
}

export function TypeIcon({ type, className }: { type: ContentType; className?: string }) {
  const Icon = TYPE_ICONS[type]
  return <Icon className={cn('size-4', className)} aria-hidden />
}

export function AssetImage({
  assetId,
  alt,
  variant = 'thumb',
  className,
  imgClassName,
  fit = 'cover',
}: {
  assetId: string | null | undefined
  alt: string
  variant?: 'thumb' | 'full'
  className?: string
  imgClassName?: string
  fit?: 'cover' | 'contain'
}) {
  const { url, missing } = useAssetUrl(assetId, variant)
  if (missing) {
    return (
      <div className={cn('flex items-center justify-center bg-surface-2 text-subtle', className)}>
        <ImageOff className="size-5" aria-label="Image unavailable" />
      </div>
    )
  }
  return (
    <div className={cn('overflow-hidden bg-surface-2', className)}>
      {url && (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn(
            'size-full animate-fade-in',
            fit === 'cover' ? 'object-cover' : 'object-contain',
            imgClassName,
          )}
        />
      )}
    </div>
  )
}

/** The visual header of a card: the cover image, or a typographic prompt preview. */
export function CreationCover({ creation, className }: { creation: Creation; className?: string }) {
  if (creation.coverAssetId) {
    return (
      <AssetImage
        assetId={creation.coverAssetId}
        alt={creation.title || 'Creation preview'}
        className={className}
        imgClassName="transition-transform duration-500 ease-out group-hover:scale-[1.02]"
      />
    )
  }
  return (
    <div className={cn('relative flex flex-col overflow-hidden bg-surface-2 px-4 pt-11 pb-4', className)}>
      <p className="line-clamp-5 font-mono text-[12px] leading-relaxed text-muted">
        {creation.prompt || <span className="text-subtle italic">No prompt yet</span>}
      </p>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface-2 via-surface-2/90 to-transparent" />
      <div className="absolute bottom-3 left-4 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-subtle uppercase">
        <TypeIcon type={creation.contentType} className="size-3.5" />
        {creation.contentType === 'video' && creation.video?.url ? 'Video link' : `${creation.contentType} prompt`}
      </div>
    </div>
  )
}
