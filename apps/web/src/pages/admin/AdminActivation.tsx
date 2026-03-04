import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'

function getScoreColor(score: number) {
  if (score >= 4) return 'bg-green-500'
  if (score >= 2) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function AdminActivation() {
  const [data, setData] = useState<{
    score_distribution?: Record<number, number>
    orgs?: { id: string; name?: string; activation_score?: number; member_count?: number }[]
  } | null>(null)

  useEffect(() => {
    adminApi.getActivation('14days').then(setData)
  }, [])

  const dist = data?.score_distribution ?? {}

  return (
    <AdminLayout title="Activation" subtitle="Organization engagement scores">
      <div className="space-y-6">
        <div className="bg-[#1a1d24] rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-500 mb-4">Score distribution (0–5)</div>
          <div className="flex gap-4">
            {[0, 1, 2, 3, 4, 5].map((score) => (
              <div key={score} className="flex-1 text-center">
                <div className="text-2xl font-semibold text-white">{dist[score] ?? 0}</div>
                <div className="text-xs text-gray-500 mt-1">Score {score}</div>
              </div>
            ))}
          </div>
        </div>
        {data?.orgs && data.orgs.length > 0 && (
          <div className="bg-[#1a1d24] rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500">
                  <th className="p-3">Organization</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Members</th>
                </tr>
              </thead>
              <tbody>
                {data.orgs.slice(0, 50).map((o) => (
                  <tr key={o.id} className="border-b border-gray-800">
                    <td className="p-3 text-white">{o.name || o.id}</td>
                    <td className="p-3">
                      <span className={`inline-block w-2 h-2 rounded-full ${getScoreColor(o.activation_score ?? 0)} mr-2`} />
                      {o.activation_score ?? 0}/5
                    </td>
                    <td className="p-3 text-gray-400">{o.member_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
