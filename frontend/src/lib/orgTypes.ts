/** Grouped organization types. Category is auto-assigned based on selection. */
export const ORG_TYPE_GROUPS = [
  {
    category: 'Recreation & Enthusiast Groups',
    subtitle: 'Event-driven, high engagement',
    options: ['Motorcycle Club', 'Riding Club', 'Car Club', 'Social Club', 'Sports Club'],
  },
  {
    category: 'Greek & Social Organizations',
    subtitle: 'Structured membership organizations',
    options: ['Fraternity', 'Sorority'],
  },
  {
    category: 'Professional & Community Organizations',
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
    subtitle: 'School or alumni related',
    options: ['Academic Club', 'Alumni Association', 'Parent Group'],
  },
  {
    category: 'Civic & Administrative Organizations',
    subtitle: 'Governance or advocacy focused',
    options: ['Neighborhood / HOA', 'Trade Union / Guild', 'Political Organization'],
  },
  {
    category: 'Other',
    subtitle: 'Admin approval required',
    options: ['Other (Admin approval required)'],
  },
] as const

export function getCategoryForType(type: string): string | null {
  for (const group of ORG_TYPE_GROUPS) {
    if (group.options.includes(type as never)) return group.category
  }
  return null
}
