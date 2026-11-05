import { X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { normaliseTags } from '../../lib/utils'

export function TagInput({
  id,
  value,
  onChange,
  suggestions = [],
}: {
  id?: string
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  function commit(raw: string) {
    const parts = raw.split(/[,\n]/)
    const next = normaliseTags([...value, ...parts])
    if (next.length !== value.length) onChange(next)
    setText('')
  }

  return (
    <div
      className="flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-accent/70 focus-within:ring-3 focus-within:ring-accent/15"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <span key={tag} className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-3 pr-1 pl-2 text-xs text-fg">
          #{tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            onClick={(e) => {
              e.stopPropagation()
              onChange(value.filter((t) => t !== tag))
            }}
            className="inline-flex size-4 items-center justify-center rounded text-subtle hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={text}
        list={listId}
        onChange={(e) => {
          const next = e.target.value
          if (/[,\n]/.test(next)) commit(next)
          else setText(next)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (text.trim()) commit(text)
          } else if (e.key === 'Backspace' && !text && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => text.trim() && commit(text)}
        placeholder={value.length ? '' : 'Add tags, press Enter'}
        className="h-6 min-w-24 flex-1 bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.includes(s))
          .slice(0, 50)
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  )
}
