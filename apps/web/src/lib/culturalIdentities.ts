export interface CulturalIdentityOption {
  value: string
  label: string
  description?: string
}

export const CULTURAL_IDENTITIES: CulturalIdentityOption[] = [
  { value: 'open_inclusive', label: 'Open / Inclusive (default)' },
  { value: 'multicultural', label: 'Multicultural' },
  { value: 'black_african_american', label: 'Black / African American' },
  { value: 'latino_hispanic', label: 'Latino / Hispanic' },
  { value: 'asian_pacific_islander', label: 'Asian / Pacific Islander' },
  { value: 'indigenous_native', label: 'Indigenous / Native' },
  { value: 'european_heritage', label: 'European / Heritage-Based' },
  { value: 'faith_based', label: 'Faith-Based' },
  { value: 'veteran', label: 'Veteran' },
  { value: 'women_led', label: 'Women-Led' },
  { value: 'lgbtq', label: 'LGBTQ+' },
  { value: 'youth_focused', label: 'Youth-Focused' },
  { value: 'family_oriented', label: 'Family-Oriented' },
]

export const CULTURAL_IDENTITY_ORG_TYPES = ['Fraternity', 'Sorority', 'Cultural Organization', 'Social Club']

export function getIdentityLabel(value: string | null | undefined): string {
  if (!value) return ''
  const found = CULTURAL_IDENTITIES.find((c) => c.value === value)
  return found?.label ?? value
}
