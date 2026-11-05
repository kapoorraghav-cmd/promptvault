// Generates PNG app icons from public/favicon.svg and the GitHub social
// preview image (which embeds a real screenshot from docs/screenshots).
//
// Usage: node scripts/generate-brand-assets.mjs
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8')

const icons = [
  ['favicon-32.png', 32, 0],
  ['apple-touch-icon.png', 180, 0],
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
]

const browser = await chromium.launch()
const page = await browser.newPage()

for (const [name, size] of icons) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  )
  await page.screenshot({ path: join(root, 'public', name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
  console.log(`icon ${name}`)
}

const screenshot = join(root, 'docs', 'screenshots', 'library-grid.jpg')
if (existsSync(screenshot)) {
  const shot = readFileSync(screenshot).toString('base64')
  await page.setViewportSize({ width: 1280, height: 640 })
  await page.setContent(`<!doctype html>
  <html><head><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: 1280px; height: 640px; overflow: hidden; background: #0b0b0d; color: #ededef;
      font-family: 'Inter', -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; position: relative; }
    .grid { position: absolute; inset: 0; background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0);
      background-size: 22px 22px; mask-image: linear-gradient(to right, black 30%, transparent 70%); }
    .glow { position: absolute; width: 560px; height: 560px; left: -160px; top: -200px; border-radius: 50%;
      background: radial-gradient(circle, rgba(242,169,59,0.18), transparent 65%); }
    .copy { position: absolute; left: 72px; top: 0; bottom: 0; width: 470px; display: flex; flex-direction: column; justify-content: center; }
    .brand { display: flex; align-items: center; gap: 16px; }
    .brand svg { width: 64px; height: 64px; }
    .name { font-size: 40px; font-weight: 700; letter-spacing: -1px; }
    h1 { margin-top: 36px; font-size: 46px; line-height: 1.08; font-weight: 700; letter-spacing: -1.6px; }
    h1 span { color: #f2a93b; }
    p { margin-top: 20px; font-size: 20px; line-height: 1.5; color: #a1a1aa; }
    .tags { margin-top: 28px; display: flex; gap: 10px; flex-wrap: wrap; }
    .tag { font-size: 15px; padding: 7px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); color: #d4d4d8; }
    .window { position: absolute; left: 600px; top: 74px; width: 900px; height: 562px; border-radius: 16px; overflow: hidden;
      border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 40px 80px -20px rgba(0,0,0,0.7); background: #111113; }
    .window img { width: 100%; display: block; }
  </style></head><body>
    <div class="grid"></div><div class="glow"></div>
    <div class="copy">
      <div class="brand">${svg}<span class="name">PromptVault</span></div>
      <h1>Your creative<br/>memory for <span>AI</span>.</h1>
      <p>Save, organise, search and reuse your prompts and creative assets. Free, open source and private by design.</p>
      <div class="tags"><span class="tag">Local-first</span><span class="tag">No account</span><span class="tag">Open source</span></div>
    </div>
    <div class="window"><img src="data:image/jpeg;base64,${shot}"/></div>
  </body></html>`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(root, 'docs', 'social-preview.png') })
  console.log('social preview docs/social-preview.png')
} else {
  console.log('skipping social preview: capture screenshots first')
}

await browser.close()
