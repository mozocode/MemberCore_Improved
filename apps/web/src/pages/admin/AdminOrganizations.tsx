import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
      <div className="bg-[#1a1d24] rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="p-3 w-10"><input type="checkbox" checked={orgs.length > 0 && selected.size === orgs.length} onChange={selectAll} /></th>
              <th className="p-3">Name</th>
              <th className="p-3">Owner</th>
              <th className="p-3">Type</th>
              <th className="p-3">Cultural identity</th>
              <th className="p-3">Verified</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <>
                <tr key={org.id} className={`border-b border-gray-800 ${selected.has(org.id) ? 'bg-blue-900/20' : ''}`}>
                  <td className="p-3"><input type="checkbox" checked={selected.has(org.id)} onChange={() => toggleSelect(org.id)} /></td>
                  <td className="p-3 text-white">{org.name || '—'}</td>
                  <td className="p-3 text-gray-400">{org.owner_email || '—'}</td>
                  <td className="p-3 text-gray-400">{org.type || 'Organization'}</td>
                  <td className="p-3 text-gray-400">{org.cultural_identity || 'Open / Inclusive'}</td>
                  <td className="p-3">{org.is_verified ? <span className="text-green-400">Verified</span> : <span className="text-gray-500">Unverified</span>}</td>
                  <td className="p-3 text-gray-400">{org.plan ?? (org.is_pro ? 'Pro' : 'Free')}</td>
                  <td className="p-3 text-gray-500">{formatDate(org.created_at)}</td>
                </tr>
                <tr key={`${org.id}-actions`} className="border-b border-gray-800 bg-gray-900/30">
                  <td className="p-3" />
                  <td colSpan={7} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Activation</span>
                        <span className={`w-2 h-2 rounded-full ${getScoreColor(org.activation_score ?? 0)}`} />
                        <span className="text-white">{(org.activation_score ?? 0)}/5</span>
                      </div>
                      <div className="flex items-center gap-2">
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
              </>
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
