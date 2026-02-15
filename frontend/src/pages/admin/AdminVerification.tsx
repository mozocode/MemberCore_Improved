import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'

type Org = { id: string; name?: string; owner_email?: string }

export default function AdminVerification() {
  const [queue, setQueue] = useState<Org[]>([])

  useEffect(() => {
    adminApi.getVerificationQueue().then(setQueue)
  }, [])

  const verify = async (orgId: string) => {
    await adminApi.verifyOrg(orgId)
    setQueue((prev) => prev.filter((o) => o.id !== orgId))
  }

  return (
    <AdminLayout title="Verification" subtitle="Verification request queue">
      <div className="bg-[#1a1d24] rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="p-3">Name</th>
              <th className="p-3">Owner email</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((org) => (
              <tr key={org.id} className="border-b border-gray-800">
                <td className="p-3 text-white">{org.name || org.id}</td>
                <td className="p-3 text-gray-400">{org.owner_email || '—'}</td>
                <td className="p-3">
                  <Button size="sm" className="bg-white text-black hover:bg-gray-200" onClick={() => verify(org.id)}>
                    Verify
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {queue.length === 0 && <div className="p-6 text-center text-gray-500">No unverified organizations in queue.</div>}
      </div>
    </AdminLayout>
  )
}
