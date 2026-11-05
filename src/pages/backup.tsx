import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Archive, Check, FileJson, FileText, FolderDown, Info, Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Badge, Card, PageHeader } from '../components/ui/misc'
import { applyImport, analyseImport, ImportError, parseBackupFile, type ConflictStrategy, type ImportAnalysis, type ImportSummary } from '../lib/backup/import'
import { db, getMeta, META_KEYS } from '../lib/db'
import { downloadBackup, downloadMarkdown } from '../lib/export-actions'
import { useCollections, useCreations } from '../lib/hooks'
import { COLLECTION_COLOR_CLASSES } from '../lib/labels'
import { cn, formatDateTime, pluralise } from '../lib/utils'

function ExportCard({
  icon,
  title,
  description,
  action,
  recommended,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: React.ReactNode
  recommended?: boolean
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-muted [&_svg]:size-5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          {recommended && <Badge tone="accent">Recommended</Badge>}
        </div>
        <p className="mt-0.5 text-[13px] text-muted">{description}</p>
      </div>
      {action}
    </div>
  )
}

const STRATEGIES: { value: ConflictStrategy; label: string; description: string }[] = [
  { value: 'skip', label: 'Keep what I have', description: 'Items already in your library are left alone. Only new items are added.' },
  { value: 'replace', label: 'Replace with the backup', description: 'Items already in your library are overwritten by the version in the backup.' },
  { value: 'copy', label: 'Keep both', description: 'Matching items are imported as separate copies.' },
]

function ImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [strategy, setStrategy] = useState<ConflictStrategy>('skip')
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  async function read(file: File | undefined) {
    if (!file) return
    setError(null)
    setSummary(null)
    setAnalysis(null)
    setFileName(file.name)
    setReading(true)
    try {
      const parsed = await parseBackupFile(file)
      setAnalysis(await analyseImport(parsed))
    } catch (err) {
      setError(err instanceof ImportError ? err.message : 'This file couldn’t be read. It may be damaged.')
    } finally {
      setReading(false)
    }
  }

  async function runImport() {
    if (!analysis) return
    setImporting(true)
    try {
      const result = await applyImport(analysis.backup, strategy)
      setSummary(result)
      setAnalysis(null)
      toast.success('Import complete')
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error && err.name === 'QuotaExceededError'
          ? 'Your browser storage is full, so the import was cancelled. Nothing was changed.'
          : 'The import failed and was cancelled. Nothing was changed.',
      )
    } finally {
      setImporting(false)
    }
  }

  const conflicts = analysis ? analysis.conflictingCreations + analysis.conflictingCollections : 0

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <div
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface-2/40 px-4 py-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            read(e.dataTransfer.files[0])
          }}
        >
          <div className="flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-muted">
            {reading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          </div>
          <div className="text-sm">
            <button type="button" onClick={() => inputRef.current?.click()} className="font-medium underline-offset-4 hover:underline">
              Choose a backup file
            </button>{' '}
            <span className="text-muted">or drop it here</span>
          </div>
          <p className="text-xs text-subtle">A .zip or .json file exported from PromptVault. You’ll see a preview before anything changes.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            className="hidden"
            data-testid="import-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              read(file)
            }}
          />
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft p-3 text-[13px]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <div>
              <p className="font-medium">Couldn’t import {fileName || 'this file'}</p>
              <p className="mt-0.5 text-muted">{error}</p>
            </div>
          </div>
        )}

        {analysis && (
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-2/40 p-4" data-testid="import-preview">
            <div>
              <h3 className="text-sm font-medium">Ready to import “{fileName}”</h3>
              <p className="mt-0.5 text-[13px] text-muted">
                {pluralise(analysis.backup.creations.length, 'item')}, {pluralise(analysis.backup.collections.length, 'collection')} and{' '}
                {pluralise(analysis.backup.assets.length, 'image')}
                {analysis.backup.exportedAt && ` · exported ${formatDateTime(new Date(analysis.backup.exportedAt).getTime())}`}
              </p>
              {!analysis.backup.includesFiles && (
                <p className="mt-1 text-xs text-subtle">This is a data-only backup, so it doesn’t contain images.</p>
              )}
            </div>
            {analysis.backup.warnings.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-accent">
                {analysis.backup.warnings.map((w) => (
                  <li key={w} className="flex gap-1.5">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
            {conflicts > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-[13px]">
                  <span className="font-medium">
                    {pluralise(analysis.conflictingCreations, 'item')} {analysis.conflictingCreations === 1 ? 'is' : 'are'} already in your library.
                  </span>{' '}
                  <span className="text-muted">What should happen to them?</span>
                </legend>
                {STRATEGIES.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                      strategy === option.value ? 'border-accent/60 bg-accent-soft' : 'border-line hover:border-line-strong',
                    )}
                  >
                    <input
                      type="radio"
                      name="strategy"
                      value={option.value}
                      checked={strategy === option.value}
                      onChange={() => setStrategy(option.value)}
                      className="mt-0.5 accent-[var(--pv-accent)]"
                    />
                    <span>
                      <span className="block text-[13px] font-medium">{option.label}</span>
                      <span className="block text-xs text-muted">{option.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" loading={importing} onClick={runImport}>
                Import
              </Button>
              <Button variant="ghost" onClick={() => setAnalysis(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {summary && (
          <div role="status" className="flex items-start gap-2.5 rounded-lg border border-success/30 bg-success-soft p-3 text-[13px]" data-testid="import-summary">
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
            <div>
              <p className="font-medium">Import complete</p>
              <p className="mt-0.5 text-muted">
                {pluralise(summary.added, 'item')} added
                {summary.replaced ? `, ${summary.replaced} replaced` : ''}
                {summary.skipped ? `, ${summary.skipped} skipped (already in your library)` : ''}
                {summary.collectionsAdded ? `, ${pluralise(summary.collectionsAdded, 'collection')} added` : ''}
                {summary.files ? `, ${pluralise(summary.files, 'image')} restored` : ''}.{' '}
                <Link to="/library" className="font-medium text-fg underline-offset-2 hover:underline">
                  Open library
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export function BackupPage() {
  const creations = useCreations()
  const collections = useCollections()
  const lastBackupAt = useLiveQuery(() => getMeta<number | null>(META_KEYS.lastBackupAt, null), [])
  const assetCount = useLiveQuery(() => db.assets.count(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  async function run(key: string, work: () => Promise<unknown>) {
    setBusy(key)
    try {
      await work()
    } finally {
      setBusy(null)
    }
  }

  const empty = (creations?.length ?? 0) === 0 && (collections?.length ?? 0) === 0

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <PageHeader
        title="Backup & restore"
        description="Your library lives in this browser. Download a backup regularly — it’s your copy, and you control where it goes."
      />

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <p>
          {lastBackupAt ? (
            <>
              Last full backup: <span className="font-medium text-fg">{formatDateTime(lastBackupAt)}</span>.
            </>
          ) : (
            <span className="font-medium text-fg">You haven’t made a full backup yet.</span>
          )}{' '}
          Clearing browser data, using a private window, or uninstalling the browser can erase your library. A backup file lets you restore it on
          any device.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Export</h2>
        <ExportCard
          recommended
          icon={<Archive />}
          title="Full backup (.zip)"
          description={`Everything: ${pluralise(creations?.length ?? 0, 'item')}, ${pluralise(collections?.length ?? 0, 'collection')} and ${pluralise(assetCount ?? 0, 'original image')}.`}
          action={
            <Button
              variant="primary"
              disabled={empty}
              loading={busy === 'full'}
              onClick={() => run('full', () => downloadBackup({ kind: 'full' }, true))}
            >
              Download backup
            </Button>
          }
        />
        <ExportCard
          icon={<FileJson />}
          title="Data only (.json)"
          description="All text, settings and collections without images. Small and easy to inspect."
          action={
            <Button variant="outline" disabled={empty} loading={busy === 'json'} onClick={() => run('json', () => downloadBackup({ kind: 'full' }, false, 'data'))}>
              Download JSON
            </Button>
          }
        />
        <ExportCard
          icon={<FileText />}
          title="Prompts as Markdown (.md)"
          description="A readable document of every prompt and its settings — great for notes apps or sharing."
          action={
            <Button
              variant="outline"
              disabled={!creations?.length}
              loading={busy === 'md'}
              onClick={() =>
                run('md', () =>
                  downloadMarkdown(
                    [...(creations ?? [])].sort((a, b) => b.addedAt - a.addedAt),
                    'PromptVault library',
                    `promptvault-prompts-${new Date().toISOString().slice(0, 10)}`,
                  ),
                )
              }
            >
              Download Markdown
            </Button>
          }
        />

        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-muted">
              <FolderDown className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium">Export selected collections</h3>
              <p className="mt-0.5 text-[13px] text-muted">Share or archive part of your library. Includes the items and their images.</p>
            </div>
          </div>
          {collections?.length ? (
            <>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {collections.map((c) => {
                  const active = selected.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelected((s) => (active ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                      className={cn(
                        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                        active ? 'border-accent/60 bg-accent-soft text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                      )}
                    >
                      {active ? <Check className="size-3" /> : <span className={cn('size-1.5 rounded-full', COLLECTION_COLOR_CLASSES[c.color].dot)} />}
                      {c.name}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selected.length}
                  loading={busy === 'collections'}
                  onClick={() =>
                    run('collections', () =>
                      downloadBackup(
                        { kind: 'collections', collectionIds: selected },
                        true,
                        selected.length === 1 ? collections.find((c) => c.id === selected[0])?.name : 'collections',
                      ),
                    )
                  }
                >
                  Download {selected.length ? pluralise(selected.length, 'collection') : 'collections'} (.zip)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!selected.length}
                  onClick={() => {
                    const items = (creations ?? []).filter((c) => c.collectionIds.some((id) => selected.includes(id)))
                    downloadMarkdown(items, 'PromptVault collections', 'promptvault-collections')
                  }}
                >
                  As Markdown
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-subtle">You don’t have any collections yet.</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Restore or import</h2>
        <ImportPanel />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">How to back up and restore</h2>
        <Card className="p-5">
          <ol className="flex flex-col gap-3 text-[13px] leading-relaxed text-muted">
            <li>
              <span className="font-medium text-fg">1. Download a full backup.</span> Click “Download backup”. A .zip file is saved to your
              Downloads folder.
            </li>
            <li>
              <span className="font-medium text-fg">2. Keep it somewhere safe.</span> Move it to cloud storage, a USB drive or another
              computer. PromptVault never uploads it anywhere for you.
            </li>
            <li>
              <span className="font-medium text-fg">3. Restore on any device.</span> Open PromptVault, come to this page and choose the backup
              file. You’ll see what’s inside before anything is imported.
            </li>
            <li>
              <span className="font-medium text-fg">Tip:</span> back up after any big session, and before clearing your browser’s data.
            </li>
          </ol>
        </Card>
      </section>
    </div>
  )
}
