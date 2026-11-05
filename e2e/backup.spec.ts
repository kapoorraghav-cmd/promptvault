import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createCreation, openFresh, SAMPLE_IMAGE } from './helpers'

test.describe('backup and restore', () => {
  test.beforeEach(async ({ page }) => openFresh(page))

  test('exports a full backup, clears everything and restores it', async ({ page }) => {
    await createCreation(page, { title: 'Keep me safe', prompt: 'backup this prompt', tags: ['backup'], image: SAMPLE_IMAGE })

    await page.goto('./#/backup')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download backup' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^promptvault-backup-\d{4}-\d{2}-\d{2}\.zip$/)
    const backupPath = await download.path()
    expect((await readFile(backupPath)).subarray(0, 2).toString()).toBe('PK')

    await page.goto('./#/settings')
    await page.getByRole('button', { name: 'Clear all data…' }).click()
    const confirm = page.getByRole('button', { name: 'Delete everything' })
    await expect(confirm).toBeDisabled()
    await page.getByLabel(/Type DELETE to confirm/).fill('DELETE')
    await confirm.click()
    await expect(page.getByText('All data cleared')).toBeVisible()
    await page.goto('./#/library')
    await expect(page.getByText('Your library is empty')).toBeVisible()

    await page.goto('./#/backup')
    await page.getByTestId('import-file-input').setInputFiles({
      name: 'promptvault-backup.zip',
      mimeType: 'application/zip',
      buffer: await readFile(backupPath),
    })
    await expect(page.getByTestId('import-preview')).toContainText('1 item, 0 collections and 1 image')
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByTestId('import-summary')).toContainText('1 item added')

    await page.reload()
    await page.goto('./#/library')
    await page.getByRole('link', { name: 'Open Keep me safe' }).click()
    await expect(page.getByText('backup this prompt')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open full-size preview' })).toBeVisible()
  })

  test('warns about duplicates before importing again', async ({ page }) => {
    await createCreation(page, { title: 'Twice', prompt: 'p' })
    await page.goto('./#/backup')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download JSON' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.json$/)

    await page.getByTestId('import-file-input').setInputFiles(await download.path())
    await expect(page.getByText('1 item is already in your library.')).toBeVisible()
    await page.getByLabel('Keep both').check()
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByTestId('import-summary')).toContainText('1 item added')
    await page.goto('./#/library')
    await expect(page.getByText('2 results')).toBeVisible()
  })

  test('rejects invalid and corrupted files without changing anything', async ({ page }) => {
    await page.goto('./#/backup')
    const input = page.getByTestId('import-file-input')

    await input.setInputFiles({ name: 'random.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":"world"}') })
    await expect(page.getByRole('alert')).toContainText('isn’t a PromptVault backup')

    await input.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"format": "promptvault-backup", ') })
    await expect(page.getByRole('alert')).toContainText('isn’t valid JSON')

    await input.setInputFiles({ name: 'broken.zip', mimeType: 'application/zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 9, 9, 9]) })
    await expect(page.getByRole('alert')).toContainText('damaged')

    await input.setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: await readFile(SAMPLE_IMAGE) })
    await expect(page.getByRole('alert')).toContainText('doesn’t look like a PromptVault backup')

    await page.goto('./#/library')
    await expect(page.getByText('Your library is empty')).toBeVisible()
  })

  test('exports prompts as Markdown', async ({ page }) => {
    await createCreation(page, { title: 'Markdown me', prompt: 'markdown prompt text', model: 'Flux' })
    await page.goto('./#/backup')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Markdown' }).click()
    const download = await downloadPromise
    const text = await readFile(await download.path(), 'utf8')
    expect(text).toContain('## Markdown me')
    expect(text).toContain('markdown prompt text')
    expect(text).toContain('**Model:** Flux')
  })
})
