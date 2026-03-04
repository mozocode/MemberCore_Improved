/**
 * Type declarations for modules that may not ship with types or need augmentation.
 */
declare module '@expo/vector-icons' {
  import type { ComponentType } from 'react'
  export const Feather: ComponentType<{
    name: string
    size?: number
    color?: string
    style?: unknown
  }> & {
    glyphMap: Record<string, number>
    getRawGlyphMap: () => Record<string, number>
    getFontFamily: () => string
    getFontStyle: () => { fontFamily: string; fontWeight: string }
  }
}
