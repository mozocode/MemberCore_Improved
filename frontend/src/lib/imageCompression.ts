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
