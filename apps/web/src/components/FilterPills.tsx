import { X } from 'lucide-react'
import { getIdentityLabel } from '@/lib/culturalIdentities'
import { MONTH_OPTIONS, US_STATES } from '@/lib/directoryFilterOptions'
import type { DirectoryFilters } from './FilterModal'

const DATE_LABELS: Record<string, string> = Object.fromEntries(
  MONTH_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
)

interface FilterPillsProps {
  filters: DirectoryFilters
  setFilters: (f: DirectoryFilters) => void
}

export function FilterPills({ filters, setFilters }: FilterPillsProps) {
  const activeFilters: { key: keyof DirectoryFilters; label: string; onRemove: () => void }[] = []

  if (filters.orgType) {
    activeFilters.push({
      key: 'orgType',
      label: filters.orgType,
      onRemove: () => setFilters({ ...filters, orgType: null }),
    })
  }
  if (filters.culturalIdentity) {
    activeFilters.push({
      key: 'culturalIdentity',
      label: getIdentityLabel(filters.culturalIdentity),
      onRemove: () => setFilters({ ...filters, culturalIdentity: null }),
    })
  }
  if (filters.sportType) {
    activeFilters.push({
      key: 'sportType',
      label: filters.sportType,
      onRemove: () => setFilters({ ...filters, sportType: null }),
    })
  }
  if (filters.dateRange) {
    activeFilters.push({
      key: 'dateRange',
      label: DATE_LABELS[filters.dateRange] ?? filters.dateRange,
      onRemove: () => setFilters({ ...filters, dateRange: null }),
    })
  }
  if (filters.radius) {
    activeFilters.push({
      key: 'radius',
      label: `Within ${filters.radius} mi`,
      onRemove: () => setFilters({ ...filters, radius: null }),
    })
  }
  if (filters.state) {
    const stateLabel = US_STATES.find((s) => s.value === filters.state)?.label ?? filters.state
    activeFilters.push({
      key: 'state',
      label: stateLabel,
      onRemove: () => setFilters({ ...filters, state: null }),
    })
  }
  if (filters.city?.trim()) {
    activeFilters.push({
      key: 'city',
      label: `City: ${filters.city.trim()}`,
      onRemove: () => setFilters({ ...filters, city: '' }),
    })
  }

  if (activeFilters.length === 0) return null

  const clearAll = () => {
    setFilters({
      ...filters,
      orgType: null,
      culturalIdentity: null,
      sportType: null,
      dateRange: null,
      radius: null,
      state: null,
      city: '',
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {activeFilters.map((filter) => (
        <span
          key={String(filter.key)}
          className="inline-flex items-center gap-1 px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-sm text-white"
        >
          {filter.label}
          <button
            type="button"
            onClick={filter.onRemove}
            className="ml-1 hover:text-red-400 transition-colors p-0.5"
          >
            <X size={14} />
          </button>
        </span>
      ))}
      {activeFilters.length > 1 && (
        <button
          type="button"
          onClick={clearAll}
          className="text-sm text-zinc-400 hover:text-white underline"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
