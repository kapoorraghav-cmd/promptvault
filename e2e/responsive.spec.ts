import { expect, test } from '@playwright/test'

test('mobile: navigation, sample library and creation detail work on a phone', async ({ page }) => {
  await page.goto('./')
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Explore with sample library' }).click()
  await expect(page.getByText('You’re exploring the sample library')).toBeVisible({ timeout: 30_000 })

  // No horizontal scrolling on the main pages.
  for (const path of ['/', '/library', '/collections', '/backup', '/settings', '/c/sample-aurora']) {
    await page.goto(`./#${path}`)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1)
  }

  await page.goto('./#/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Collections' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()

  await page.goto('./#/c/sample-aurora')
  await expect(page.getByRole('heading', { level: 1, name: 'Aurora over a frozen lake' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy prompt' })).toBeVisible()
})
