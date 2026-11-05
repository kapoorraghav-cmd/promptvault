import { expect, test } from '@playwright/test'
import { openFresh } from './helpers'

const PROMPT = 'cinematic portrait of an astronaut in a sunflower field, golden hour, 85mm lens'

test('extracts a prompt from a screenshot on-device and saves it', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))

  // Render a "screenshot" of prompt text to use as the input image.
  await page.setContent(`<div style="width:900px;padding:32px;font:26px/1.5 Helvetica,Arial,sans-serif;background:#fff;color:#111">${PROMPT}</div>`)
  const screenshot = await page.locator('div').screenshot()

  await openFresh(page, '/extract')
  await page.getByTestId('ocr-file-input').setInputFiles({ name: 'prompt.png', mimeType: 'image/png', buffer: screenshot })
  const text = page.getByLabel('Extracted prompt text')
  await expect(text).toHaveValue(/astronaut in a sunflower field/, { timeout: 60_000 })

  await text.fill(`${await text.inputValue()} --ar 4:5`)
  await page.getByRole('button', { name: 'Save as new creation' }).click()
  await expect(page.getByRole('heading', { name: 'New creation' })).toBeVisible()
  await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue(/sunflower field.*--ar 4:5/s)
  await expect(page.getByLabel('Image description')).toHaveValue('Screenshot the prompt was extracted from')
  await page.getByLabel('Title', { exact: true }).fill('Astronaut')
  await page.getByRole('button', { name: 'Save creation' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Astronaut' })).toBeVisible()

  // Everything, including the OCR engine, must come from this app's own origin.
  const external = requests.filter((url) => !url.startsWith('http://localhost') && !url.startsWith('blob:') && !url.startsWith('data:') && url !== 'about:blank')
  expect(external).toEqual([])
})
