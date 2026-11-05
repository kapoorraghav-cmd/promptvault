import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArrowLeft, ArrowRight, FolderOpen, ImagePlus, Lock, MessageSquareText, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { db, getMeta, META_KEYS, setMeta } from '../../lib/db'
import { loadSampleData } from '../../lib/sample-data'
import { cn } from '../../lib/utils'
import { LogoMark } from '../brand/logo'
import { Button } from '../ui/button'

const STEPS = [
  {
    icon: null,
    title: 'Welcome to PromptVault',
    body: 'Your creative memory for AI. Save the prompts and results you create, remember exactly how you made them, and find them again in seconds.',
    points: ['Works with any AI tool — images, video, text and audio', 'No account, no subscription, no tracking'],
  },
  {
    icon: MessageSquareText,
    title: 'Save your first prompt',
    body: 'Click “New creation” (or press N). Paste the prompt, pick the type and note which model you used. Everything else is optional — you can fill it in later.',
    points: ['Record seeds, aspect ratios and settings', 'Got a screenshot of a prompt? Extract the text from it'],
  },
  {
    icon: ImagePlus,
    title: 'Attach what you generated',
    body: 'Drag images in, choose them from your device or paste them straight from the clipboard. Originals are stored untouched, with fast previews for browsing.',
    points: ['Mark images as results, references or thumbnails', 'For videos, save the link plus a thumbnail'],
  },
  {
    icon: FolderOpen,
    title: 'Organise and find anything',
    body: 'Group work into collections, add tags and star your favourites. Search looks through titles, prompts, tags, models and notes instantly.',
    points: ['Duplicate a prompt to try a variation', 'Compare two versions side by side'],
  },
  {
    icon: Archive,
    title: 'Keep a backup',
    body: 'Your library is stored privately in this browser on this device — nothing is uploaded. That also means you should download a backup from time to time.',
    points: ['One-click backup with all images', 'Restore on any device from the backup file'],
  },
]

export function Onboarding() {
  const navigate = useNavigate()
  const done = useLiveQuery(() => getMeta<boolean>(META_KEYS.onboardingDone, false), [])
  const libraryEmpty = useLiveQuery(async () => (await db.creations.count()) === 0, [])
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const open = done === false
  const current = STEPS[step]
  const last = step === STEPS.length - 1

  async function finish(withSamples: boolean) {
    if (withSamples) {
      setLoading(true)
      try {
        await loadSampleData()
        toast.success('Sample library added', { description: 'Remove it any time from the dashboard or Settings.' })
      } catch (error) {
        console.error(error)
        toast.error('The sample library couldn’t be loaded.')
      } finally {
        setLoading(false)
      }
    }
    await setMeta(META_KEYS.onboardingDone, true)
    setStep(0)
    if (withSamples) navigate('/')
  }

  const Icon = current.icon

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) void finish(false)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/60 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 animate-scale-in flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-pop focus:outline-none"
          aria-describedby="onboarding-body"
        >
          <div className="relative overflow-hidden border-b border-line bg-surface-2 px-6 pt-8 pb-6 sm:px-8">
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, var(--pv-line-strong) 1px, transparent 0)',
                backgroundSize: '18px 18px',
                maskImage: 'linear-gradient(to bottom, black, transparent)',
              }}
              aria-hidden
            />
            <div className="relative flex items-center gap-3">
              {Icon ? (
                <div className="flex size-12 items-center justify-center rounded-xl border border-line-strong bg-surface text-accent shadow-card">
                  <Icon className="size-5" />
                </div>
              ) : (
                <LogoMark className="size-12" />
              )}
              <div className="ml-auto flex gap-1.5" aria-hidden>
                {STEPS.map((_, i) => (
                  <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-accent' : 'w-1.5 bg-line-strong')} />
                ))}
              </div>
            </div>
            <DialogPrimitive.Title className="relative mt-5 text-lg font-semibold tracking-tight">{current.title}</DialogPrimitive.Title>
            <p className="relative mt-1 text-xs text-subtle">
              Step {step + 1} of {STEPS.length}
            </p>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5 sm:px-8">
            <p id="onboarding-body" className="text-sm leading-relaxed text-muted">
              {current.body}
            </p>
            <ul className="flex flex-col gap-2">
              {current.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[13px]">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  {point}
                </li>
              ))}
            </ul>
            {step === 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-xs text-muted">
                <Lock className="mt-0.5 size-3.5 shrink-0 text-success" />
                Everything you save stays in this browser. PromptVault has no servers and never uploads your work.
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:items-center sm:px-8">
            {step > 0 ? (
              <Button variant="ghost" icon={<ArrowLeft />} onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => finish(false)}>
                Skip tour
              </Button>
            )}
            <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
              {last ? (
                <>
                  <Button variant="outline" onClick={() => finish(false)} disabled={loading}>
                    Start empty
                  </Button>
                  {libraryEmpty !== false && (
                    <Button variant="primary" icon={<Sparkles />} loading={loading} onClick={() => finish(true)}>
                      Explore with sample library
                    </Button>
                  )}
                  {libraryEmpty === false && (
                    <Button variant="primary" onClick={() => finish(false)}>
                      Get started
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
                  Next <ArrowRight />
                </Button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
