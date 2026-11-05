import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { useEffect } from 'react'
import { getOriginalBlob } from '../../lib/assets'
import { useAssetUrl } from '../../lib/hooks'
import { ASSET_ROLE_LABELS } from '../../lib/labels'
import type { Asset } from '../../lib/types'
import { downloadBlob, formatBytes } from '../../lib/utils'

export function Lightbox({
  assets,
  index,
  onIndexChange,
  onClose,
}: {
  assets: Asset[]
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const open = index !== null && index >= 0 && index < assets.length
  const asset = open ? assets[index!] : null
  const { url } = useAssetUrl(asset?.id, 'full')

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight' && index! < assets.length - 1) onIndexChange(index! + 1)
      if (event.key === 'ArrowLeft' && index! > 0) onIndexChange(index! - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, assets.length, onIndexChange])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/90" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col text-white focus:outline-none">
          <DialogPrimitive.Title className="sr-only">{asset?.alt || asset?.name || 'Image preview'}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Full size image preview</DialogPrimitive.Description>
          <div className="flex h-14 shrink-0 items-center gap-3 px-4">
            <div className="min-w-0 flex-1 text-sm">
              <div className="truncate font-medium">{asset?.name}</div>
              <div className="text-xs text-white/60">
                {asset && ASSET_ROLE_LABELS[asset.role]}
                {asset?.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
                {asset ? ` · ${formatBytes(asset.size)}` : ''}
                {assets.length > 1 ? ` · ${index! + 1} of ${assets.length}` : ''}
              </div>
            </div>
            {asset && (
              <button
                type="button"
                onClick={async () => {
                  const original = await getOriginalBlob(asset)
                  if (original) downloadBlob(original, asset.name)
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-3 text-[13px] font-medium hover:bg-white/20"
              >
                <Download className="size-4" /> Download original
              </button>
            )}
            <DialogPrimitive.Close aria-label="Close preview" className="inline-flex size-9 items-center justify-center rounded-md hover:bg-white/10">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-16" onClick={onClose}>
            {url && (
              <img
                key={url}
                src={url}
                alt={asset?.alt || asset?.name || ''}
                className="max-h-full max-w-full animate-fade-in rounded-md object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {index !== null && index > 0 && (
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation()
                  onIndexChange(index - 1)
                }}
                className="absolute left-2 inline-flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:left-4"
              >
                <ChevronLeft className="size-5" />
              </button>
            )}
            {index !== null && index < assets.length - 1 && (
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation()
                  onIndexChange(index + 1)
                }}
                className="absolute right-2 inline-flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:right-4"
              >
                <ChevronRight className="size-5" />
              </button>
            )}
          </div>
          {(asset?.description || asset?.alt) && (
            <div className="shrink-0 px-4 pb-5 text-center text-sm text-white/75">{asset.description || asset.alt}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
