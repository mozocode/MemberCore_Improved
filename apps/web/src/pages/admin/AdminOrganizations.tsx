import { Fragment, useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { normalizeOrgTypeLabel } from '@/lib/orgTypeDisplay'
import { getIdentityLabel } from '@/lib/culturalIdentities'

type Org = {
  id: string
  name?: string
  owner_email?: string
  type?: string
  cultural_identity?: string
  is_verified?: boolean
  is_pro?: boolean
  is_suspended?: boolean
  plan?: string
  activation_score?: number
  member_count?: number
  admin_count?: number
  event_count?: number
  last_activity_at?: string
  public_slug?: string
  created_at?: string
}

function formatDate(s?: string) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString()
  } catch {
    return s
  }
}

function formatDateTime(s?: string) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return String(s)
  }
}

function getScoreColor(score: number) {
  if (score >= 4) return 'bg-green-500'
  if (score >= 2) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [search, setSearch] = useState('')
  const [includeSuspended, setIncludeSuspended] = useState(true)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [verifiedFilter, setVerifiedFilter] = useState('All')
  const [planFilter, setPlanFilter] = useState('All')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [proMonthsByOrg, setProMonthsByOrg] = useState<Record<string, string>>({})
  const [grantingOrgId, setGrantingOrgId] = useState<string | null>(null)

  const load = () => {
    adminApi.getOrganizations({
      search: search || undefined,
      include_suspended: includeSuspended,
      include_deleted: includeDeleted,
      verified_filter: verifiedFilter,
      plan_filter: planFilter,
    }).then(setOrgs)
  }

  useEffect(() => {
    load()
  }, [search, includeSuspended, includeDeleted, verifiedFilter, planFilter])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelected((prev) => (prev.size === orgs.length ? new Set() : new Set(orgs.map((o) => o.id))))
  }

  const handleBulkDelete = async () => {
    await adminApi.bulkDeleteOrgs(Array.from(selected))
    setSelected(new Set())
    setShowBulkConfirm(false)
    load()
  }

  const getProMonthsValue = (orgId: string) => proMonthsByOrg[orgId] ?? '1'

  const setProMonthsValue = (orgId: string, value: string) => {
    setProMonthsByOrg((prev) => ({ ...prev, [orgId]: value }))
  }

  const handleGrantPro = async (orgId: string) => {
    const raw = getProMonthsValue(orgId).trim()
    const months = Number(raw)
    if (!Number.isInteger(months) || months < 0) {
      alert('Months must be a whole number >= 0. Use 0 for lifetime free Pro access.')
      return
    }
    setGrantingOrgId(orgId)
    try {
      await adminApi.grantOrgPro(orgId, months)
      load()
    } finally {
      setGrantingOrgId(null)
    }
  }

  return (
    <AdminLayout title="Organizations" subtitle="Full org management">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs bg-[#0f1117] border-gray-700"
        />
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={includeSuspended} onChange={(e) => setIncludeSuspended(e.target.checked)} />
          Include suspended
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
          Include deleted
        </label>
        <select value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value)} className="bg-[#0f1117] border border-gray-700 rounded px-3 py-2 text-sm text-white">
          <option value="All">All verified</option>
          <option value="Verified">Verified</option>
          <option value="Unverified">Unverified</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="bg-[#0f1117] border border-gray-700 rounded px-3 py-2 text-sm text-white">
          <option value="All">All plans</option>
          <option value="Free">Free</option>
          <option value="Pro">Pro</option>
        </select>
        {selected.size > 0 && (
          <Button variant="outline" onClick={() => setShowBulkConfirm(true)} className="border-red-600 text-red-400 hover:bg-red-600/20">
            Delete selected ({selected.size})
          </Button>
        )}
      </div>
      <div className="bg-[#1a1d24] rounded-lg border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="p-3 w-10"><input type="checkbox" checked={orgs.length > 0 && selected.size === orgs.length} onChange={selectAll} /></th>
              <th className="p-3">Name</th>
              <th className="p-3">Owner</th>
              <th className="p-3">Type</th>
              <th className="p-3">Cultural identity</th>
              <th className="p-3 text-right whitespace-nowrap">Members</th>
              <th className="p-3 text-right whitespace-nowrap">Events</th>
              <th className="p-3 text-right whitespace-nowrap">Admins</th>
              <th className="p-3">Verified</th>
              <th className="p-3">Plan</th>
              <th className="p-3 whitespace-nowrap">Created</th>
              <th className="p-3 whitespace-nowrap">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <Fragment key={org.id}>
                <tr className={`border-b border-gray-800 ${selected.has(org.id) ? 'bg-blue-900/20' : ''}`}>
                  <td className="p-3"><input type="checkbox" checked={selected.has(org.id)} onChange={() => toggleSelect(org.id)} /></td>
                  <td className="p-3 text-white">
                    <div className="flex flex-col gap-0.5 min-w-[140px]">
                      <span className="flex items-center gap-2 flex-wrap">
                        {org.name || '—'}
                        {org.is_suspended ? (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-yellow-600/80 text-yellow-400">Suspended</span>
                        ) : null}
                      </span>
                      {org.public_slug ? (
                        <span className="text-xs text-gray-500">/org/{org.public_slug}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-3 text-gray-400 max-w-[200px] truncate" title={org.owner_email}>{org.owner_email || '—'}</td>
                  <td className="p-3 text-gray-400">{normalizeOrgTypeLabel(org.type) || 'Organization'}</td>
                  <td className="p-3 text-gray-400 max-w-[160px]" title={getIdentityLabel(org.cultural_identity) || undefined}>
                    {getIdentityLabel(org.cultural_identity) || org.cultural_identity || '—'}
                  </td>
                  <td className="p-3 text-right text-gray-200 tabular-nums">{org.member_count ?? 0}</td>
                  <td className="p-3 text-right text-gray-200 tabular-nums">{org.event_count ?? 0}</td>
                  <td className="p-3 text-right text-gray-200 tabular-nums">{org.admin_count ?? 0}</td>
                  <td className="p-3">{org.is_verified ? <span className="text-green-400">Verified</span> : <span className="text-gray-500">Unverified</span>}</td>
                  <td className="p-3 text-gray-400">{org.plan ?? (org.is_pro ? 'Pro' : 'Free')}</td>
                  <td className="p-3 text-gray-500 whitespace-nowrap">{formatDate(org.created_at)}</td>
                  <td className="p-3 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(org.last_activity_at)}</td>
                </tr>
                <tr className="border-b border-gray-800 bg-gray-900/30">
                  <td className="p-3" />
                  <td colSpan={11} className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-2">
                          <span>Activation</span>
                          <span className={`w-2 h-2 rounded-full ${getScoreColor(org.activation_score ?? 0)}`} />
                          <span className="text-white">{(org.activation_score ?? 0)}/5</span>
                          <span className="text-gray-600">(logo, description, member milestones)</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={getProMonthsValue(org.id)}
                          onChange={(e) => setProMonthsValue(org.id, e.target.value)}
                          className="w-24 h-8 bg-[#0f1117] border-gray-700 text-white"
                          placeholder="months"
                          title="Months of Pro access. Use 0 for lifetime free Pro."
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-600 text-blue-300 hover:bg-blue-600/20"
                          onClick={() => handleGrantPro(org.id)}
                          disabled={grantingOrgId === org.id}
                        >
                          {grantingOrgId === org.id ? 'Granting…' : 'Grant Pro'}
                        </Button>
                        <Button variant="outline" size="sm" className="border-gray-600" onClick={async () => { await adminApi.verifyOrg(org.id); load() }}>Verify</Button>
                        <Button variant="outline" size="sm" className="border-gray-600" onClick={async () => { await adminApi.unverifyOrg(org.id); load() }}>Unverify</Button>
                        {org.is_suspended ? (
                          <Button variant="outline" size="sm" className="border-green-600 text-green-400" onClick={async () => { await adminApi.unsuspendOrg(org.id); load() }}>Unsuspend</Button>
                        ) : (
                          <Button variant="outline" size="sm" className="border-yellow-600 text-yellow-400" onClick={async () => { await adminApi.suspendOrg(org.id); load() }}>Suspend</Button>
                        )}
                        <Button variant="outline" size="sm" className="border-red-600 text-red-400" onClick={async () => { if (confirm('Soft-delete this org?')) { await adminApi.deleteOrg(org.id); load() } }}>Delete</Button>
                      </div>
                    </div>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1d24] rounded-lg p-6 border border-gray-800 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-2">Delete {selected.size} organizations?</h3>
            <p className="text-sm text-gray-500 mb-4">Organizations will be soft-deleted.</p>
            <div className="flex gap-2">
              <Button onClick={handleBulkDelete} className="bg-red-600 text-white hover:bg-red-700">Delete</Button>
              <Button variant="outline" onClick={() => setShowBulkConfirm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
