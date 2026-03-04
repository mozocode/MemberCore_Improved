import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'
import { Input } from '@/components/ui/input'

type BillingOrg = {
  id: string
  name?: string
  plan?: string
  trial_end?: string
  period_end?: string
  has_stripe?: boolean
  billing_status?: string
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-gray-500">—</span>
  const s = status.toLowerCase()
  const classes =
    s === 'active' ? 'text-green-400' :
    s === 'trial' ? 'text-blue-400' :
    s === 'exempt' ? 'text-amber-400' :
    s === 'past_due' ? 'text-orange-400' :
    s === 'canceled' || s === 'inactive' ? 'text-red-400' :
    'text-gray-400'
  const label = s === 'past_due' ? 'Past due' : s.charAt(0).toUpperCase() + s.slice(1)
  return <span className={classes}>{label}</span>
}

export default function AdminBilling() {
  const [rows, setRows] = useState<BillingOrg[]>([])
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('All')

  useEffect(() => {
    adminApi.getBilling({ search: search || undefined, plan_filter: planFilter }).then(setRows)
  }, [search, planFilter])

  return (
    <AdminLayout title="Billing" subtitle="Subscription overview">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs bg-[#0f1117] border-gray-700" />
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="bg-[#0f1117] border border-gray-700 rounded px-3 py-2 text-sm text-white">
          <option value="All">All plans</option>
          <option value="Free">Free</option>
          <option value="Pro">Pro</option>
        </select>
      </div>
      <div className="bg-[#1a1d24] rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="p-3">Name</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Status</th>
              <th className="p-3">Trial end</th>
              <th className="p-3">Period end</th>
              <th className="p-3">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-b border-gray-800">
                <td className="p-3 text-white">{o.name || o.id}</td>
                <td className="p-3 text-gray-400">{o.plan ?? '—'}</td>
                <td className="p-3">
                  <StatusBadge status={o.billing_status} />
                </td>
                <td className="p-3 text-gray-500">{o.trial_end ? new Date(o.trial_end).toLocaleDateString() : '—'}</td>
                <td className="p-3 text-gray-500">{o.period_end ? new Date(o.period_end).toLocaleDateString() : '—'}</td>
                <td className="p-3">{o.has_stripe ? <span className="text-green-400">Yes</span> : <span className="text-gray-500">No</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  )
}
