import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'

export default function AdminGrowth() {
  const [data, setData] = useState<{
    pro_mrr?: number
    free_orgs?: number
    new_pro_orgs_7d?: number
    new_mrr_30d?: number
    pro_orgs?: { id: string; name?: string }[]
  } | null>(null)

  useEffect(() => {
    adminApi.getGrowth('6months').then(setData)
  }, [])

  return (
    <AdminLayout title="Growth & Revenue" subtitle="MRR, pro conversions, revenue tracking">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#1a1d24] rounded-lg p-4 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">Pro MRR</div>
            <div className="text-2xl font-semibold text-white">${(data?.pro_mrr ?? 0).toFixed(2)}</div>
          </div>
          <div className="bg-[#1a1d24] rounded-lg p-4 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">Free orgs</div>
            <div className="text-2xl font-semibold text-white">{data?.free_orgs ?? 0}</div>
          </div>
          <div className="bg-[#1a1d24] rounded-lg p-4 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">New pro orgs (7d)</div>
            <div className="text-2xl font-semibold text-white">{data?.new_pro_orgs_7d ?? 0}</div>
          </div>
          <div className="bg-[#1a1d24] rounded-lg p-4 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">New MRR (30d)</div>
            <div className="text-2xl font-semibold text-white">${(data?.new_mrr_30d ?? 0).toFixed(2)}</div>
          </div>
        </div>
        {data?.pro_orgs && data.pro_orgs.length > 0 && (
          <div className="bg-[#1a1d24] rounded-lg p-4 border border-gray-800">
            <div className="text-sm text-gray-500 mb-2">Pro organizations (sample)</div>
            <ul className="text-sm text-white space-y-1">
              {data.pro_orgs.slice(0, 20).map((o) => (
                <li key={o.id}>{o.name || o.id}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
