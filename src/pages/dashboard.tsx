import { useLiveQuery } from 'dexie-react-hooks'
import {
  Archive,
  ArrowRight,
  Check,
  Copy,
  FolderOpen,
  ImagePlus,
  Layers,
  MessageSquareText,
  Plus,
  ScanText,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { CreationCard } from '../components/creations/creation-card'
import { TypeIcon } from '../components/creations/media'
import { Button, ButtonLink } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/dialog'
import { Card, SectionHeader } from '../components/ui/misc'
import { copyPrompt } from '../lib/clipboard'
import { db, getMeta, META_KEYS, setMeta } from '../lib/db'
import { useCollections, useCreations } from '../lib/hooks'
import { COLLECTION_COLOR_CLASSES } from '../lib/labels'
import { removeSampleData } from '../lib/repo'
import { cn, formatRelative, pluralise } from '../lib/utils'

function Stat({ label, value, icon, to }: { label: string; value: number | undefined; icon: React.ReactNode; to: string }) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-strong"
    >
      <div className="flex items-center justify-between text-muted">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="text-subtle transition-colors group-hover:text-muted [&_svg]:size-4">{icon}</span>
      </div>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{value === undefined ? '–' : value.toLocaleString()}</span>
    </Link>
  )
}

function SampleBanner() {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-info/25 bg-info-soft px-4 py-3 sm:flex-row sm:items-center">
      <Sparkles className="size-4 shrink-0 text-info" />
      <p className="flex-1 text-[13px] text-fg">
        <span className="font-medium">You’re exploring the sample library.</span>{' '}
        <span className="text-muted">These items are examples to show how PromptVault works. Remove them whenever you’re ready.</span>
      </p>
      <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>
        Remove sample data
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove sample data?"
        description="All sample items and sample collections will be removed. Anything you created or edited yourself is kept."
        confirmLabel="Remove samples"
        onConfirm={async () => {
          await removeSampleData()
          toast.success('Sample data removed')
        }}
      />
    </div>
  )
}

function BackupReminder({ lastBackupAt }: { lastBackupAt: number | null }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 sm:flex-row sm:items-center">
      <Archive className="size-4 shrink-0 text-accent" />
      <p className="flex-1 text-[13px]">
        <span className="font-medium">{lastBackupAt ? 'It’s been a while since your last backup.' : 'You haven’t made a backup yet.'}</span>{' '}
        <span className="text-muted">Your library lives only in this browser. A backup file keeps it safe if browser data is cleared.</span>
      </p>
      <ButtonLink to="/backup" size="sm" variant="primary">
        Back up now
      </ButtonLink>
    </div>
  )
}

function GettingStarted({ steps, onDismiss }: { steps: { label: string; done: boolean; to: string; hint: string }[]; onDismiss: () => void }) {
  const completed = steps.filter((s) => s.done).length
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Get started with PromptVault</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {completed} of {steps.length} done — these take about two minutes.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Hide getting started"
          className="inline-flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(completed / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, i) => (
          <li key={step.label}>
            <Link
              to={step.to}
              className={cn(
                'flex h-full items-start gap-3 rounded-lg border p-3 transition-colors',
                step.done ? 'border-line bg-surface-2/50' : 'border-line hover:border-line-strong hover:bg-surface-2/60',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  step.done ? 'bg-success text-white' : 'border border-line-strong text-muted',
                )}
              >
                {step.done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-[13px] font-medium', step.done && 'text-muted line-through decoration-subtle')}>{step.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-subtle">{step.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  )
}

export function DashboardPage() {
  const creations = useCreations()
  const collections = useCollections()
  const lastBackupAt = useLiveQuery(() => getMeta<number | null>(META_KEYS.lastBackupAt, null), [])
  const dismissed = useLiveQuery(() => getMeta<boolean>(META_KEYS.gettingStartedDismissed, false), [])
  const assetCount = useLiveQuery(() => db.assets.count(), [])

  const stats = useMemo(() => {
    if (!creations) return null
    const own = creations.filter((c) => !c.isSample)
    return {
      total: creations.length,
      prompts: creations.filter((c) => c.prompt.trim()).length,
      favourites: creations.filter((c) => c.favourite).length,
      hasSamples: creations.some((c) => c.isSample),
      ownCount: own.length,
      ownHasImage: own.some((c) => c.assetIds.length > 0),
      recent: [...creations].sort((a, b) => b.addedAt - a.addedAt).slice(0, 4),
      recentlyUsed: creations
        .filter((c) => c.lastUsedAt)
        .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
        .slice(0, 5),
    }
  }, [creations])

  const collectionCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of creations ?? []) for (const id of c.collectionIds) map.set(id, (map.get(id) ?? 0) + 1)
    return map
  }, [creations])

  if (!stats || collections === undefined) return null

  const ownCollections = collections.filter((c) => !c.isSample).length
  const steps = [
    { label: 'Save your first prompt', done: stats.ownCount > 0, to: '/new', hint: 'Paste a prompt you’re proud of.' },
    { label: 'Attach a generated image', done: stats.ownHasImage, to: '/new', hint: 'Keep the result next to the prompt.' },
    { label: 'Create a collection', done: ownCollections > 0, to: '/collections', hint: 'Group work by project or style.' },
    { label: 'Make your first backup', done: Boolean(lastBackupAt), to: '/backup', hint: 'Download a copy you control.' },
  ]
  const showGettingStarted = !dismissed && steps.some((s) => !s.done)
  const backupStale = stats.ownCount > 0 && (!lastBackupAt || Date.now() - lastBackupAt > 14 * 24 * 60 * 60 * 1000)
  const isEmpty = stats.total === 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">Your creative memory</h1>
          <p className="mt-1 text-sm text-muted">Save what you create. Remember how you created it. Find it when you need it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/extract" variant="outline" icon={<ScanText />}>
            Extract from screenshot
          </ButtonLink>
          <ButtonLink to="/new" variant="primary" icon={<Plus />}>
            New creation
          </ButtonLink>
        </div>
      </div>

      {stats.hasSamples && <SampleBanner />}
      {backupStale && <BackupReminder lastBackupAt={lastBackupAt ?? null} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Creations" value={stats.total} icon={<Layers />} to="/library" />
        <Stat label="Prompts" value={stats.prompts} icon={<MessageSquareText />} to="/library" />
        <Stat label="Collections" value={collections.length} icon={<FolderOpen />} to="/collections" />
        <Stat label="Favourites" value={stats.favourites} icon={<Star />} to="/library?fav=1" />
      </div>

      {showGettingStarted && <GettingStarted steps={steps} onDismiss={() => setMeta(META_KEYS.gettingStartedDismissed, true)} />}

      {isEmpty ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <div className="mb-5 flex size-12 items-center justify-center rounded-xl border border-line-strong bg-surface-2 text-muted">
            <ImagePlus className="size-5" />
          </div>
          <h2 className="text-[15px] font-semibold tracking-tight">Start your library</h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">
            Save a prompt together with the image it produced and the model you used. Next time, you’ll know exactly how you made it.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <ButtonLink to="/new" variant="primary" icon={<Plus />}>
              Add your first creation
            </ButtonLink>
            <ButtonLink to="/settings#sample-data" variant="outline">
              Explore with sample data
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="flex min-w-0 flex-col gap-3">
            <SectionHeader
              title="Recently added"
              action={
                <Link to="/library" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 2xl:grid-cols-4">
              {stats.recent.map((c) => (
                <CreationCard key={c.id} creation={c} />
              ))}
            </div>
          </section>

          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex flex-col gap-3">
              <SectionHeader title="Recently used prompts" />
              <Card className="overflow-hidden">
                {stats.recentlyUsed.length === 0 ? (
                  <p className="p-4 text-[13px] leading-relaxed text-muted">
                    Prompts you copy will appear here, so your go-to prompts are always one click away.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {stats.recentlyUsed.map((c) => (
                      <li key={c.id} className="group flex items-center gap-3 px-3.5 py-2.5">
                        <TypeIcon type={c.contentType} className="size-4 shrink-0 text-subtle" />
                        <Link to={`/c/${c.id}`} className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium hover:underline">{c.title || 'Untitled'}</span>
                          <span className="block truncate text-xs text-subtle">Copied {formatRelative(c.lastUsedAt!)}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => copyPrompt(c)}
                          aria-label={`Copy prompt: ${c.title}`}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"
                        >
                          <Copy className="size-3.5" /> Copy
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Collections"
                action={
                  <Link to="/collections" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
                    All <ArrowRight className="size-3.5" />
                  </Link>
                }
              />
              {collections.length === 0 ? (
                <Card className="p-4 text-[13px] text-muted">
                  <Link to="/collections" className="font-medium text-fg hover:underline">
                    Create a collection
                  </Link>{' '}
                  to group related work.
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {collections.slice(0, 6).map((collection) => (
                    <Link
                      key={collection.id}
                      to={`/collections/${collection.id}`}
                      className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:border-line-strong"
                    >
                      <span className={cn('size-2 shrink-0 rounded-full', COLLECTION_COLOR_CLASSES[collection.color].dot)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{collection.name}</span>
                        <span className="block text-[11px] text-subtle">{pluralise(collectionCounts.get(collection.id) ?? 0, 'item')}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <p className="px-1 text-xs leading-relaxed text-subtle">
              {pluralise(assetCount ?? 0, 'file')} stored privately in this browser.{' '}
              <Link to="/settings#privacy" className="underline-offset-2 hover:text-muted hover:underline">
                How your data is stored
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
