import { expect, test } from '@playwright/test'
import { createCreation, openFresh, SAMPLE_IMAGE, SECOND_IMAGE } from './helpers'

test.describe('first run', () => {
  test('shows onboarding, loads sample data and removes it again', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('dialog', { name: 'Welcome to PromptVault' })).toBeVisible()
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Keep a backup' })).toBeVisible()
    await page.getByRole('button', { name: 'Explore with sample library' }).click()

    await expect(page.getByText('You’re exploring the sample library')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('link', { name: 'Creations 11' })).toBeVisible()

    await page.getByRole('button', { name: 'Remove sample data' }).click()
    await page.getByRole('button', { name: 'Remove samples' }).click()
    await expect(page.getByText('Start your library')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Creations 0' })).toBeVisible()
  })
})

test.describe('creations', () => {
  test.beforeEach(async ({ page }) => openFresh(page))

  test('adds a prompt with an image and keeps it after a reload', async ({ page }) => {
    await createCreation(page, {
      title: 'Aurora test',
      prompt: 'northern lights over a frozen lake, long exposure',
      model: 'Stable Diffusion XL',
      tags: ['aurora', 'night'],
      image: SAMPLE_IMAGE,
    })
    await expect(page.getByText('northern lights over a frozen lake, long exposure')).toBeVisible()
    await expect(page.getByRole('link', { name: '#aurora' })).toBeVisible()
    await expect(page.locator('img[alt="Aurora test"], img[alt=""]').first()).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Aurora test' })).toBeVisible()
    await page.goto('./#/library')
    await expect(page.getByRole('link', { name: 'Open Aurora test' })).toBeVisible()
  })

  test('saves an incomplete record and edits it later', async ({ page }) => {
    await page.goto('./#/new')
    await page.getByLabel('Title', { exact: true }).fill('Draft idea')
    await page.getByRole('button', { name: 'Save creation' }).click()
    await expect(page.getByText('No prompt saved yet.')).toBeVisible()

    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Prompt', { exact: true }).fill('a finished prompt')
    await page.getByLabel('Title', { exact: true }).fill('Finished idea')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Finished idea' })).toBeVisible()
    await expect(page.getByText('a finished prompt')).toBeVisible()
  })

  test('refuses to save a completely empty record', async ({ page }) => {
    await page.goto('./#/new')
    await page.getByRole('button', { name: 'Save creation' }).click()
    await expect(page.getByText('Add at least a title, a prompt or an image')).toBeVisible()
  })

  test('copies the prompt text', async ({ page, browserName }) => {
    await createCreation(page, { title: 'Copy me', prompt: 'prompt to copy 123' })
    await page.getByRole('button', { name: 'Copy prompt' }).click()
    await expect(page.getByText('Prompt copied')).toBeVisible()
    if (browserName === 'chromium') {
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('prompt to copy 123')
    }
    await page.goto('./#/')
    await expect(page.getByText('Copied just now')).toBeVisible()
  })

  test('deletes after confirmation', async ({ page }) => {
    await createCreation(page, { title: 'Delete me', prompt: 'temporary' })
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete…' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Delete me' })).toBeVisible()

    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete…' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page).toHaveURL(/#\/library$/)
    await expect(page.getByText('Your library is empty')).toBeVisible()
  })

  test('replaces and removes attached images', async ({ page }) => {
    await createCreation(page, { title: 'Images', prompt: 'p', image: SAMPLE_IMAGE })
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByTestId('asset-file-input').setInputFiles(SECOND_IMAGE)
    await expect(page.getByLabel('Alternative text')).toHaveCount(2)
    await page.getByRole('button', { name: 'Remove image' }).first().click()
    await expect(page.getByLabel('Alternative text')).toHaveCount(1)
    await expect(page.getByRole('main').getByText('dunes.jpg', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Images' })).toBeVisible()
    await page.getByRole('button', { name: 'Open full-size preview' }).click()
    const preview = page.getByRole('dialog')
    await expect(preview.getByRole('button', { name: 'Download original' })).toBeVisible()
    await expect(preview.getByText('dunes.jpg', { exact: true }).first()).toBeVisible()
  })

  test('rejects unsupported and disguised files', async ({ page }) => {
    await page.goto('./#/new')
    await page.getByTestId('asset-file-input').setInputFiles({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('this is not an image') })
    await expect(page.getByText('notes.png wasn’t added')).toBeVisible()
    await page.getByTestId('asset-file-input').setInputFiles({
      name: 'logo.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'),
    })
    await expect(page.getByText(/SVG files aren’t accepted/)).toBeVisible()
    await expect(page.getByLabel('Alternative text')).toHaveCount(0)
  })

  test('saves a video record as a link only', async ({ page }) => {
    await page.goto('./#/new?type=video')
    await page.getByLabel('Title', { exact: true }).fill('Drone shot')
    await page.getByLabel('Prompt', { exact: true }).fill('slow aerial push over cliffs')
    await page.getByLabel(/^Video URL/).fill('javascript:alert(1)')
    await page.getByRole('button', { name: 'Save creation' }).click()
    await expect(page.getByText('Enter a full web address starting with https://').first()).toBeVisible()
    await page.getByLabel(/^Video URL/).fill('https://example.com/drone')
    await page.getByLabel(/^Duration/).fill('0:12')
    await page.getByTestId('asset-file-input').setInputFiles(SAMPLE_IMAGE)
    await page.getByRole('button', { name: 'Save creation' }).click()
    await expect(page.getByRole('link', { name: 'Open video' })).toHaveAttribute('href', 'https://example.com/drone')
    await expect(page.getByText('Video · 0:12')).toBeVisible()
    await expect(page.getByText('Thumbnail', { exact: true })).toBeVisible()
  })
})

test.describe('organisation', () => {
  test.beforeEach(async ({ page }) => openFresh(page))

  test('searches and filters the library', async ({ page }) => {
    await createCreation(page, { title: 'Snow leopard', prompt: 'snow leopard on a ridge at dawn', model: 'Flux', tags: ['wildlife'] })
    await createCreation(page, { title: 'Perfume bottle', prompt: 'amber glass bottle on travertine', model: 'SDXL', tags: ['product'] })
    await page.goto('./#/library')
    await expect(page.getByText('2 results')).toBeVisible()

    const search = page.getByLabel('Search your library')
    await search.fill('travertine')
    await expect(page.getByText('1 result')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open Perfume bottle' })).toBeVisible()

    await search.fill('wildlife')
    await expect(page.getByRole('link', { name: 'Open Snow leopard' })).toBeVisible()
    await search.fill('flux')
    await expect(page.getByRole('link', { name: 'Open Snow leopard' })).toBeVisible()
    await search.fill('nothing-matches-this')
    await expect(page.getByText('Nothing matches')).toBeVisible()
    await search.fill('')

    await page.getByRole('button', { name: 'Video' }).click()
    await expect(page.getByText('0 results')).toBeVisible()
    await page.getByRole('button', { name: 'All', exact: true }).click()

    await page.getByRole('link', { name: 'Open Snow leopard' }).locator('..').getByRole('button', { name: 'Add to favourites' }).click()
    await page.getByRole('button', { name: 'Favourites', exact: true }).click()
    await expect(page.getByText('1 result')).toBeVisible()
    await page.getByRole('button', { name: 'Favourites', exact: true }).click()

    await page.getByRole('button', { name: 'Sort' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Title A–Z' }).click()
    await page.keyboard.press('Escape')
    const titles = page.getByTestId('creations-grid').locator('h3')
    await expect(titles.first()).toHaveText('Perfume bottle')

    await page.getByRole('radio', { name: 'List view' }).click()
    await expect(page.getByTestId('creations-list')).toBeVisible()
  })

  test('creates a collection, adds items and browses it', async ({ page }) => {
    await createCreation(page, { title: 'Sunset ad', prompt: 'warm sunset banner' })
    await page.goto('./#/collections')
    await page.getByRole('main').getByRole('button', { name: 'New collection' }).first().click()
    await page.getByLabel('Name', { exact: true }).fill('Marketing Creatives')
    await page.getByRole('button', { name: 'Create collection' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Marketing Creatives' })).toBeVisible()
    await expect(page.getByText('This collection is empty')).toBeVisible()

    await page.getByRole('button', { name: 'Add items' }).click()
    await page.getByRole('checkbox', { name: /Sunset ad/ }).click()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Open Sunset ad' })).toBeVisible()

    await page.getByRole('button', { name: 'Collection actions' }).click()
    await page.getByRole('menuitem', { name: 'Rename or edit' }).click()
    await page.getByLabel('Name', { exact: true }).fill('Ads')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Ads' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByRole('button', { name: 'Collection actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete collection…' }).click()
    await page.getByRole('button', { name: 'Delete collection' }).click()
    await expect(page).toHaveURL(/#\/collections$/)
    await page.goto('./#/library')
    await expect(page.getByRole('link', { name: 'Open Sunset ad' })).toBeVisible()
  })

  test('duplicates a prompt as a variation and compares versions', async ({ page }) => {
    await createCreation(page, { title: 'Mountains', prompt: 'layered mountains at dawn, pastel' })
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
    await expect(page.getByText('Variation of “Mountains”')).toBeVisible()
    await page.getByLabel('Prompt', { exact: true }).fill('layered mountains at dusk, pastel')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Mountains (variation)' })).toBeVisible()

    await page.getByRole('link', { name: 'Compare with Mountains' }).click()
    await expect(page.getByRole('heading', { name: 'Compare versions' })).toBeVisible()
    await expect(page.locator('.text-success', { hasText: 'dawn' })).toBeVisible()
    await expect(page.locator('.text-danger', { hasText: 'dusk' })).toBeVisible()

    await page.goto('./#/library?q=layered')
    await expect(page.getByText('2 results')).toBeVisible()
  })
})
