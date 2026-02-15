import axios from 'axios'

const API_URL = import.meta.env.VITE_BACKEND_URL || '/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s to allow backend/Firebase cold start
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      if (!url.includes('/auth/signin') && !url.includes('/auth/signup')) {
        localStorage.removeItem('token')
        window.location.href = '/signin'
      }
    }
    return Promise.reject(error)
  }
)

// --- Super Admin API (all under /admin, require platform admin) ---
const admin = (path: string, opts?: { method?: string; body?: unknown }) => {
  const config: { method: string; url: string; data?: unknown } = {
    method: opts?.method || 'GET',
    url: `/admin${path}`,
  }
  if (opts?.body !== undefined) config.data = opts.body
  return api.request(config).then((r) => r.data)
}

export const adminApi = {
  verifyAccess: () => admin('/verify'),
  getOverview: () => admin('/overview'),
  getUsers: (search = '') => admin(`/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getUserDetails: (userId: string) => admin(`/users/${userId}`),
  createUser: (data: { name: string; email: string; password: string; is_platform_admin?: boolean; unlimited_pro_orgs?: boolean; skip_trial?: boolean }) =>
    admin('/users/create', { method: 'POST', body: data }),
  updateUserPermissions: (userId: string, perms: { is_platform_admin?: boolean; unlimited_pro_orgs?: boolean; skip_trial?: boolean }) =>
    admin(`/users/${userId}/permissions`, { method: 'PUT', body: perms }),
  suspendUser: (userId: string) => admin(`/users/${userId}/suspend`, { method: 'PUT' }),
  activateUser: (userId: string) => admin(`/users/${userId}/activate`, { method: 'PUT' }),
  deleteUser: (userId: string) => admin(`/users/${userId}`, { method: 'DELETE' }),
  bulkDeleteUsers: (userIds: string[]) => admin('/users/bulk-delete', { method: 'POST', body: { user_ids: userIds } }),
  getOrganizations: (params: { search?: string; include_suspended?: boolean; include_deleted?: boolean; verified_filter?: string; plan_filter?: string } = {}) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)) })
    return admin(`/organizations${q.toString() ? `?${q}` : ''}`)
  },
  verifyOrg: (orgId: string) => admin(`/organizations/${orgId}/verify`, { method: 'PUT' }),
  unverifyOrg: (orgId: string) => admin(`/organizations/${orgId}/unverify`, { method: 'PUT' }),
  suspendOrg: (orgId: string) => admin(`/organizations/${orgId}/suspend`, { method: 'PUT' }),
  unsuspendOrg: (orgId: string) => admin(`/organizations/${orgId}/unsuspend`, { method: 'PUT' }),
  deleteOrg: (orgId: string) => admin(`/organizations/${orgId}`, { method: 'DELETE' }),
  bulkDeleteOrgs: (orgIds: string[]) => admin('/organizations/bulk-delete', { method: 'POST', body: { org_ids: orgIds } }),
  getGrowth: (window = '6months') => admin(`/growth?window=${window}`),
  getActivation: (window = '14days') => admin(`/activation?window=${window}`),
  getAcquisition: () => admin('/acquisition'),
  getVerificationQueue: () => admin('/verification'),
  getOrgTypeRequests: (statusFilter = 'pending') => admin(`/org-type-requests?status_filter=${statusFilter}`),
  approveOrgTypeRequest: (requestId: string) => admin(`/org-type-requests/${requestId}/approve`, { method: 'PUT' }),
  rejectOrgTypeRequest: (requestId: string) => admin(`/org-type-requests/${requestId}/reject`, { method: 'PUT' }),
  getBilling: (params: { search?: string; plan_filter?: string } = {}) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)) })
    return admin(`/billing${q.toString() ? `?${q}` : ''}`)
  },
  getReportsAvailable: () => admin('/reports/available'),
}
