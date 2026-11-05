import { AlertTriangle, Check, Copy, ImageUp, Loader2, Lock, RotateCcw, ScanText, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/input'
import { Badge, PageHeader, Progress } from '../components/ui/misc'
import { copyText } from '../lib/clipboard'
import { useBlobUrl } from '../lib/hooks'
import { ACCEPT_ATTRIBUTE, checkImageFile } from '../lib/images'
import { extractText, type OcrProgress } from '../lib/ocr'
import { cn } from '../lib/utils'
import { useHandoff } from '../store/handoff'

type Status = 'idle' | 'working' | 'done' | 'error'

export function ExtractPage() {
  const navigate = useNavigate()
  const setPendingPrompt = useHandoff((s) => s.setPendingPrompt)
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [text, setText] = useState('')
  const [confidence, setConfidence] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keepScreenshot, setKeepScreenshot] = useState(true)
  const [dragging, setDragging] = useState(false)
  const preview = useBlobUrl(file)

  async function choose(next: File | undefined) {
    if (!next) return
    const check = await checkImageFile(next)
    if (!check.ok) {
      toast.error('That file can’t be used', { description: check.reason })
      return
    }
    setFile(next)
    setText('')
    setConfidence(null)
    setError(null)
    setStatus('idle')
    run(next)
  }

  async function run(target = file) {
    if (!target) return
    setStatus('working')
    setError(null)
    setProgress({ status: 'Starting', progress: 0 })
    try {
      const result = await extractText(target, setProgress)
      setText(result.text)
      setConfidence(result.confidence)
      setStatus('done')
      if (!result.text) toast.message('No readable text was found in this image.')
    } catch (err) {
      console.error(err)
      setStatus('error')
      setError('Text recognition couldn’t run in this browser. Try another browser, or type the prompt manually below.')
    }
  }

  function saveAsCreation() {
    setPendingPrompt({ prompt: text, screenshot: keepScreenshot ? file : null })
    navigate('/new')
  }

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 lg:px-8"
      onPaste={(e) => {
        const pasted = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'))
        if (pasted) {
          e.preventDefault()
          choose(pasted)
        }
      }}
    >
      <PageHeader
        title="Extract a prompt from a screenshot"
        description="Saved a screenshot of a prompt? Turn it back into editable text, then save it to your library."
      />

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-muted">
        <Lock className="mt-0.5 size-4 shrink-0 text-success" />
        <p>
          <span className="font-medium text-fg">Runs entirely on your device.</span> Text recognition uses the open-source Tesseract engine
          inside your browser. Your screenshot is never uploaded. The first run loads about 7 MB of recognition data from this app.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">1. Screenshot</h2>
          {file && preview ? (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="flex max-h-[28rem] items-center justify-center bg-surface-2 p-3">
                <img src={preview} alt="Screenshot to extract text from" className="max-h-[26rem] max-w-full rounded-md object-contain" />
              </div>
              <div className="flex items-center gap-2 border-t border-line px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-xs text-muted">{file.name}</span>
                <Button size="sm" variant="ghost" icon={<ImageUp />} onClick={() => inputRef.current?.click()}>
                  Choose another
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                choose(e.dataTransfer.files[0])
              }}
              className={cn(
                'flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 text-center transition-colors',
                dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-2/40 hover:border-subtle',
              )}
            >
              <div className="flex size-12 items-center justify-center rounded-xl border border-line bg-surface text-muted">
                <ScanText className="size-5" />
              </div>
              <div>
                <div className="text-sm font-medium">Choose a screenshot</div>
                <div className="mt-1 text-[13px] text-muted">or drag it here, or paste with Ctrl+V / ⌘V</div>
              </div>
              <div className="text-xs text-subtle">Best results: clear, high-contrast text, cropped to the prompt</div>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="hidden"
            data-testid="ocr-file-input"
            onChange={(e) => {
              const next = e.target.files?.[0]
              e.target.value = ''
              choose(next)
            }}
          />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">2. Check and correct the text</h2>
            {confidence !== null && status === 'done' && text && (
              <Badge tone={confidence >= 80 ? 'success' : confidence >= 60 ? 'accent' : 'danger'}>
                {confidence >= 80 ? 'Clear read' : confidence >= 60 ? 'Check for mistakes' : 'Low confidence'} · {confidence}%
              </Badge>
            )}
          </div>

          {status === 'working' && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-[13px]">
                <Loader2 className="size-4 animate-spin text-accent" />
                <span className="font-medium">{progress?.status ?? 'Working'}…</span>
              </div>
              <Progress value={(progress?.progress ?? 0) * 100} />
            </div>
          )}

          {status === 'error' && error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-4 text-[13px]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <div className="flex-1">
                <p>{error}</p>
                <Button size="sm" variant="outline" className="mt-2" icon={<RotateCcw />} onClick={() => run()}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              status === 'idle' && !file
                ? 'The extracted prompt will appear here. You can also type or paste it directly.'
                : 'Extracted text…'
            }
            aria-label="Extracted prompt text"
            className="min-h-72 flex-1 font-mono text-[13px]"
          />

          {status === 'done' && text && (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-subtle">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" />
              OCR can confuse similar characters (like 0/O, 1/l, or :/;). Read it through once before saving.
            </p>
          )}

          <label className={cn('flex items-center gap-2 text-[13px] text-muted', !file && 'opacity-50')}>
            <input
              type="checkbox"
              checked={keepScreenshot}
              disabled={!file}
              onChange={(e) => setKeepScreenshot(e.target.checked)}
              className="size-4 rounded border-line-strong accent-[var(--pv-accent)]"
            />
            Attach the screenshot to the new creation as a reference
          </label>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Check />} disabled={!text.trim()} onClick={saveAsCreation}>
              Save as new creation
            </Button>
            <Button
              variant="outline"
              icon={<Copy />}
              disabled={!text.trim()}
              onClick={async () => {
                if (await copyText(text)) toast.success('Text copied')
              }}
            >
              Copy text
            </Button>
            {file && status !== 'working' && (
              <Button variant="ghost" icon={<RotateCcw />} onClick={() => run()}>
                Re-run
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
