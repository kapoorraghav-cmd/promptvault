// Captures real screenshots of the running app (with the sample library
// loaded) for the README and for visual review.
//
// Usage: APP_URL=http://localhost:4173/ OUT_DIR=docs/screenshots node scripts/capture-screenshots.mjs
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173/'
const OUT_DIR = process.env.OUT_DIR ?? 'docs/screenshots'
const ONLY = process.env.ONLY?.split(',')

mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch()

async function setup(page, theme = 'dark') {
  await page.goto(APP_URL)
  await page.evaluate((t) => {
    localStorage.setItem('promptvault:preferences', JSON.stringify({ state: { theme: t, defaultView: 'grid' }, version: 1 }))
  }, theme)
  await page.reload()
  await page.getByRole('button', { name: 'Next' }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Explore with sample library' }).click()
  await page.getByText('You’re exploring the sample library').waitFor()
  await page.waitForTimeout(600)
}

async function shot(page, name, path, { wait = 700, fullPage = false, before } = {}) {
  if (ONLY && !ONLY.includes(name)) return
  await page.goto(`${APP_URL}#${path}`)
  await page.waitForLoadState('networkidle')
  if (before) await before(page)
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' })
  await page.waitForTimeout(wait)
  await page.screenshot({ path: join(OUT_DIR, `${name}.jpg`), type: 'jpeg', quality: 86, fullPage })
  console.log(`captured ${name}`)
}

// Desktop, dark theme
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  await setup(page)
  await shot(page, 'dashboard', '/')
  await shot(page, 'library-grid', '/library')
  await shot(page, 'library-list', '/library?view=list')
  await shot(page, 'detail', '/c/sample-aurora')
  await shot(page, 'detail-video', '/c/sample-synthwave')
  await shot(page, 'edit', '/c/sample-aurora/edit')
  await shot(page, 'collections', '/collections')
  await shot(page, 'compare', '/compare?a=sample-dawn&b=sample-dusk')
  await shot(page, 'extract', '/extract')
  await shot(page, 'backup', '/backup')
  await shot(page, 'settings', '/settings')
  await context.close()
}

// Desktop, light theme
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  await setup(page, 'light')
  await shot(page, 'light-dashboard', '/')
  await shot(page, 'light-library', '/library')
  await context.close()
}

// Onboarding (fresh profile)
if (!ONLY || ONLY.includes('onboarding')) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Next' }).waitFor()
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT_DIR, 'onboarding.jpg'), type: 'jpeg', quality: 86 })
  console.log('captured onboarding')
  await context.close()
}

// Mobile
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await setup(page)
  await shot(page, 'mobile-dashboard', '/')
  await shot(page, 'mobile-library', '/library')
  await shot(page, 'mobile-detail', '/c/sample-neon')
  await context.close()
}

// Tablet
{
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true })
  const page = await context.newPage()
  await setup(page)
  await shot(page, 'tablet-library', '/library')
  await context.close()
}

await browser.close()
