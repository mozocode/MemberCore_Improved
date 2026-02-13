import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  DollarSign,
  Loader2,
  Check,
  AlertCircle,
  CreditCard,
  Calendar,
  FileText,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DuesPlan {
  id: string
  name: string
  amount: number
  due_date?: string
  frequency: string
}

interface Payment {
  id: string
  amount: number
  payment_method: string
  plan_id?: string
  created_at: string
}

interface DuesStatus {
  status: string
  total_paid: number
  plans: DuesPlan[]
  payment_history: Payment[]
  member_id: string | null
}

export function OrgDues() {
  const { orgId } = useParams<{ orgId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState<DuesStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null)

  const fetchStatus = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const res = await api.get<DuesStatus>(`/dues/${orgId}/my-status`)
      setStatus(res.data)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [orgId])

  // Handle checkout return
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const success = searchParams.get('success')
    if (orgId && sessionId && success === '1') {
      api
        .get(`/payments/${orgId}/checkout/status/${sessionId}`)
        .then((r) => {
          if (r.data?.status === 'completed') {
            fetchStatus()
          }
        })
        .finally(() => {
          setSearchParams({})
        })
    }
  }, [orgId, searchParams, setSearchParams])

  const handlePayPlan = async (planId: string) => {
    setPayingPlanId(planId)
    try {
      const res = await api.post(`/payments/${orgId}/checkout`, {
        plan_id: planId,
        origin_url: window.location.href.split('?')[0],
      })
      if (res.data?.checkout_url) {
        window.location.href = res.data.checkout_url
      } else {
        setPayingPlanId(null)
      }
    } catch {
      setPayingPlanId(null)
    }
  }

  const totalRequired = status?.plans?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">My Dues</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                <DollarSign size={16} />
                Total paid
              </div>
              <div className="text-2xl font-semibold text-white">${(status?.total_paid ?? 0).toFixed(2)}</div>
            </div>
            <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                <FileText size={16} />
                Required
              </div>
              <div className="text-2xl font-semibold text-white">${totalRequired.toFixed(2)}</div>
            </div>
            <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                {status?.status === 'paid_in_full' || status?.status === 'paid' ? (
                  <Check size={16} className="text-green-500" />
                ) : (
                  <AlertCircle size={16} className="text-amber-500" />
                )}
                Status
              </div>
              <div
                className={cn(
                  'text-lg font-medium',
                  status?.status === 'paid_in_full' || status?.status === 'paid' ? 'text-green-400' : 'text-amber-400',
                )}
              >
                {status?.status === 'paid_in_full' ? 'Paid in full' : status?.status === 'paid' ? 'Paid' : status?.status === 'pending' ? 'Pending' : 'No dues'}
              </div>
            </div>
          </div>

          {/* Plans */}
          {status?.plans && status.plans.length > 0 && (
            <section>
              <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <Calendar size={20} />
                Dues Plans
              </h3>
              <div className="space-y-2">
                {status.plans.map((plan) => {
                  const paidForPlan = status.payment_history?.filter((p) => p.plan_id === plan.id).reduce((s, p) => s + p.amount, 0) ?? 0
                  const remaining = Math.max(0, plan.amount - paidForPlan)
                  const isPaid = remaining <= 0
                  return (
                    <div key={plan.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-700">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <DollarSign size={20} className="text-zinc-400" />
                        </div>
                        <div>
                          <span className="font-medium text-white">{plan.name}</span>
                          <p className="text-sm text-zinc-500">
                            ${plan.amount.toFixed(2)}
                            {plan.due_date && ` • Due ${new Date(plan.due_date).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-green-400 text-sm">
                            <Check size={16} />
                            Paid
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handlePayPlan(plan.id)}
                            disabled={payingPlanId === plan.id}
                            className="bg-white text-black hover:bg-zinc-200"
                          >
                            {payingPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard size={16} />}
                            <span className="ml-1">Pay ${remaining.toFixed(2)}</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {(!status?.plans || status.plans.length === 0) && (
            <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-8 text-center">
              <DollarSign className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No dues plans</p>
            </div>
          )}

          {/* Payment history */}
          {status?.payment_history && status.payment_history.length > 0 && (
            <section>
              <h3 className="text-lg font-medium text-white mb-3">Payment History</h3>
              <div className="space-y-2">
                {status.payment_history.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-700">
                    <div>
                      <span className="text-white font-medium">${p.amount.toFixed(2)}</span>
                      <span className="text-zinc-500 text-sm ml-2">via {p.payment_method === 'stripe' ? 'Card' : p.payment_method}</span>
                    </div>
                    <span className="text-zinc-500 text-sm">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

    </div>
  )
}
