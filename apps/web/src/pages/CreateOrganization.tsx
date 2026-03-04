import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GroupedOrgTypeSelect } from '@/components/GroupedOrgTypeSelect'
import { SearchableSelect } from '@/components/SearchableSelect'
import { api } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { getCategoryForType } from '@/lib/orgTypes'
import { SPORTS_LIST } from '@/lib/sports'
import { CULTURAL_IDENTITIES } from '@/lib/culturalIdentities'
import { Loader2, ArrowLeft, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'

export function CreateOrganization() {
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [sportType, setSportType] = useState('')
  const [culturalIdentity, setCulturalIdentity] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { success } = useToast()

  useEffect(() => {
    if (type !== 'Sports Club') setSportType('')
  }, [type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!type) {
      setError('Please select an organization type.')
      return
    }
    if (type === 'Sports Club' && !sportType) {
      setError('Please select a sport type.')
      return
    }
    if (!culturalIdentity) {
      setError('Please select a cultural / affinity identity.')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/organizations', {
        name,
        type,
        organization_category: type ? (getCategoryForType(type) ?? undefined) : undefined,
        sport_type: type === 'Sports Club' ? sportType || undefined : undefined,
        cultural_identity: culturalIdentity || undefined,
        description: description || undefined,
      })
      success('Organization created!')
      navigate(`/org/${data.id}`)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/user-dashboard')
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link to="/user-dashboard" className="flex items-center gap-2 text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </nav>

      <main className="max-w-lg mx-auto px-6 py-12">
        <Card className="border-zinc-800">
          <CardHeader>
            <CardTitle>Create New Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Organization Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Enter organization name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-zinc-900 border-zinc-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-type">
                  Organization Type <span className="text-destructive">*</span>
                </Label>
                <p className="text-sm text-zinc-400">
                  Select the option that best describes your organization.
                </p>
                <GroupedOrgTypeSelect
                  value={type}
                  onChange={setType}
                  required
                />
              </div>
              {type === 'Sports Club' && (
                <div className="space-y-2">
                  <Label htmlFor="sport-type" className="text-zinc-300">
                    Sport Type
                  </Label>
                  <SearchableSelect
                    options={SPORTS_LIST}
                    value={sportType}
                    onChange={setSportType}
                    placeholder="Search for a sport..."
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="culturalIdentity">
                  Cultural / Affinity Identity <span className="text-destructive">*</span>
                </Label>
                <p className="text-sm text-zinc-400">
                  Select the option that best describes your organization.
                </p>
                <div className="relative">
                  <select
                    id="culturalIdentity"
                    className="flex h-10 w-full rounded-md border border-input bg-zinc-900 border-zinc-700 px-3 py-2 text-sm appearance-none pr-10"
                    value={culturalIdentity}
                    onChange={(e) => setCulturalIdentity(e.target.value)}
                    required
                  >
                    <option value="">Select an identity</option>
                    {CULTURAL_IDENTITIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.description ? `${c.label} (${c.description})` : c.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm resize-none"
                  placeholder="Enter organization description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-white text-black hover:bg-zinc-200"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Organization'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
