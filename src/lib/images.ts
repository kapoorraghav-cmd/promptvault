import { formatBytes } from './utils'

export const MAX_IMAGE_BYTES = 40 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif'
const THUMB_MAX_EDGE = 720

export type ImageCheck = { ok: true; mimeType: string } | { ok: false; reason: string }

/**
 * Identifies the real file type from its first bytes rather than trusting the
 * file name, so a renamed file can't masquerade as an image.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const b = bytes
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif'
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

function looksLikeHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const brand = String.fromCharCode(...bytes.slice(4, 12))
  return /^ftyp(heic|heix|hevc|mif1|msf1|heis)/.test(brand)
}

async function readHead(file: Blob, length = 32): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, length).arrayBuffer())
}

export async function checkImageFile(file: File | Blob): Promise<ImageCheck> {
  if (file.size === 0) return { ok: false, reason: 'This file is empty.' }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      reason: `This image is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_IMAGE_BYTES)} per image.`,
    }
  }
  const head = await readHead(file)
  const type = sniffImageType(head)
  if (type) return { ok: true, mimeType: type }
  if (looksLikeHeic(head)) {
    return { ok: false, reason: 'HEIC photos aren’t supported by most browsers. Please convert it to JPG or PNG first.' }
  }
  const name = 'name' in file ? (file as File).name : ''
  if (/\.svg$/i.test(name) || file.type === 'image/svg+xml') {
    return { ok: false, reason: 'SVG files aren’t accepted because they can contain scripts. Please use PNG, JPG or WebP.' }
  }
  return { ok: false, reason: 'Unsupported file type. Please use JPG, PNG, WebP or GIF.' }
}

export interface ProcessedImage {
  mimeType: string
  width: number | null
  height: number | null
  thumb: Blob | null
}

async function decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality))
}

/**
 * Reads dimensions and builds a small thumbnail for fast grids.
 * The original blob is never modified. Throws if the image can't be decoded.
 */
export async function processImage(blob: Blob, mimeType: string): Promise<ProcessedImage> {
  const decoded = await decode(blob)
  try {
    const { width, height } = decoded
    if (!width || !height) throw new Error('Image has no dimensions')

    // GIFs keep their original as the thumbnail so they stay animated.
    if (mimeType === 'image/gif' || typeof document === 'undefined') {
      return { mimeType, width, height, thumb: null }
    }

    const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(width, height))
    if (scale === 1 && blob.size < 400 * 1024) {
      return { mimeType, width, height, thumb: null }
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return { mimeType, width, height, thumb: null }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)

    let thumb = await canvasToBlob(canvas, 'image/webp', 0.82)
    if (!thumb || thumb.type !== 'image/webp') thumb = await canvasToBlob(canvas, 'image/jpeg', 0.85)
    return { mimeType, width, height, thumb }
  } finally {
    decoded.close()
  }
}

export function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return 'bin'
  }
}
