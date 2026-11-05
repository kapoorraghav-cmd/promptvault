import type { Collection, Creation } from '../types'
import { CONTENT_TYPE_LABELS } from '../labels'
import { formatDate, formatDuration } from '../utils'

/** Wraps text in a code fence long enough that the text can't break out of it. */
function fence(text: string, lang = 'text') {
  const longestRun = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const ticks = '`'.repeat(longestRun + 1)
  return `${ticks}${lang}\n${text}\n${ticks}`
}

function escapeInline(text: string) {
  return text.replace(/([\\`*_[\]<>#|])/g, '\\$1').replace(/\n+/g, ' ')
}

export function creationToMarkdown(creation: Creation, collections: Collection[] = []): string {
  const lines: string[] = []
  lines.push(`## ${escapeInline(creation.title || 'Untitled')}`)
  lines.push('')

  const collectionNames = creation.collectionIds
    .map((id) => collections.find((c) => c.id === id)?.name)
    .filter(Boolean) as string[]

  const facts: [string, string][] = [
    ['Type', CONTENT_TYPE_LABELS[creation.contentType]],
    ['Model', creation.model],
    ['Category', creation.category],
    ['Tags', creation.tags.join(', ')],
    ['Collections', collectionNames.join(', ')],
    ['Aspect ratio', creation.aspectRatio],
    ['Resolution', creation.resolution],
    ['Seed', creation.seed],
    ['Created', formatDate(creation.createdOn)],
    ['Video URL', creation.video?.url ?? ''],
    ['Duration', formatDuration(creation.video?.durationSeconds)],
    ['Source', creation.sourceUrl],
    ['Variation of', creation.parentTitle ?? ''],
  ]
  for (const [label, value] of facts) {
    if (value) lines.push(`- **${label}:** ${escapeInline(value)}`)
  }
  lines.push('')

  lines.push('### Prompt', '', fence(creation.prompt || ''), '')
  if (creation.negativePrompt) lines.push('### Negative prompt', '', fence(creation.negativePrompt), '')
  if (creation.settings) lines.push('### Settings', '', fence(creation.settings), '')
  if (creation.description) lines.push('### Notes', '', creation.description.trim(), '')
  return lines.join('\n')
}

export function creationsToMarkdown(creations: Creation[], collections: Collection[], heading = 'PromptVault export'): string {
  const header = [
    `# ${escapeInline(heading)}`,
    '',
    `Exported ${formatDate(Date.now())} · ${creations.length} ${creations.length === 1 ? 'item' : 'items'}`,
    '',
  ]
  const body = creations.map((c) => creationToMarkdown(c, collections)).join('\n---\n\n')
  return `${header.join('\n')}\n${body}`
}
