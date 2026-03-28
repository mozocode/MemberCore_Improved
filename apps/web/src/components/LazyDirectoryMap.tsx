import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import type { DirectoryEvent } from '@/components/DirectoryMap'

const DirectoryMap = lazy(() =>
  import('@/components/DirectoryMap').then((m) => ({ default: m.DirectoryMap })),
)

interface LazyDirectoryMapProps {
  events: DirectoryEvent[]
  culturalIdentityLabel?: string
  onViewDetails?: (event: DirectoryEvent) => void
  fullHeight?: boolean
}

export function LazyDirectoryMap(props: LazyDirectoryMapProps) {
  const heightClass = props.fullHeight ? 'h-full' : 'h-[400px]'
  return (
    <Suspense
      fallback={
        <div
          className={`${heightClass} rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center`}
        >
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      }
    >
      <DirectoryMap {...props} />
    </Suspense>
  )
}
