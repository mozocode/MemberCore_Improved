import type { DirectoryFilters } from '@/components/FilterModal'

/** Minimal event shape needed for client-side filters. */
interface EventWithLocation {
  id: string
  location?: string | null
  start_time?: string | null
  event_date?: string | null
}

/** Apply client-side date range, state, and city filters to directory events. */
export function applyClientSideFilters<T extends EventWithLocation>(
  events: T[],
  filters: DirectoryFilters,
): T[] {
  let data = [...events]

  if (filters.dateRange) {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    data = data.filter((event) => {
      const dateStr = event.start_time || event.event_date
      if (!dateStr) return false
      const eventDate = new Date(dateStr)
      const eventMonth = eventDate.getMonth()
      const eventYear = eventDate.getFullYear()
      const monthDiff = (eventYear - currentYear) * 12 + (eventMonth - currentMonth)

      switch (filters.dateRange) {
        case 'current':
          return eventMonth === currentMonth && eventYear === currentYear
        case 'next': {
          const nextMonth = (currentMonth + 1) % 12
          const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear
          return eventMonth === nextMonth && eventYear === nextYear
        }
        case 'next3':
          return monthDiff >= 0 && monthDiff < 3
        case 'next6':
          return monthDiff >= 0 && monthDiff < 6
        case 'next12':
          return monthDiff >= 0 && monthDiff < 12
        case 'next18':
          return monthDiff >= 0 && monthDiff < 18
        default:
          return true
      }
    })
  }

  if (filters.state) {
    const stateUpper = filters.state.toUpperCase()
    data = data.filter(
      (event) =>
        event.location && event.location.toUpperCase().includes(stateUpper),
    )
  }

  if (filters.city?.trim()) {
    const cityLower = filters.city.trim().toLowerCase()
    data = data.filter(
      (event) =>
        event.location &&
        event.location.toLowerCase().includes(cityLower),
    )
  }

  return data
}
