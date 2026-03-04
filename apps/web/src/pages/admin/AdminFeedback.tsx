import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'
import { Loader2 } from 'lucide-react'

interface FeedbackItem {
  id: string
  org_id: string
  org_name: string
  user_id?: string
  type: string
  answer_text: string
  choice_key?: string
  created_at: string | null
}

export default function AdminFeedback() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi
      .getFeedback()
      .then((res: { items?: FeedbackItem[] }) => setItems(res?.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const signupItems = items.filter((i) => i.type === 'signup')
  const trialExitItems = items.filter((i) => i.type === 'trial_exit')

  return (
    <AdminLayout title="Feedback" subtitle="Signup and trial-exit feedback from org owners and admins">
      <div className="space-y-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">What made you try MemberCore? (signup)</h2>
              <div className="bg-[#1a1d24] rounded-lg border border-gray-800 overflow-hidden">
                {signupItems.length === 0 ? (
                  <p className="p-4 text-gray-500 text-sm">No signup feedback yet.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="p-3 text-gray-400 font-medium">Organization</th>
                        <th className="p-3 text-gray-400 font-medium">Answer</th>
                        <th className="p-3 text-gray-400 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signupItems.map((row) => (
                        <tr key={row.id} className="border-b border-gray-800/50">
                          <td className="p-3 text-white">{row.org_name}</td>
                          <td className="p-3 text-gray-300 max-w-md">{row.answer_text || '—'}</td>
                          <td className="p-3 text-gray-500">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Main reason you didn&apos;t continue? (trial exit)</h2>
              <div className="bg-[#1a1d24] rounded-lg border border-gray-800 overflow-hidden">
                {trialExitItems.length === 0 ? (
                  <p className="p-4 text-gray-500 text-sm">No trial-exit feedback yet.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="p-3 text-gray-400 font-medium">Organization</th>
                        <th className="p-3 text-gray-400 font-medium">Reason</th>
                        <th className="p-3 text-gray-400 font-medium">Details</th>
                        <th className="p-3 text-gray-400 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialExitItems.map((row) => (
                        <tr key={row.id} className="border-b border-gray-800/50">
                          <td className="p-3 text-white">{row.org_name}</td>
                          <td className="p-3 text-gray-300">{row.choice_key || '—'}</td>
                          <td className="p-3 text-gray-300 max-w-xs">{row.answer_text || '—'}</td>
                          <td className="p-3 text-gray-500">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
