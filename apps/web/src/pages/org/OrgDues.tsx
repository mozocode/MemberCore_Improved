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
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface DuesPlan {
  id: string
  name: string
  amount: number
  total_amount?: number
  due_date?: string
  frequency: string
  payment_option?: 'full_only' | 'custom_only' | 'installment_only'
  installment_months?: number
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
  dues_paid_in_full?: boolean
  total_paid: number
  plans: DuesPlan[]
  payment_history: Payment[]
  member_id: string | null
}

function isPaidInFullStatus(s: DuesStatus | null): boolean {
  if (!s) return false
  if (s.dues_paid_in_full === true) return true
  return (s.status || '').toLowerCase().trim() === 'paid_in_full'
}

export function OrgDues() {
  const { orgId } = useParams<{ orgId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState<DuesStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null)
  const [customAmountPlan, setCustomAmountPlan] = useState<DuesPlan | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [customAmountError, setCustomAmountError] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchStatus = async (): Promise<DuesStatus | null> => {
    if (!orgId) return null
    setLoading(true)
    try {
      const res = await api.get<DuesStatus>(`/dues/${orgId}/my-status`)
      setStatus(res.data)
      return res.data
    } catch {
      setStatus(null)
      return null
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
            fetchStatus().then((updated) => {
              const totalRequired = updated?.plans?.reduce((s, p) => s + (p.total_amount ?? p.amount ?? 0), 0) ?? 0
              const totalPaid = updated?.total_paid ?? 0
              const remaining = isPaidInFullStatus(updated)
                ? 0
                : Math.max(0, totalRequired - totalPaid)
              setSuccessMessage(`Payment successful. Remaining balance: $${remaining.toFixed(2)}`)
              setTimeout(() => setSuccessMessage(null), 6000)
            })
          }
        })
        .finally(() => {
          setSearchParams({})
        })
    }
  }, [orgId, searchParams, setSearchParams])

  const handlePayPlan = async (planId: string, amount?: number) => {
    setPayingPlanId(planId)
    try {
      const res = await api.post(`/payments/${orgId}/checkout`, {
        plan_id: planId,
        origin_url: window.location.href.split('?')[0],
        ...(amount != null && amount > 0 ? { amount } : {}),
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

  const openCustomAmountModal = (plan: DuesPlan) => {
    setCustomAmountPlan(plan)
    setCustomAmount('')
    setCustomAmountError('')
  }

  const submitCustomAmount = () => {
    if (!customAmountPlan || !orgId) return
    const planTotalAmt = planTotal(customAmountPlan)
    const paidForPlan =
      status?.payment_history?.filter((p) => p.plan_id === customAmountPlan.id).reduce((s, p) => s + p.amount, 0) ?? 0
    const remaining = isPaidInFullStatus(status) ? 0 : Math.max(0, planTotalAmt - paidForPlan)
    const installmentMin = customAmountPlan.amount
    const effectiveMin = Math.min(installmentMin, remaining)

    const raw = customAmount.trim().replace(/^\$/, '')
    const num = parseFloat(raw)
    if (raw === '' || Number.isNaN(num) || num <= 0) {
      setCustomAmountError('Enter a valid amount')
      return
    }
    if (num < effectiveMin) {
      setCustomAmountError(`Minimum payment: $${effectiveMin.toFixed(2)}`)
      return
    }
    if (num > remaining) {
      setCustomAmountError(`Cannot exceed remaining balance $${remaining.toFixed(2)}`)
      return
    }
    setCustomAmountError('')
    setCustomAmountPlan(null)
    setCustomAmount('')
    handlePayPlan(customAmountPlan.id, num)
  }

  const planTotal = (p: DuesPlan) => (p.total_amount != null ? p.total_amount : p.amount) || 0
  const totalRequired = status?.plans?.reduce((s, p) => s + planTotal(p), 0) ?? 0
  const paidInFull = isPaidInFullStatus(status)
  const displayRemaining = paidInFull ? 0 : Math.max(0, totalRequired - (status?.total_paid ?? 0))

  return (
    <div className="p-6 max-w-4xl mx-auto">
          {successMessage && (
            <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-green-400 text-sm">
              {successMessage}
            </div>
          )}
          {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                <FileText size={16} />
                Remaining
              </div>
              <div className="text-2xl font-semibold text-white">
                ${displayRemaining.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                {paidInFull || status?.status === 'paid' ? (
                  <Check size={16} className="text-green-500" />
                ) : (
                  <AlertCircle size={16} className="text-amber-500" />
                )}
                Status
              </div>
              <div
                className={cn(
                  'text-lg font-medium',
                  paidInFull || status?.status === 'paid' ? 'text-green-400' : 'text-amber-400',
                )}
              >
                {paidInFull
                  ? 'Paid In Full'
                  : status?.status === 'paid'
                    ? 'Paid'
                    : status?.status === 'partial'
                      ? 'Partial'
                      : status?.status === 'pending'
                        ? 'Pending'
                        : 'No dues'}
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
                  const planTotalAmt = planTotal(plan)
                  const paidForPlan = status.payment_history?.filter((p) => p.plan_id === plan.id).reduce((s, p) => s + p.amount, 0) ?? 0
                  const remaining = paidInFull ? 0 : Math.max(0, planTotalAmt - paidForPlan)
                  const isPaid = paidInFull || paidForPlan >= planTotalAmt
                  return (
                    <div key={plan.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-700 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                          <DollarSign size={20} className="text-zinc-400" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-white">{plan.name}</span>
                          <p className="text-sm text-zinc-500">
                            ${plan.amount.toFixed(2)} installment
                            {plan.installment_months ? ` x ${plan.installment_months} months` : ''}
                            {plan.total_amount != null ? ` • $${plan.total_amount.toFixed(2)} total` : ''}
                            {plan.due_date && ` • Due ${new Date(plan.due_date).toLocaleDateString()}`}
                          </p>
                          {!isPaid && (
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {plan.payment_option === 'custom_only' && (
                                <span>Minimum: ${plan.amount.toFixed(2)} • </span>
                              )}
                              <span className="text-amber-400 font-medium">Remaining: ${remaining.toFixed(2)}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-green-400 text-sm">
                            <Check size={16} />
                            Paid
                          </span>
                        ) : plan.payment_option === 'custom_only' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCustomAmountModal(plan)}
                            disabled={payingPlanId === plan.id}
                            className="w-full sm:w-auto bg-white text-black hover:bg-zinc-200"
                          >
                            <CreditCard size={16} className="shrink-0" />
                            <span className="ml-1">Pay Custom Amount (${plan.amount.toFixed(2)} minimum)</span>
                          </Button>
                        ) : plan.payment_option === 'installment_only' ? (
                          <Button
                            size="sm"
                            onClick={() => handlePayPlan(plan.id, Math.min(plan.amount, remaining))}
                            disabled={payingPlanId === plan.id}
                            className="w-full sm:w-auto bg-white text-black hover:bg-zinc-200"
                          >
                            {payingPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard size={16} />}
                            <span className="ml-1">
                              Pay installment (${Math.min(plan.amount, remaining).toFixed(2)})
                            </span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handlePayPlan(plan.id)}
                            disabled={payingPlanId === plan.id}
                            className="w-full sm:w-auto bg-white text-black hover:bg-zinc-200"
                          >
                            {payingPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard size={16} />}
                            <span className="ml-1">Pay full amount (${remaining.toFixed(2)})</span>
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
                      <span className="text-zinc-500 text-sm ml-2">via {p.payment_method === 'stripe' ? 'Stripe' : p.payment_method}</span>
                    </div>
                    <span className="text-zinc-500 text-sm">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Custom amount modal */}
      {customAmountPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setCustomAmountPlan(null); setCustomAmountError('') }} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Pay Custom Amount</h3>
              <button
                type="button"
                onClick={() => { setCustomAmountPlan(null); setCustomAmountError('') }}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-zinc-400 mb-4">{customAmountPlan.name}</p>
            <div className="space-y-2 mb-4">
              <label className="text-sm text-zinc-300">Amount</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setCustomAmountError('') }}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              <p className="text-xs text-zinc-500">
                Minimum payment: ${Math.min(customAmountPlan.amount, Math.max(0, planTotal(customAmountPlan) - (status?.payment_history?.filter((p) => p.plan_id === customAmountPlan.id).reduce((s, p) => s + p.amount, 0) ?? 0))).toFixed(2)}
              </p>
              <p className="text-xs text-zinc-500">You can pay more anytime to reduce your balance.</p>
              {customAmountError && <p className="text-sm text-red-400">{customAmountError}</p>}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setCustomAmountPlan(null); setCustomAmountError('') }}
                className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
              >
                Cancel
              </Button>
              <Button type="button" onClick={submitCustomAmount} className="flex-1 bg-white text-black hover:bg-zinc-200">
                Submit Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
