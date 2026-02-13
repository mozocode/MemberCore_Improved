export interface CulturalIdentityOption {
  value: string
  label: string
  description?: string
}

export const CULTURAL_IDENTITIES: CulturalIdentityOption[] = [
  { value: 'black_african_american', label: 'Black / African American' },
  { value: 'white', label: 'White' },
  { value: 'latino_hispanic', label: 'Latino / Hispanic' },
  { value: 'asian', label: 'Asian' },
  { value: 'multicultural', label: 'Multicultural' },
  { value: 'faith_based', label: 'Faith-Based' },
  { value: 'veteran', label: 'Veteran' },
  { value: 'women_led', label: 'Women-Led' },
  { value: 'lgbtq', label: 'LGBTQ+' },
  { value: 'open_inclusive', label: 'Open / Inclusive' },
]

export const CULTURAL_IDENTITY_ORG_TYPES = ['Fraternity', 'Sorority', 'Cultural Organization', 'Social Club']

export function getIdentityLabel(value: string | null | undefined): string {
  if (!value) return ''
  const found = CULTURAL_IDENTITIES.find((c) => c.value === value)
  return found?.label ?? value
}
