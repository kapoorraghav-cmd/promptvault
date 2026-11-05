import { toast } from 'sonner'
import { db } from './db'
import type { ExportScope } from './backup/export'
import type { Creation } from './types'
import { downloadBlob, slugify } from './utils'

export async function downloadMarkdown(creations: Creation[], heading: string, filenameHint: string) {
  const [{ creationsToMarkdown }, collections] = await Promise.all([import('./backup/markdown'), db.collections.toArray()])
  const markdown = creationsToMarkdown(creations, collections, heading)
  downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${slugify(filenameHint)}.md`)
  toast.success('Markdown file downloaded')
}

export async function downloadBackup(scope: ExportScope, includeFiles: boolean, filenameHint?: string) {
  try {
    const { exportBackup } = await import('./backup/export')
    const result = await exportBackup(scope, { includeFiles, filenameHint: filenameHint ? slugify(filenameHint) : undefined })
    downloadBlob(result.blob, result.filename)
    const files = result.counts.files ? ` and ${result.counts.files} ${result.counts.files === 1 ? 'file' : 'files'}` : ''
    toast.success(`Exported ${result.counts.creations} ${result.counts.creations === 1 ? 'item' : 'items'}${files}`)
    return result
  } catch (error) {
    console.error(error)
    toast.error('Export failed. Your browser may be low on memory — try exporting fewer items at a time.')
    return null
  }
}
