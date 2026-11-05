import { toast } from 'sonner'
import { markUsed } from './repo'
import type { Creation } from './types'

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy approach below.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

export async function copyPrompt(creation: Pick<Creation, 'id' | 'prompt'>, label = 'Prompt copied') {
  if (!creation.prompt.trim()) {
    toast.message('This item has no prompt text yet.')
    return
  }
  const ok = await copyText(creation.prompt)
  if (ok) {
    toast.success(label)
    await markUsed(creation.id)
  } else {
    toast.error('Couldn’t access the clipboard. Select the prompt text and copy it manually.')
  }
}
