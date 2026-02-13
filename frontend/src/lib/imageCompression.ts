/**
 * Client-side image compression for uploads (e.g. profile photos).
 * Resizes to max dimensions and compresses as JPEG so payload fits in Firestore.
 */

const DEFAULT_MAX_SIZE = 512
const TARGET_MAX_BYTES = 380_000 // ~380 KB base64 so under Firestore doc limit
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4, 0.3]

export interface CompressImageOptions {
  /** Max width or height in pixels (default 512) */
  maxSize?: number
  /** Target max size in bytes for output base64 (default 380 KB) */
  maxBytes?: number
}

function canvasToDataUrl(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to compress image'))
          return
        }
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read blob'))
        reader.readAsDataURL(blob)
      },
      'image/jpeg',
      quality
    )
  })
}

/**
 * Compress an image file: resize and re-encode as JPEG, then return as data URL.
 * Accepts any image type; output is always JPEG for smaller size.
 * Reduces quality as needed so result stays under maxBytes.
 */
export function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE
  const maxBytes = options.maxBytes ?? TARGET_MAX_BYTES

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      const scale = Math.min(1, maxSize / Math.max(w, h))
      const width = Math.round(w * scale)
      const height = Math.round(h * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      for (const quality of QUALITY_STEPS) {
        try {
          const dataUrl = await canvasToDataUrl(canvas, quality)
          if (dataUrl.length <= maxBytes) {
            resolve(dataUrl)
            return
          }
        } catch (e) {
          reject(e)
          return
        }
      }
      // Last attempt at lowest quality
      try {
        const dataUrl = await canvasToDataUrl(canvas, 0.25)
        resolve(dataUrl)
      } catch (e) {
        reject(e)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}
