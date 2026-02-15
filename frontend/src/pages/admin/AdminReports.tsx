import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'

type Report = { id: string; name: string; description?: string }

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([])

  useEffect(() => {
    adminApi.getReportsAvailable().then((r: { reports?: Report[] }) => setReports(r.reports ?? []))
  }, [])

  return (
    <AdminLayout title="Reports" subtitle="Export and analytics">
      <div className="bg-[#1a1d24] rounded-lg border border-gray-800 p-6">
        <div className="text-sm text-gray-500 mb-4">Available report types</div>
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
              <div>
                <div className="text-white font-medium">{r.name}</div>
                {r.description && <div className="text-sm text-gray-500">{r.description}</div>}
              </div>
            </li>
          ))}
        </ul>
        {reports.length === 0 && <p className="text-gray-500">No report types configured.</p>}
      </div>
    </AdminLayout>
  )
}
