import type { Worker } from 'tesseract.js'

export interface OcrProgress {
  status: string
  progress: number
}

export interface OcrResult {
  text: string
  confidence: number
}

/** Location of the locally bundled OCR engine (see scripts/copy-ocr-assets.mjs). */
function ocrBase(): string {
  return new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href
}

const STATUS_LABELS: Record<string, string> = {
  'loading tesseract core': 'Loading text recognition engine',
  'initializing tesseract': 'Starting engine',
  'loading language traineddata': 'Loading English language data',
  'initializing api': 'Preparing',
  'recognizing text': 'Reading text',
}

let workerPromise: Promise<Worker> | null = null
let progressListener: ((p: OcrProgress) => void) | null = null

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import('tesseract.js')
      const base = ocrBase()
      return createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: `${base}worker.min.js`,
        corePath: base,
        langPath: base,
        workerBlobURL: false,
        cacheMethod: 'none',
        logger: (message: { status: string; progress: number }) => {
          progressListener?.({
            status: STATUS_LABELS[message.status] ?? 'Working',
            progress: message.progress,
          })
        },
      })
    })()
    workerPromise.catch(() => {
      workerPromise = null
    })
  }
  return workerPromise
}

/** Tidies common OCR artefacts while keeping the user's line breaks. */
export function cleanOcrText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Extracts text from an image entirely on this device using Tesseract.
 * No image or text is sent anywhere.
 */
export async function extractText(image: Blob, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
  progressListener = onProgress ?? null
  try {
    const worker = await getWorker()
    const { data } = await worker.recognize(image)
    return { text: cleanOcrText(data.text ?? ''), confidence: Math.round(data.confidence ?? 0) }
  } finally {
    progressListener = null
  }
}

export async function terminateOcr() {
  if (!workerPromise) return
  const worker = await workerPromise.catch(() => null)
  workerPromise = null
  await worker?.terminate()
}
