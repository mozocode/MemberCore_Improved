export interface CompressImageOptions {
  maxSize?: number
  maxBytes?: number
}

/** Read any file as a data URL (e.g. for PDFs). No compression. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Prepare a document or image for upload: compress images, pass through PDFs as data URL.
 * Use for required-document and org-document uploads so all images are compressed.
 */
export async function prepareDocumentOrImageForUpload(file: File): Promise<string> {
  if (file.type.startsWith('image/')) {
    return compressImageFile(file, { maxSize: 1200, maxBytes: 700_000 })
  }
  return readFileAsDataUrl(file)
}

/**
 * Compress an image file for upload (avatars, documents, templates).
 * Alias for compressCoverImage with options object; maxBytes is a hint (quality is reduced if needed).
 */
export async function compressImageFile(
  file: File,
  options?: CompressImageOptions
): Promise<string> {
  const maxSize = options?.maxSize ?? 1200
  let result = await compressCoverImage(file, maxSize, 0.8)
  const maxBytes = options?.maxBytes
  if (maxBytes && result.length > maxBytes) {
    for (const q of [0.6, 0.5, 0.4, 0.3]) {
      result = await compressCoverImage(file, Math.max(800, Math.round(maxSize * 0.8)), q)
      if (result.length <= maxBytes) break
    }
  }
  return result
}

/**
 * Compress cover/banner images for events.
 * Preserves aspect ratio; scales so the longest side is at most maxSize.
 * PNG transparency preserved; JPEGs compressed with quality.
 *
 * @param file - The uploaded image file
 * @param maxSize - Maximum dimension in pixels (default: 1200)
 * @param quality - JPEG quality 0–1 (default: 0.8)
 * @returns Base64 encoded compressed image
 */
export function compressCoverImage(
  file: File,
  maxSize: number = 1200,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width)
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height)
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas not available'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const outputQuality = file.type === 'image/png' ? 1 : quality

        try {
          resolve(canvas.toDataURL(outputFormat, outputQuality))
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = (e.target?.result as string) ?? ''
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
