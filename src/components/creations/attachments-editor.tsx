import { ImagePlus, Loader2, RefreshCw, Star, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ACCEPT_ATTRIBUTE, checkImageFile, processImage } from '../../lib/images'
import { useAssetUrl, useBlobUrl } from '../../lib/hooks'
import { ASSET_ROLE_LABELS } from '../../lib/labels'
import type { AssetDraft } from '../../lib/repo'
import { checkSpaceFor } from '../../lib/storage'
import { ASSET_ROLES, type AssetRole } from '../../lib/types'
import { cn, formatBytes, newId } from '../../lib/utils'
import { Input } from '../ui/input'

export async function filesToDrafts(files: File[], role: AssetRole): Promise<AssetDraft[]> {
  const drafts: AssetDraft[] = []
  const spaceWarning = await checkSpaceFor(files.reduce((sum, f) => sum + f.size, 0))
  if (spaceWarning) {
    toast.error(spaceWarning)
    return drafts
  }
  for (const file of files) {
    const check = await checkImageFile(file)
    if (!check.ok) {
      toast.error(`${file.name || 'File'} wasn’t added`, { description: check.reason })
      continue
    }
    try {
      const processed = await processImage(file, check.mimeType)
      drafts.push({
        key: newId(),
        id: null,
        blob: file,
        thumb: processed.thumb,
        name: file.name || `image.${check.mimeType.split('/')[1]}`,
        mimeType: check.mimeType,
        size: file.size,
        width: processed.width,
        height: processed.height,
        alt: '',
        description: '',
        role,
      })
    } catch {
      toast.error(`${file.name || 'File'} wasn’t added`, { description: 'The image couldn’t be read. It may be damaged.' })
    }
  }
  return drafts
}

function DraftPreview({ draft }: { draft: AssetDraft }) {
  const localUrl = useBlobUrl(draft.blob ? (draft.thumb ?? draft.blob) : null)
  const { url: storedUrl } = useAssetUrl(draft.blob ? null : draft.id, 'thumb')
  const url = localUrl ?? storedUrl
  return url ? (
    <img src={url} alt={draft.alt || draft.name} className="size-full object-cover" draggable={false} />
  ) : (
    <div className="size-full bg-surface-3" />
  )
}

function AttachmentTile({
  draft,
  isCover,
  onChange,
  onRemove,
  onMakeCover,
}: {
  draft: AssetDraft
  isCover: boolean
  onChange: (next: AssetDraft) => void
  onRemove: () => void
  onMakeCover: () => void
}) {
  const replaceRef = useRef<HTMLInputElement>(null)
  const [replacing, setReplacing] = useState(false)

  return (
    <div className="flex gap-3 rounded-xl border border-line bg-surface p-2.5">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border border-line sm:size-28">
        <DraftPreview draft={draft} />
        {isCover && (
          <span className="absolute bottom-1.5 left-1.5 inline-flex h-5 items-center gap-1 rounded bg-black/60 px-1.5 text-[10px] font-medium text-white backdrop-blur">
            <Star className="size-2.5 fill-current" /> Cover
          </span>
        )}
        {replacing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="size-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={draft.name}>
            {draft.name}
          </span>
          <span className="shrink-0 text-[11px] text-subtle">
            {draft.width && draft.height ? `${draft.width}×${draft.height} · ` : ''}
            {formatBytes(draft.size)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-md border border-line bg-surface-2 p-0.5" role="radiogroup" aria-label="Image role">
            {ASSET_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                role="radio"
                aria-checked={draft.role === role}
                onClick={() => onChange({ ...draft, role })}
                className={cn(
                  'h-6 rounded px-2 text-[11px] font-medium transition-colors',
                  draft.role === role ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg',
                )}
              >
                {ASSET_ROLE_LABELS[role]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center">
            {!isCover && (
              <button
                type="button"
                onClick={onMakeCover}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg"
              >
                <Star className="size-3.5" /> Set as cover
              </button>
            )}
            <button
              type="button"
              onClick={() => replaceRef.current?.click()}
              aria-label="Replace image"
              title="Replace image"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
            >
              <RefreshCw className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove image"
              title="Remove image"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
        <Input
          value={draft.alt}
          onChange={(e) => onChange({ ...draft, alt: e.target.value })}
          placeholder="Alt text — describe the image for screen readers"
          aria-label="Alternative text"
          className="h-8 text-[13px]"
          maxLength={500}
        />
        <Input
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          placeholder="Caption or notes (optional)"
          aria-label="Image description"
          className="h-8 text-[13px]"
          maxLength={1000}
        />
      </div>
      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setReplacing(true)
          const [replacement] = await filesToDrafts([file], draft.role)
          setReplacing(false)
          if (replacement) {
            onChange({ ...replacement, key: draft.key, id: draft.id, alt: draft.alt, description: draft.description })
            toast.success('Image replaced')
          }
        }}
      />
    </div>
  )
}

export function AttachmentsEditor({
  assets,
  onChange,
  coverKey,
  onCoverChange,
  defaultRole,
}: {
  assets: AssetDraft[]
  onChange: (assets: AssetDraft[]) => void
  coverKey: string | null
  onCoverChange: (key: string | null) => void
  defaultRole: AssetRole
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  async function addFiles(files: File[]) {
    if (!files.length) return
    setBusy(true)
    try {
      const drafts = await filesToDrafts(files, defaultRole)
      if (drafts.length) {
        onChange([...assets, ...drafts])
        if (!coverKey) onCoverChange(drafts[0].key)
      }
    } finally {
      setBusy(false)
    }
  }

  const effectiveCover = coverKey ?? assets[0]?.key ?? null

  return (
    <div className="flex flex-col gap-3" data-attachments-editor>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors',
          dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-2/40 hover:border-subtle',
        )}
      >
        <div className="flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-muted">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
        </div>
        <div className="text-sm">
          <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-fg underline-offset-4 hover:underline">
            Choose images
          </button>
          <span className="text-muted">, drag them here, or paste from your clipboard</span>
        </div>
        <p className="text-xs text-subtle">JPG, PNG, WebP or GIF · up to 40 MB each · originals are kept untouched</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          className="hidden"
          data-testid="asset-file-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            addFiles(files)
          }}
        />
      </div>

      {assets.length > 0 && (
        <div className="flex flex-col gap-2">
          {assets.map((draft) => (
            <AttachmentTile
              key={draft.key}
              draft={draft}
              isCover={draft.key === effectiveCover}
              onChange={(next) => onChange(assets.map((a) => (a.key === draft.key ? next : a)))}
              onRemove={() => {
                const remaining = assets.filter((a) => a.key !== draft.key)
                onChange(remaining)
                if (coverKey === draft.key) onCoverChange(remaining[0]?.key ?? null)
              }}
              onMakeCover={() => onCoverChange(draft.key)}
            />
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line text-[13px] text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Upload className="size-4" /> Add more images
          </button>
        </div>
      )}
    </div>
  )
}
