// Copies the OCR engine (Tesseract.js worker, WebAssembly core and English
// language data) from node_modules into public/ocr so the app can run text
// recognition without downloading anything from a third-party CDN.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'ocr')

const tesseractDir = dirname(require.resolve('tesseract.js/package.json'))
const coreDir = dirname(require.resolve('tesseract.js-core/package.json'))
const langDir = dirname(require.resolve('@tesseract.js-data/eng/package.json'))

const files = [
  [join(tesseractDir, 'dist', 'worker.min.js'), 'worker.min.js'],
  [join(coreDir, 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [join(coreDir, 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [join(coreDir, 'tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  [join(langDir, '4.0.0_best_int', 'eng.traineddata.gz'), 'eng.traineddata.gz'],
]

mkdirSync(outDir, { recursive: true })

for (const [source, name] of files) {
  const target = join(outDir, name)
  if (existsSync(target) && statSync(target).size === statSync(source).size) continue
  copyFileSync(source, target)
}

console.log(`OCR assets ready in public/ocr (${files.length} files)`)
