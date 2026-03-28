import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'

function StatCard({
  label,
  value,
  subtitle,
  trend,
}: {
  label: string
  value: React.ReactNode
  subtitle?: string
  trend?: string
}) {
  return (
    <div className="bg-[#1a1d24] rounded-lg p-4 border border-gray-800">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      {trend && <div className="text-xs text-green-500 mt-1">{trend}</div>}
    </div>
  )
}

export default function AdminOverview() {
  const [stats, setStats] = useState<{
    pro_mrr?: number
    pro_orgs_count?: number
    trial_to_pro_converted?: number
    trial_to_pro_trials?: number
    activated_orgs_percent?: number
    activated_orgs_new?: number
    arpa?: number
    users?: { total?: number; last_7_days?: number }
    clubs?: { total?: number; last_7_days?: number }
    events?: { total?: number }
    paid_payments_30d?: { count?: number; amount?: number }
    platform_volume_30d?: {
      count?: number
      amount?: number
      dues_count?: number
      dues_amount?: number
      tickets_count?: number
      tickets_amount?: number
    }
    platform_volume_all_time?: {
      count?: number
      amount?: number
      dues_count?: number
      dues_amount?: number
      tickets_count?: number
      tickets_amount?: number
    }
    pro_churn_30d?: number | null
    pro_churn_90d?: number | null
  } | null>(null)

  useEffect(() => {
    adminApi.getOverview().then(setStats)
  }, [])

  return (
    <AdminLayout title="Overview" subtitle="Platform overview and key metrics">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Pro MRR"
            value={`$${(stats?.pro_mrr ?? 0).toFixed(2)}`}
            subtitle={`${stats?.pro_orgs_count ?? 0} pro orgs`}
          />
          <StatCard
            label="Trial → Pro (14d)"
            value={`${stats?.trial_to_pro_converted ?? 0} / ${stats?.trial_to_pro_trials ?? 0}`}
            subtitle="conversions / trials"
          />
          <StatCard
            label="Activated orgs"
            value={`${stats?.activated_orgs_percent ?? 0}%`}
            subtitle={`${stats?.activated_orgs_new ?? 0} new this period`}
          />
          <StatCard
            label="ARPA"
            value={`$${(stats?.arpa ?? 0).toFixed(2)}`}
            subtitle="avg revenue per account"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Users"
            value={stats?.users?.total ?? '—'}
            subtitle={`+${stats?.users?.last_7_days ?? 0} last 7 days`}
          />
          <StatCard
            label="Clubs"
            value={stats?.clubs?.total ?? '—'}
            subtitle={`+${stats?.clubs?.last_7_days ?? 0} last 7 days`}
          />
          <StatCard
            label="Events"
            value={stats?.events?.total ?? '—'}
            subtitle="across platform"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Platform Volume (30d)"
            value={`${stats?.platform_volume_30d?.count ?? 0} / $${(stats?.platform_volume_30d?.amount ?? 0).toFixed(2)}`}
            subtitle={`dues $${(stats?.platform_volume_30d?.dues_amount ?? 0).toFixed(2)} • tickets $${(stats?.platform_volume_30d?.tickets_amount ?? 0).toFixed(2)}`}
          />
          <StatCard
            label="Platform Volume (All time)"
            value={`${stats?.platform_volume_all_time?.count ?? 0} / $${(stats?.platform_volume_all_time?.amount ?? 0).toFixed(2)}`}
            subtitle={`dues $${(stats?.platform_volume_all_time?.dues_amount ?? 0).toFixed(2)} • tickets $${(stats?.platform_volume_all_time?.tickets_amount ?? 0).toFixed(2)}`}
          />
          <StatCard label="Pro Churn (30d)" value={stats?.pro_churn_30d ?? '—'} />
          <StatCard label="Pro Churn (90d)" value={stats?.pro_churn_90d ?? '—'} />
          <StatCard
            label="Paid Payments (30d)"
            value={`${stats?.paid_payments_30d?.count ?? 0} / $${(stats?.paid_payments_30d?.amount ?? 0).toFixed(2)}`}
            subtitle="count / amount"
          />
        </div>
      </div>
    </AdminLayout>
  )
}
