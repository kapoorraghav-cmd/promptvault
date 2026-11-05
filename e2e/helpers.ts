import { expect, type Page } from '@playwright/test'
import { join } from 'node:path'

export const SAMPLE_IMAGE = join(import.meta.dirname, '..', 'public', 'samples', 'aurora.jpg')
export const SECOND_IMAGE = join(import.meta.dirname, '..', 'public', 'samples', 'dunes.jpg')

/** Opens the app on a fresh profile and skips the welcome tour. */
export async function openFresh(page: Page, path = '/') {
  await page.goto(`./#${path}`)
  await page.getByRole('button', { name: 'Skip tour' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

export async function createCreation(
  page: Page,
  { title, prompt, model, tags = [], image }: { title: string; prompt: string; model?: string; tags?: string[]; image?: string },
) {
  await page.goto('./#/new')
  await page.getByLabel('Title', { exact: true }).fill(title)
  await page.getByLabel('Prompt', { exact: true }).fill(prompt)
  if (model) {
    await page.getByLabel('AI tool or model').fill(model)
    // Close the browser's native autocomplete suggestions for the field.
    await page.getByLabel('AI tool or model').press('Escape')
  }
  for (const tag of tags) {
    await page.getByLabel(/^Tags/).fill(tag)
    await page.getByLabel(/^Tags/).press('Enter')
  }
  if (image) {
    await page.getByTestId('asset-file-input').setInputFiles(image)
    await expect(page.getByLabel('Alternative text')).toBeVisible()
  }
  await page.getByRole('button', { name: 'Save creation' }).click()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}
