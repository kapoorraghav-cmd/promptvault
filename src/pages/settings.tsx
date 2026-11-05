import { useLiveQuery } from 'dexie-react-hooks'
import {
  Archive,
  ExternalLink,
  HardDrive,
  LayoutGrid,
  List,
  Monitor,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { toast } from 'sonner'
import { LogoMark } from '../components/brand/logo'
import { Button, ButtonLink } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/dialog'
import { Card, PageHeader, Progress, Segmented } from '../components/ui/misc'
import { db, setMeta, META_KEYS } from '../lib/db'
import { clearAllData, removeSampleData } from '../lib/repo'
import { loadSampleData, SAMPLE_COUNTS } from '../lib/sample-data'
import { getStorageInfo, requestPersistentStorage, type StorageInfo } from '../lib/storage'
import { formatBytes, pluralise } from '../lib/utils'
import { usePreferences, type ThemePreference, type ViewMode } from '../store/preferences'

export const APP_VERSION = '1.0.0'
export const REPOSITORY_URL = 'https://github.com/kapoorraghav-cmd/promptvault'

function Row({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-3 text-sm font-semibold tracking-tight">{title}</h2>
      <Card className="divide-y divide-line px-5 py-4">{children}</Card>
    </section>
  )
}

function StorageSection() {
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const counts = useLiveQuery(async () => {
    const [creations, collections, assetRecords] = await Promise.all([db.creations.count(), db.collections.count(), db.assets.toArray()])
    const bytes = assetRecords.reduce((sum, a) => sum + a.size + (a.thumb?.byteLength ?? 0), 0)
    return { creations, assets: assetRecords.length, collections, bytes }
  }, [])

  useEffect(() => {
    getStorageInfo().then(setInfo)
  }, [counts?.creations, counts?.assets])

  const percent = info?.quota ? (info.usage / info.quota) * 100 : 0

  return (
    <Section id="storage" title="Storage">
      <div className="flex flex-col gap-3 pb-4">
        <div className="flex items-start gap-3">
          <HardDrive className="mt-0.5 size-4 text-muted" />
          <div className="flex-1 text-[13px] text-muted">
            <span className="font-medium text-fg">
              {pluralise(counts?.creations ?? 0, 'item')}, {pluralise(counts?.collections ?? 0, 'collection')}, {pluralise(counts?.assets ?? 0, 'image')}
            </span>{' '}
            · images take about {formatBytes(counts?.bytes ?? 0)}
          </div>
        </div>
        {info?.supported ? (
          <>
            <Progress value={Math.max(percent, 0.5)} />
            <p className="text-xs text-subtle">
              {formatBytes(info.usage)} used of about {formatBytes(info.quota)} your browser makes available to PromptVault.
              {percent > 80 && ' You’re running low — consider exporting a backup and removing large images.'}
            </p>
          </>
        ) : (
          <p className="text-xs text-subtle">This browser doesn’t report storage usage.</p>
        )}
      </div>
      <Row
        title="Protect from automatic clean-up"
        description={
          info?.persisted
            ? 'Your browser has agreed to keep PromptVault’s data unless you delete it yourself.'
            : 'Ask your browser not to remove PromptVault’s data when the device is low on space. Some browsers decide automatically.'
        }
      >
        <Button
          variant="outline"
          disabled={Boolean(info?.persisted) || !info?.supported}
          onClick={async () => {
            const granted = await requestPersistentStorage()
            setInfo(await getStorageInfo())
            if (granted) toast.success('Storage protection turned on')
            else toast.message('Your browser declined for now. It may allow it after you use PromptVault more often. Regular backups are the safest option.')
          }}
        >
          {info?.persisted ? 'Protected' : 'Request protection'}
        </Button>
      </Row>
    </Section>
  )
}

export function SettingsPage() {
  const location = useLocation()
  const theme = usePreferences((s) => s.theme)
  const setTheme = usePreferences((s) => s.setTheme)
  const defaultView = usePreferences((s) => s.defaultView)
  const setDefaultView = usePreferences((s) => s.setDefaultView)
  const sampleCount = useLiveQuery(() => db.creations.filter((c) => c.isSample).count(), [])
  const [loadingSamples, setLoadingSamples] = useState(false)
  const [confirmRemoveSamples, setConfirmRemoveSamples] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    const id = location.hash.replace('#', '')
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <PageHeader title="Settings" description="Preferences, storage and your data." />

      <Section id="appearance" title="Appearance">
        <Row title="Theme" description="Dark is the default. System follows your device setting.">
          <Segmented<ThemePreference>
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: 'Dark', icon: <Moon /> },
              { value: 'light', label: 'Light', icon: <Sun /> },
              { value: 'system', label: 'System', icon: <Monitor /> },
            ]}
          />
        </Row>
        <Row title="Default library view" description="How the library and collections are shown when you open them.">
          <Segmented<ViewMode>
            label="Default view"
            value={defaultView}
            onChange={setDefaultView}
            options={[
              { value: 'grid', label: 'Grid', icon: <LayoutGrid /> },
              { value: 'list', label: 'List', icon: <List /> },
            ]}
          />
        </Row>
      </Section>

      <Section id="sample-data" title="Sample data">
        <Row
          title={sampleCount ? 'Sample library is loaded' : 'Sample library'}
          description={
            sampleCount
              ? `${pluralise(sampleCount, 'sample item')} in your library, marked “Sample”. Items you’ve edited are treated as your own and kept.`
              : `Add ${SAMPLE_COUNTS.creations} example creations and ${SAMPLE_COUNTS.collections} collections to explore features. Your own items aren’t affected.`
          }
        >
          {sampleCount ? (
            <Button variant="outline" onClick={() => setConfirmRemoveSamples(true)}>
              Remove sample data
            </Button>
          ) : (
            <Button
              variant="outline"
              icon={<Sparkles />}
              loading={loadingSamples}
              onClick={async () => {
                setLoadingSamples(true)
                try {
                  await loadSampleData()
                  toast.success('Sample library added')
                } catch (error) {
                  console.error(error)
                  toast.error('The sample library couldn’t be loaded.')
                } finally {
                  setLoadingSamples(false)
                }
              }}
            >
              Load sample library
            </Button>
          )}
        </Row>
      </Section>

      <StorageSection />

      <Section id="data" title="Your data">
        <Row title="Backup & restore" description="Export your full library with images, or import a previous backup.">
          <ButtonLink to="/backup" variant="outline" icon={<Archive />}>
            Open backup & restore
          </ButtonLink>
        </Row>
        <Row
          title="Clear all data"
          description="Permanently delete every item, image, collection and setting stored by PromptVault in this browser."
        >
          <Button variant="outline" className="border-danger/40 text-danger hover:bg-danger-soft" icon={<Trash2 />} onClick={() => setConfirmClear(true)}>
            Clear all data…
          </Button>
        </Row>
      </Section>

      <section id="privacy" className="scroll-mt-20">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Privacy</h2>
        <Card className="flex flex-col gap-4 p-5 text-[13px] leading-relaxed text-muted">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            <p>
              <span className="font-medium text-fg">Your library stays on this device.</span> Prompts, notes and images are stored in your
              browser’s built-in database (IndexedDB). PromptVault has no server, no account and no analytics, and it doesn’t send your content
              anywhere.
            </p>
          </div>
          <ul className="flex list-disc flex-col gap-1.5 pl-9">
            <li>Text recognition (OCR) runs inside your browser. Screenshots are never uploaded.</li>
            <li>The published app blocks connections to other servers using a Content Security Policy.</li>
            <li>Links you save (like video URLs) only open when you click them.</li>
            <li>
              Anyone with access to this browser profile can see your library. Browser data isn’t encrypted by PromptVault, so don’t store
              passwords or secrets in prompts.
            </li>
            <li>
              Data can be lost if you clear site data, use a private window, or the browser removes storage when space is low.{' '}
              <Link to="/backup" className="font-medium text-fg underline-offset-2 hover:underline">
                Make regular backups.
              </Link>
            </li>
            <li>Data doesn’t sync between browsers or devices. Use a backup file to move your library.</li>
          </ul>
        </Card>
      </section>

      <section id="about" className="scroll-mt-20">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">About</h2>
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <LogoMark className="size-12" />
          <div className="min-w-0 flex-1 text-[13px] text-muted">
            <div className="text-sm font-semibold text-fg">PromptVault {APP_VERSION}</div>
            <p className="mt-0.5">Your creative memory for AI. Free and open source under the MIT licence.</p>
          </div>
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong px-3.5 text-sm font-medium hover:bg-surface-2"
          >
            <ExternalLink className="size-4" /> Source code
          </a>
        </Card>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-subtle">
          <button type="button" className="hover:text-muted" onClick={() => setMeta(META_KEYS.onboardingDone, false)}>
            Show the welcome tour again
          </button>
          <a href={`${REPOSITORY_URL}/issues`} target="_blank" rel="noopener noreferrer" className="hover:text-muted">
            Report a problem
          </a>
        </div>
      </section>

      <ConfirmDialog
        open={confirmRemoveSamples}
        onOpenChange={setConfirmRemoveSamples}
        title="Remove sample data?"
        description="All sample items and sample collections will be removed. Anything you created or edited yourself is kept."
        confirmLabel="Remove samples"
        onConfirm={async () => {
          await removeSampleData()
          toast.success('Sample data removed')
        }}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Delete everything?"
        description="This permanently deletes your entire PromptVault library from this browser, including all images and collections. It can’t be undone. Download a backup first if you might need anything later."
        confirmLabel="Delete everything"
        destructive
        requireText="DELETE"
        onConfirm={async () => {
          await clearAllData()
          await setMeta(META_KEYS.onboardingDone, true)
          toast.success('All data cleared')
        }}
      >
        <Link to="/backup" className="mb-4 inline-flex text-[13px] font-medium text-accent hover:underline">
          Download a backup first →
        </Link>
      </ConfirmDialog>
    </div>
  )
}
