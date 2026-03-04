import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'

type Request = { id: string; organization_id?: string; requested_type?: string; status?: string; created_at?: string }

export default function AdminOrgTypeRequests() {
  const [requests, setRequests] = useState<Request[]>([])
  const [statusFilter, setStatusFilter] = useState('pending')

  useEffect(() => {
    adminApi.getOrgTypeRequests(statusFilter).then(setRequests)
  }, [statusFilter])

  const approve = async (id: string) => {
    await adminApi.approveOrgTypeRequest(id)
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  const reject = async (id: string) => {
    await adminApi.rejectOrgTypeRequest(id)
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <AdminLayout title="Organization type requests" subtitle="Custom org type approvals">
      <div className="mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#0f1117] border border-gray-700 rounded px-3 py-2 text-sm text-white">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <div className="bg-[#1a1d24] rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="p-3">Organization ID</th>
              <th className="p-3">Requested type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-gray-800">
                <td className="p-3 text-gray-400">{r.organization_id || '—'}</td>
                <td className="p-3 text-white">{r.requested_type || '—'}</td>
                <td className="p-3 text-gray-400">{r.status || '—'}</td>
                <td className="p-3 text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                <td className="p-3">
                  {r.status === 'pending' && (
                    <>
                      <Button size="sm" className="bg-white text-black hover:bg-gray-200 mr-2" onClick={() => approve(r.id)}>Approve</Button>
                      <Button variant="outline" size="sm" className="border-red-600 text-red-400" onClick={() => reject(r.id)}>Reject</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && <div className="p-6 text-center text-gray-500">No requests.</div>}
      </div>
    </AdminLayout>
  )
}
