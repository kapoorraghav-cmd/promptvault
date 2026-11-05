import { diffWords } from 'diff'
import { ArrowLeftRight, GitCompare } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AssetImage } from '../components/creations/media'
import { Select } from '../components/ui/input'
import { EmptyState, PageHeader } from '../components/ui/misc'
import { useCreations } from '../lib/hooks'
import { CONTENT_TYPE_LABELS } from '../lib/labels'
import type { Creation } from '../lib/types'
import { cn, formatDate, formatDuration } from '../lib/utils'

function DiffText({ before, after, side }: { before: string; after: string; side: 'a' | 'b' }) {
  const parts = useMemo(() => diffWords(before, after), [before, after])
  if (!before && !after) return <span className="text-subtle italic">Empty</span>
  return (
    <>
      {parts.map((part, i) => {
        if (part.added && side === 'a') return null
        if (part.removed && side === 'b') return null
        return (
          <span
            key={i}
            className={cn(
              part.added && 'rounded-sm bg-success-soft text-success',
              part.removed && 'rounded-sm bg-danger-soft text-danger line-through decoration-danger/50',
            )}
          >
            {part.value}
          </span>
        )
      })}
    </>
  )
}

const FIELDS: { label: string; get: (c: Creation) => string }[] = [
  { label: 'Model', get: (c) => c.model },
  { label: 'Type', get: (c) => CONTENT_TYPE_LABELS[c.contentType] },
  { label: 'Aspect ratio', get: (c) => c.aspectRatio },
  { label: 'Resolution', get: (c) => c.resolution },
  { label: 'Seed', get: (c) => c.seed },
  { label: 'Duration', get: (c) => formatDuration(c.video?.durationSeconds) },
  { label: 'Created', get: (c) => formatDate(c.createdOn) },
  { label: 'Tags', get: (c) => c.tags.map((t) => `#${t}`).join(' ') },
]

export function ComparePage() {
  const [params, setParams] = useSearchParams()
  const creations = useCreations()
  const a = creations?.find((c) => c.id === params.get('a'))
  const b = creations?.find((c) => c.id === params.get('b'))

  const options = useMemo(
    () => [...(creations ?? [])].sort((x, y) => (x.title || 'Untitled').localeCompare(y.title || 'Untitled')),
    [creations],
  )

  function pick(side: 'a' | 'b', id: string) {
    const next = new URLSearchParams(params)
    next.set(side, id)
    setParams(next, { replace: true })
  }

  if (!creations) return null

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <PageHeader
        title="Compare versions"
        description="See exactly what changed between two prompts. Added words are green, removed words are red."
        actions={
          a &&
          b && (
            <button
              type="button"
              onClick={() => setParams({ a: b.id, b: a.id }, { replace: true })}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong px-3.5 text-sm font-medium hover:bg-surface-2"
            >
              <ArrowLeftRight className="size-4" /> Swap sides
            </button>
          )
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {(['a', 'b'] as const).map((side) => {
          const current = side === 'a' ? a : b
          return (
            <div key={side} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide text-subtle uppercase" htmlFor={`compare-${side}`}>
                {side === 'a' ? 'Version A' : 'Version B'}
              </label>
              <Select id={`compare-${side}`} value={current?.id ?? ''} onChange={(e) => pick(side, e.target.value)}>
                <option value="" disabled>
                  Choose an item…
                </option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || 'Untitled'}
                    {c.parentId ? ' (variation)' : ''}
                  </option>
                ))}
              </Select>
            </div>
          )
        })}
      </div>

      {!a || !b ? (
        <EmptyState
          icon={<GitCompare />}
          title="Pick two items to compare"
          description="Tip: open any item and choose “Duplicate as variation” to create a version you can compare against."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            {[a, b].map((c, i) => (
              <Link
                key={`${c.id}-${i}`}
                to={`/c/${c.id}`}
                className="group overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong"
              >
                {c.coverAssetId ? (
                  <AssetImage assetId={c.coverAssetId} alt={c.title} className="aspect-[16/9] w-full" />
                ) : (
                  <div className="flex aspect-[16/9] items-center justify-center bg-surface-2 text-sm text-subtle">No image</div>
                )}
                <div className="flex items-center gap-2 px-4 py-3">
                  <span className="flex size-5 items-center justify-center rounded bg-surface-3 text-[11px] font-semibold text-muted">
                    {i === 0 ? 'A' : 'B'}
                  </span>
                  <span className="truncate text-sm font-medium group-hover:underline">{c.title || 'Untitled'}</span>
                </div>
              </Link>
            ))}
          </div>

          <section className="overflow-hidden rounded-xl border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-2.5 text-xs font-medium tracking-wide text-subtle uppercase">Prompt</h2>
            <div className="grid divide-line md:grid-cols-2 md:divide-x max-md:divide-y">
              <p className="px-4 py-3.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
                <DiffText before={a.prompt} after={b.prompt} side="a" />
              </p>
              <p className="px-4 py-3.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
                <DiffText before={a.prompt} after={b.prompt} side="b" />
              </p>
            </div>
          </section>

          {(a.negativePrompt || b.negativePrompt) && (
            <section className="overflow-hidden rounded-xl border border-line bg-surface">
              <h2 className="border-b border-line px-4 py-2.5 text-xs font-medium tracking-wide text-subtle uppercase">Negative prompt</h2>
              <div className="grid divide-line md:grid-cols-2 md:divide-x max-md:divide-y">
                <p className="px-4 py-3.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
                  <DiffText before={a.negativePrompt} after={b.negativePrompt} side="a" />
                </p>
                <p className="px-4 py-3.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
                  <DiffText before={a.negativePrompt} after={b.negativePrompt} side="b" />
                </p>
              </div>
            </section>
          )}

          {(a.settings || b.settings) && (
            <section className="overflow-hidden rounded-xl border border-line bg-surface">
              <h2 className="border-b border-line px-4 py-2.5 text-xs font-medium tracking-wide text-subtle uppercase">Settings</h2>
              <div className="grid divide-line md:grid-cols-2 md:divide-x max-md:divide-y">
                <p className="px-4 py-3.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
                  <DiffText before={a.settings} after={b.settings} side="a" />
                </p>
                <p className="px-4 py-3.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
                  <DiffText before={a.settings} after={b.settings} side="b" />
                </p>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-2.5 text-xs font-medium tracking-wide text-subtle uppercase">Details</h2>
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-line">
                {FIELDS.map((field) => {
                  const va = field.get(a)
                  const vb = field.get(b)
                  const changed = va !== vb
                  return (
                    <tr key={field.label}>
                      <th scope="row" className="w-32 px-4 py-2 text-left font-normal text-muted">
                        {field.label}
                      </th>
                      <td className={cn('px-4 py-2', changed && 'text-fg')}>{va || <span className="text-subtle">—</span>}</td>
                      <td className={cn('px-4 py-2', changed ? 'font-medium text-accent' : '')}>{vb || <span className="text-subtle">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  )
}
