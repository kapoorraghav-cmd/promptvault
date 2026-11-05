import { ChevronDown, ClipboardPaste, Info, Link2, Plus, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AttachmentsEditor, filesToDrafts } from '../components/creations/attachments-editor'
import { TYPE_ICONS } from '../components/creations/media'
import { TagInput } from '../components/creations/tag-input'
import { CollectionDialog } from '../components/collections/collection-dialog'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/dialog'
import { Field, Input, Textarea } from '../components/ui/input'
import { db } from '../lib/db'
import { useCollections, useCreations } from '../lib/hooks'
import { ASPECT_RATIO_SUGGESTIONS, COLLECTION_COLOR_CLASSES, CONTENT_TYPE_LABELS, MODEL_SUGGESTIONS } from '../lib/labels'
import { saveCreation, StorageFullError, type AssetDraft } from '../lib/repo'
import { CONTENT_TYPES, emptyDraft, type ContentType, type CreationDraft } from '../lib/types'
import { cn, formatDuration, safeExternalUrl } from '../lib/utils'
import { useHandoff } from '../store/handoff'

function parseDuration(value: string): number | null {
  const text = value.trim()
  if (!text) return null
  const parts = text.split(':').map((p) => p.trim())
  if (parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return NaN
  return parts.reduce((total, part) => total * 60 + Number(part), 0)
}

function Section({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-line bg-surface p-4 sm:p-5', className)}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

export function EditCreationPage() {
  const { id } = useParams()
  const isNew = !id
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const collections = useCollections()
  const creations = useCreations()
  const takePendingPrompt = useHandoff((s) => s.takePendingPrompt)

  const [loaded, setLoaded] = useState(isNew)
  const [notFound, setNotFound] = useState(false)
  const [draft, setDraft] = useState<CreationDraft>(() => {
    const type = params.get('type') as ContentType | null
    const collection = params.get('collection')
    return emptyDraft({
      contentType: type && CONTENT_TYPES.includes(type) ? type : 'image',
      collectionIds: collection ? [collection] : [],
    })
  })
  const [assets, setAssets] = useState<AssetDraft[]>([])
  const [coverKey, setCoverKey] = useState<string | null>(null)
  const [durationText, setDurationText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newCollectionOpen, setNewCollectionOpen] = useState(false)
  const savedRef = useRef(false)
  const discardingRef = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)

  // Load an existing record for editing.
  useEffect(() => {
    if (isNew) return
    let cancelled = false
    ;(async () => {
      const creation = await db.creations.get(id!)
      if (cancelled) return
      if (!creation) {
        setNotFound(true)
        setLoaded(true)
        return
      }
      const stored = await db.assets.where('creationId').equals(creation.id).toArray()
      const order = new Map(creation.assetIds.map((assetId, index) => [assetId, index]))
      stored.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
      const drafts: AssetDraft[] = stored.map((asset) => ({
        key: asset.id,
        id: asset.id,
        blob: null,
        thumb: null,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
        width: asset.width,
        height: asset.height,
        alt: asset.alt,
        description: asset.description,
        role: asset.role,
      }))
      const { id: _id, addedAt: _a, updatedAt: _u, lastUsedAt: _l, assetIds: _ids, coverAssetId, isSample: _s, ...rest } = creation
      setDraft(rest)
      setAssets(drafts)
      setCoverKey(coverAssetId)
      setDurationText(formatDuration(creation.video?.durationSeconds))
      setShowAdvanced(Boolean(creation.negativePrompt || creation.seed || creation.settings || creation.sourceUrl || creation.resolution))
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  // Accept a prompt handed over from the screenshot extractor.
  useEffect(() => {
    if (!isNew) return
    const pending = takePendingPrompt()
    if (!pending) return
    setDraft((d) => ({ ...d, prompt: pending.prompt }))
    setDirty(true)
    if (pending.screenshot) {
      filesToDrafts([pending.screenshot], 'reference').then((drafts) => {
        if (drafts.length) setAssets((a) => [...a, ...drafts.map((d) => ({ ...d, description: 'Screenshot the prompt was extracted from' }))])
      })
    }
  }, [isNew, takePendingPrompt])

  useEffect(() => {
    if (loaded && isNew) titleRef.current?.focus()
  }, [loaded, isNew])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !savedRef.current && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const tagSuggestions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of creations ?? []) for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [creations])

  const modelSuggestions = useMemo(() => {
    const used = new Set((creations ?? []).map((c) => c.model).filter(Boolean))
    return Array.from(new Set([...used, ...MODEL_SUGGESTIONS]))
  }, [creations])

  const categorySuggestions = useMemo(
    () => Array.from(new Set((creations ?? []).map((c) => c.category).filter(Boolean))),
    [creations],
  )

  function update<K extends keyof CreationDraft>(key: K, value: CreationDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
    setDirty(true)
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: '' }))
  }

  async function pasteIntoPrompt() {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        toast.message('Your clipboard is empty.')
        return
      }
      update('prompt', draft.prompt ? `${draft.prompt}\n${text}` : text)
    } catch {
      toast.message('Your browser blocked clipboard access. Click in the prompt box and press Ctrl+V (or ⌘V).')
    }
  }

  async function handlePaste(event: React.ClipboardEvent) {
    const files = Array.from(event.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    event.preventDefault()
    const drafts = await filesToDrafts(files, draft.contentType === 'video' ? 'thumbnail' : 'output')
    if (drafts.length) {
      setAssets((a) => [...a, ...drafts])
      if (!coverKey) setCoverKey(drafts[0].key)
      setDirty(true)
      toast.success(drafts.length === 1 ? 'Image pasted' : `${drafts.length} images pasted`)
    }
  }

  function validate(): CreationDraft | null {
    const nextErrors: Record<string, string> = {}
    let next = draft
    if (!draft.title.trim() && !draft.prompt.trim() && assets.length === 0) {
      nextErrors.title = 'Add at least a title, a prompt or an image so you can find this later.'
    }
    if (draft.sourceUrl.trim() && !safeExternalUrl(draft.sourceUrl)) nextErrors.sourceUrl = 'Enter a full web address starting with https://'
    if (draft.contentType === 'video') {
      const url = draft.video?.url.trim() ?? ''
      if (url && !safeExternalUrl(url)) nextErrors.videoUrl = 'Enter a full web address starting with https://'
      const duration = parseDuration(durationText)
      if (duration !== null && Number.isNaN(duration)) nextErrors.duration = 'Use minutes:seconds, like 0:08 or 1:30.'
      next = { ...draft, video: { url, durationSeconds: duration !== null && !Number.isNaN(duration) ? duration : null } }
    }
    setErrors(nextErrors)
    return Object.values(nextErrors).some(Boolean) ? null : next
  }

  async function save() {
    const valid = validate()
    if (!valid) {
      toast.error('Please check the highlighted fields.')
      return
    }
    setSaving(true)
    try {
      const savedId = await saveCreation({ id, draft: valid, assets, coverKey })
      savedRef.current = true
      setDirty(false)
      toast.success(isNew ? 'Saved to your library' : 'Changes saved')
      navigate(`/c/${savedId}`, { replace: true })
    } catch (error) {
      console.error(error)
      toast.error(error instanceof StorageFullError ? error.message : 'Couldn’t save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!loaded) return <div className="p-8 text-sm text-muted">Loading…</div>
  if (notFound) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-lg font-semibold">This item doesn’t exist</h1>
        <p className="mt-2 text-sm text-muted">It may have been deleted.</p>
        <Link to="/library" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Back to library
        </Link>
      </div>
    )
  }

  const isVideo = draft.contentType === 'video'

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:px-8" onPaste={handlePaste}>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{isNew ? 'New creation' : 'Edit creation'}</h1>
        <p className="text-sm text-muted">
          {draft.parentTitle
            ? `Variation of “${draft.parentTitle}”. Changes here never affect the original.`
            : 'Only the basics are needed — you can save now and fill in the rest later.'}
        </p>
      </div>

      <form
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="What did you make?">
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Content type">
              {CONTENT_TYPES.map((type) => {
                const Icon = TYPE_ICONS[type]
                const active = draft.contentType === type
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update('contentType', type)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 text-xs font-medium transition-colors',
                      active ? 'border-accent/60 bg-accent-soft text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                    )}
                  >
                    <Icon className={cn('size-4', active && 'text-accent')} />
                    {CONTENT_TYPE_LABELS[type]}
                  </button>
                )
              })}
            </div>
            <Field label="Title" error={errors.title}>
              {(fid) => (
                <Input
                  id={fid}
                  ref={titleRef}
                  value={draft.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="e.g. Neon rain alley, cinematic"
                  maxLength={200}
                />
              )}
            </Field>
            <Field
              label="Prompt"
              hint={draft.prompt ? `${draft.prompt.length.toLocaleString()} characters` : 'Paste the exact prompt you used so you can reuse it later.'}
            >
              {(fid) => (
                <div className="relative">
                  <Textarea
                    id={fid}
                    value={draft.prompt}
                    onChange={(e) => update('prompt', e.target.value)}
                    placeholder="Paste or type your prompt…"
                    rows={7}
                    className="min-h-40 pb-10 font-mono text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={pasteIntoPrompt}
                    className="absolute right-2 bottom-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 text-xs font-medium text-muted hover:text-fg"
                  >
                    <ClipboardPaste className="size-3.5" /> Paste
                  </button>
                </div>
              )}
            </Field>
          </Section>

          {isVideo && (
            <Section title="Video" description="PromptVault saves a link to your video — the video file itself isn’t downloaded or stored.">
              <Field label="Video URL" optional error={errors.videoUrl} hint="Where the video lives, e.g. a YouTube, Drive or generator link.">
                {(fid) => (
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
                    <Input
                      id={fid}
                      type="url"
                      inputMode="url"
                      value={draft.video?.url ?? ''}
                      onChange={(e) => update('video', { url: e.target.value, durationSeconds: draft.video?.durationSeconds ?? null })}
                      placeholder="https://"
                      className="pl-9"
                    />
                  </div>
                )}
              </Field>
              <Field label="Duration" optional error={errors.duration} hint="Minutes:seconds, e.g. 0:08">
                {(fid) => (
                  <Input
                    id={fid}
                    value={durationText}
                    onChange={(e) => {
                      setDurationText(e.target.value)
                      setDirty(true)
                    }}
                    placeholder="0:10"
                    className="max-w-40"
                  />
                )}
              </Field>
            </Section>
          )}

          <Section
            title={isVideo ? 'Thumbnail & reference images' : 'Images'}
            description={
              isVideo
                ? 'Add a thumbnail or still frame, plus any reference images you used.'
                : 'Attach generated results and any reference images you used.'
            }
          >
            <AttachmentsEditor
              assets={assets}
              onChange={(next) => {
                setAssets(next)
                setDirty(true)
              }}
              coverKey={coverKey}
              onCoverChange={(key) => {
                setCoverKey(key)
                setDirty(true)
              }}
              defaultRole={isVideo ? 'thumbnail' : draft.contentType === 'image' ? 'output' : 'reference'}
            />
          </Section>

          <Section title="Notes">
            <Field label="Description or notes" optional hint="What worked, what you’d change, where you used it.">
              {(fid) => (
                <Textarea
                  id={fid}
                  value={draft.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={4}
                  placeholder="e.g. Best result after 4 rerolls. Lower stylize looked flat."
                />
              )}
            </Field>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Details">
            <Field label="AI tool or model" optional>
              {(fid) => (
                <>
                  <Input
                    id={fid}
                    list={`${fid}-list`}
                    value={draft.model}
                    onChange={(e) => update('model', e.target.value)}
                    placeholder="e.g. Midjourney v7"
                    maxLength={100}
                  />
                  <datalist id={`${fid}-list`}>
                    {modelSuggestions.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Category" optional>
              {(fid) => (
                <>
                  <Input
                    id={fid}
                    list={`${fid}-list`}
                    value={draft.category}
                    onChange={(e) => update('category', e.target.value)}
                    placeholder="e.g. Landscape, Portrait, Ad"
                    maxLength={100}
                  />
                  <datalist id={`${fid}-list`}>
                    {categorySuggestions.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Tags" optional>
              {(fid) => <TagInput id={fid} value={draft.tags} onChange={(tags) => update('tags', tags)} suggestions={tagSuggestions} />}
            </Field>
            <Field label="Created on">
              {(fid) => (
                <Input id={fid} type="date" value={draft.createdOn} onChange={(e) => update('createdOn', e.target.value || draft.createdOn)} />
              )}
            </Field>
          </Section>

          <Section title="Collections">
            <div className="flex flex-wrap gap-1.5">
              {collections?.map((collection) => {
                const active = draft.collectionIds.includes(collection.id)
                return (
                  <button
                    key={collection.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      update(
                        'collectionIds',
                        active ? draft.collectionIds.filter((c) => c !== collection.id) : [...draft.collectionIds, collection.id],
                      )
                    }
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                      active ? 'border-accent/60 bg-accent-soft text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                    )}
                  >
                    <span className={cn('size-1.5 rounded-full', COLLECTION_COLOR_CLASSES[collection.color].dot)} />
                    {collection.name}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setNewCollectionOpen(true)}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 text-xs text-muted hover:text-fg"
              >
                <Plus className="size-3" /> New
              </button>
            </div>
          </Section>

          <section className="rounded-xl border border-line bg-surface">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              className="flex w-full items-center gap-2 p-4 text-left sm:px-5"
            >
              <SlidersHorizontal className="size-4 text-muted" />
              <span className="flex-1 text-sm font-semibold tracking-tight">Generation settings</span>
              <ChevronDown className={cn('size-4 text-subtle transition-transform', showAdvanced && 'rotate-180')} />
            </button>
            {showAdvanced && (
              <div className="flex flex-col gap-4 border-t border-line p-4 sm:p-5">
                <Field label="Negative prompt" optional>
                  {(fid) => (
                    <Textarea
                      id={fid}
                      value={draft.negativePrompt}
                      onChange={(e) => update('negativePrompt', e.target.value)}
                      rows={3}
                      className="min-h-16 font-mono text-[13px]"
                      placeholder="blurry, low quality, watermark"
                    />
                  )}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Aspect ratio" optional>
                    {(fid) => (
                      <>
                        <Input id={fid} list={`${fid}-list`} value={draft.aspectRatio} onChange={(e) => update('aspectRatio', e.target.value)} placeholder="16:9" />
                        <datalist id={`${fid}-list`}>
                          {ASPECT_RATIO_SUGGESTIONS.map((r) => (
                            <option key={r} value={r} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </Field>
                  <Field label="Resolution" optional>
                    {(fid) => <Input id={fid} value={draft.resolution} onChange={(e) => update('resolution', e.target.value)} placeholder="1920×1080" />}
                  </Field>
                </div>
                <Field label="Seed" optional>
                  {(fid) => <Input id={fid} value={draft.seed} onChange={(e) => update('seed', e.target.value)} placeholder="e.g. 284019" className="font-mono" />}
                </Field>
                <Field label="Other settings" optional hint="Steps, CFG, stylize, sampler, LoRAs…">
                  {(fid) => (
                    <Textarea
                      id={fid}
                      value={draft.settings}
                      onChange={(e) => update('settings', e.target.value)}
                      rows={3}
                      className="min-h-16 font-mono text-[13px]"
                      placeholder="--stylize 250 --chaos 10"
                    />
                  )}
                </Field>
                <Field label="Source URL" optional error={errors.sourceUrl} hint="Link to the original post or generation page.">
                  {(fid) => <Input id={fid} type="url" inputMode="url" value={draft.sourceUrl} onChange={(e) => update('sourceUrl', e.target.value)} placeholder="https://" />}
                </Field>
              </div>
            )}
          </section>

          <p className="flex gap-2 px-1 text-xs leading-relaxed text-subtle">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Everything is saved in this browser on this device. Make regular backups from Backup & restore.
          </p>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur-md lg:left-60">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8">
            <span className="mr-auto hidden text-xs text-subtle sm:block">{dirty ? 'Unsaved changes' : ''}</span>
            <Button variant="ghost" onClick={() => navigate(id ? `/c/${id}` : '/library')}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {isNew ? 'Save creation' : 'Save changes'}
            </Button>
          </div>
        </div>
      </form>

      <CollectionDialog
        open={newCollectionOpen}
        onOpenChange={setNewCollectionOpen}
        onCreated={(collection) => update('collectionIds', [...draft.collectionIds, collection.id])}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked' && !discardingRef.current) blocker.reset()
        }}
        title="Discard unsaved changes?"
        description="You have changes that haven’t been saved yet."
        confirmLabel="Discard changes"
        destructive
        onConfirm={() => {
          discardingRef.current = true
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
    </div>
  )
}
