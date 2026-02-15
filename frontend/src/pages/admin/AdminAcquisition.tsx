import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'

export default function AdminAcquisition() {
  const [data, setData] = useState<{
    new_users_30d?: number
    new_orgs_30d?: number
    cac?: number | null
    acquisition_sources?: unknown[]
  } | null>(null)

  useEffect(() => {
    adminApi.getAcquisition().then(setData)
  }, [])

  return (
    <AdminLayout title="Acquisition & CAC" subtitle="User acquisition metrics">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1a1d24] rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">New users (30d)</div>
          <div className="text-2xl font-semibold text-white">{data?.new_users_30d ?? 0}</div>
        </div>
        <div className="bg-[#1a1d24] rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">New orgs (30d)</div>
          <div className="text-2xl font-semibold text-white">{data?.new_orgs_30d ?? 0}</div>
        </div>
        <div className="bg-[#1a1d24] rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">CAC</div>
          <div className="text-2xl font-semibold text-white">{data?.cac ?? '—'}</div>
        </div>
      </div>
      {data?.acquisition_sources && data.acquisition_sources.length > 0 && (
        <div className="mt-6 bg-[#1a1d24] rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-500 mb-2">Acquisition sources</div>
          <pre className="text-xs text-gray-400 overflow-auto">{JSON.stringify(data.acquisition_sources, null, 2)}</pre>
        </div>
      )}
    </AdminLayout>
  )
}
