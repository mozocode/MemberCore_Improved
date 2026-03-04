import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CULTURAL_IDENTITIES, getIdentityLabel } from '@/lib/culturalIdentities'
import { MONTH_OPTIONS, US_STATES, SPORTS_OPTIONS } from '@/lib/directoryFilterOptions'
import { ALL_ORG_TYPES } from '@/lib/orgTypes'

export interface DirectoryFilters {
  orgType: string | null
  culturalIdentity: string | null
  sportType: string | null
  dateRange: string | null
  radius: string | null
  searchQuery: string
  state: string | null
  city: string
}

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
  userOrg?: { type?: string; cultural_identity?: string; sport_type?: string } | null
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
      ...filters,
      orgType: null,
      culturalIdentity: null,
      sportType: null,
      dateRange: null,
      radius: null,
      state: null,
      city: '',
      searchQuery: filters.searchQuery,
    })
  }

  const handleFilterChange = (key: keyof DirectoryFilters, value: string | null) => {
    const next = { ...filters, [key]: value ?? (key === 'city' ? '' : null) }
    if (key === 'orgType' && value !== 'Sports Club') {
      next.sportType = null
    }
    setFilters(next)
  }

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
              onChange={(e) => handleFilterChange('orgType', e.target.value || null)}
              className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white text-sm"
            >
              <option value="">All types</option>
              {ALL_ORG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {filters.orgType === 'Sports Club' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Sport</label>
              {userOrg?.sport_type && (
                <p className="text-xs text-zinc-500">Your club&apos;s sport: {userOrg.sport_type}</p>
              )}
              <select
                value={filters.sportType ?? ''}
                onChange={(e) => handleFilterChange('sportType', e.target.value || null)}
                className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white text-sm"
              >
                {SPORTS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              onChange={(e) => handleFilterChange('culturalIdentity', e.target.value || null)}
              className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white text-sm"
            >
              <option value="">All Affiliations</option>
              {CULTURAL_IDENTITIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Date Range</label>
            <select
              value={filters.dateRange ?? ''}
              onChange={(e) => handleFilterChange('dateRange', e.target.value || null)}
              className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white text-sm"
            >
              {MONTH_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">State</label>
            <select
              value={filters.state ?? ''}
              onChange={(e) => handleFilterChange('state', e.target.value || null)}
              className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white text-sm"
            >
              {US_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">City</label>
            <input
              type="text"
              placeholder="Enter city name..."
              value={filters.city}
              onChange={(e) => handleFilterChange('city', e.target.value)}
              className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-white text-sm placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Distance</label>
            <select
              value={filters.radius ?? ''}
              onChange={(e) => handleFilterChange('radius', e.target.value || null)}
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
        <div className="flex flex-wrap gap-2 p-4 border-t border-zinc-700">
          {userOrg && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                let orgType = userOrg?.type ?? ''
                let sportType = ''
                if (orgType.startsWith('sports_club:')) {
                  sportType = orgType.split(':')[1] ?? ''
                  orgType = 'Sports Club'
                } else if (orgType === 'Sports Club' && userOrg?.sport_type) {
                  sportType = userOrg.sport_type
                }
                setFilters({
                  ...filters,
                  orgType: orgType || null,
                  culturalIdentity: userOrg?.cultural_identity ?? null,
                  sportType: sportType || null,
                  dateRange: null,
                  radius: null,
                  state: null,
                  city: '',
                })
              }}
              className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
            >
              Reset to Defaults
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={clearAll}
            className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
          >
            Clear All
          </Button>
          <Button type="button" onClick={onClose} className="flex-1 min-w-[120px] bg-white text-black hover:bg-zinc-200">
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  )
}
