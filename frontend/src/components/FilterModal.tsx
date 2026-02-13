import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/SearchableSelect'
import { SPORTS_LIST } from '@/lib/sports'
import { CULTURAL_IDENTITIES, getIdentityLabel } from '@/lib/culturalIdentities'

export interface DirectoryFilters {
  orgType: string | null
  culturalIdentity: string | null
  sportType: string | null
  dateRange: string | null
  radius: string | null
  searchQuery: string
}

const ORG_TYPES = [
  'Fraternity',
  'Sorority',
  'Social Club',
  'Sports Club',
  'Professional Organization',
  'Cultural Organization',
  'Academic Club',
  'Other',
]

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_weekend', label: 'This Weekend' },
  { value: 'next_week', label: 'Next Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'next_month', label: 'Next Month' },
]

const RADIUS_OPTIONS = [
  { value: '5', label: 'Within 5 miles' },
  { value: '10', label: 'Within 10 miles' },
  { value: '25', label: 'Within 25 miles' },
  { value: '50', label: 'Within 50 miles' },
  { value: '100', label: 'Within 100 miles' },
]

interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  filters: DirectoryFilters
  setFilters: (f: DirectoryFilters) => void
  userOrg?: { cultural_identity?: string; sport_type?: string } | null
}

export function FilterModal({
  isOpen,
  onClose,
  filters,
  setFilters,
  userOrg,
}: FilterModalProps) {
  if (!isOpen) return null

  const clearAll = () => {
    setFilters({
      orgType: null,
      culturalIdentity: null,
      sportType: null,
      dateRange: null,
      radius: null,
      searchQuery: filters.searchQuery,
    })
  }

  const showCulturalIdentity = [
    'Fraternity',
    'Sorority',
    'Cultural Organization',
    'Social Club',
    null,
  ].includes(filters.orgType)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md max-h-[90vh] overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-700 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-white">Filter Events</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Organization Type</label>
            <select
              value={filters.orgType ?? ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  orgType: e.target.value || null,
                })
              }
              className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white text-sm"
            >
              <option value="">All types</option>
              {ORG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {showCulturalIdentity && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">
                Cultural / Affinity Identity
              </label>
              {userOrg?.cultural_identity && (
                <p className="text-xs text-zinc-500">
                  Your org: {getIdentityLabel(userOrg.cultural_identity)}
                </p>
              )}
              <select
                value={filters.culturalIdentity ?? ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    culturalIdentity: e.target.value || null,
                  })
                }
                className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white text-sm"
              >
                <option value="">All identities</option>
                {CULTURAL_IDENTITIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filters.orgType === 'Sports Club' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Sport</label>
              {userOrg?.sport_type && (
                <p className="text-xs text-zinc-500">Your club&apos;s sport: {userOrg.sport_type}</p>
              )}
              <SearchableSelect
                options={SPORTS_LIST}
                value={filters.sportType ?? ''}
                onChange={(v) => setFilters({ ...filters, sportType: v || null })}
                placeholder="Search sports..."
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Date Range</label>
            <select
              value={filters.dateRange ?? ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dateRange: e.target.value || null,
                })
              }
              className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white text-sm"
            >
              <option value="">Any time</option>
              {DATE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Distance</label>
            <select
              value={filters.radius ?? ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  radius: e.target.value || null,
                })
              }
              className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white text-sm"
            >
              <option value="">Any distance</option>
              {RADIUS_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-zinc-700">
          <Button
            type="button"
            variant="outline"
            onClick={clearAll}
            className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
          >
            Clear All
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 bg-white text-black hover:bg-zinc-200"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  )
}
