/**
 * Grouped organization types for display.
 * Users select one value (e.g. "Motorcycle Club"); category is auto-assigned and never selected directly.
 * Stored in backend: type = selected value (e.g. "Motorcycle Club"), organization_category = derived (e.g. "Recreation & Enthusiast Groups").
 */
export const ORG_TYPE_GROUPS = [
  {
    category: 'Recreation & Enthusiast Groups',
    categoryDisplay: '🏍️ Recreation & Enthusiast Groups',
    subtitle: 'Event-driven, high engagement',
    options: ['Motorcycle Club', 'Riding Club', 'Car Club', 'Social Club', 'Sports Club'],
  },
  {
    category: 'Greek & Social Organizations',
    categoryDisplay: '🎓 Greek & Social Organizations',
    subtitle: 'Structured membership organizations',
    options: ['Fraternity', 'Sorority'],
  },
  {
    category: 'Professional & Community Organizations',
    categoryDisplay: '💼 Professional & Community Organizations',
    subtitle: 'Networking, cultural, or service-based',
    options: [
      'Professional Organization',
      'Cultural Organization',
      'Veterans Organization',
      'Volunteer Organization',
      'Nonprofit / Charity',
      'Religious / Faith-Based Organization',
    ],
  },
  {
    category: 'Education & Family Organizations',
    categoryDisplay: '🏫 Education & Family Organizations',
    subtitle: 'School or alumni related',
    options: ['Academic Club', 'Alumni Association', 'Parent Group'],
  },
  {
    category: 'Civic & Administrative Organizations',
    categoryDisplay: '🏛️ Civic & Administrative Organizations',
    subtitle: 'Governance or advocacy focused',
    options: ['Neighborhood / HOA', 'Union / Guild', 'Political Organization'],
  },
  {
    category: 'Other',
    categoryDisplay: '⚙️ Other',
    subtitle: 'Admin approval required',
    options: ['Other (Admin approval required)'],
  },
] as const

/** Flat list of all organization types (for directory filter dropdown). */
export const ALL_ORG_TYPES: string[] = ORG_TYPE_GROUPS.flatMap((g) => [...g.options])

export function getCategoryForType(type: string): string | null {
  for (const group of ORG_TYPE_GROUPS) {
    if (group.options.includes(type as never)) return group.category
  }
  return null
}
