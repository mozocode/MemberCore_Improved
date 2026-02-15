import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type User = {
  id: string
  email?: string
  name?: string
  is_active?: boolean
  is_platform_admin?: boolean
  org_count?: number
  status?: string
  created_at?: string
  permissions?: { unlimited_pro_orgs?: boolean; skip_trial?: boolean }
}

function formatDate(s?: string) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString()
  } catch {
    return s
  }
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPermsModal, setShowPermsModal] = useState(false)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [permUser, setPermUser] = useState<User | null>(null)
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', is_platform_admin: false, unlimited_pro_orgs: false, skip_trial: false })
  const [permsForm, setPermsForm] = useState({ is_platform_admin: false, unlimited_pro_orgs: false, skip_trial: false })

  const load = () => adminApi.getUsers(search).then(setUsers)

  useEffect(() => {
    adminApi.getUsers(search).then(setUsers)
  }, [search])

  const toggleSelect = (id: string, isAdmin: boolean) => {
    if (isAdmin) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const nonAdmins = users.filter((u) => !u.is_platform_admin).map((u) => u.id)
    setSelected((prev) => (prev.size === nonAdmins.length ? new Set() : new Set(nonAdmins)))
  }

  const handleCreate = async () => {
    await adminApi.createUser(addForm)
    setShowAddModal(false)
    setAddForm({ name: '', email: '', password: '', is_platform_admin: false, unlimited_pro_orgs: false, skip_trial: false })
    load()
  }

  const handleUpdatePerms = async () => {
    if (!permUser) return
    await adminApi.updateUserPermissions(permUser.id, permsForm)
    setShowPermsModal(false)
    setPermUser(null)
    load()
  }

  const handleBulkDelete = async () => {
    await adminApi.bulkDeleteUsers(Array.from(selected))
    setSelected(new Set())
    setShowBulkConfirm(false)
    load()
  }

  const openPerms = (u: User) => {
    setPermUser(u)
    setPermsForm({
      is_platform_admin: u.is_platform_admin ?? false,
      unlimited_pro_orgs: u.permissions?.unlimited_pro_orgs ?? false,
      skip_trial: u.permissions?.skip_trial ?? false,
    })
    setShowPermsModal(true)
  }

  const nonAdminSelected = users.filter((u) => selected.has(u.id) && !u.is_platform_admin)

  return (
    <AdminLayout title="Users" subtitle="Platform user management">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs bg-[#0f1117] border-gray-700"
        />
        <Button onClick={() => setShowAddModal(true)} className="bg-white text-black hover:bg-gray-200">
          Add user
        </Button>
        {selected.size > 0 && (
          <Button variant="outline" onClick={() => setShowBulkConfirm(true)} className="border-red-600 text-red-400 hover:bg-red-600/20">
            Delete selected ({selected.size})
          </Button>
        )}
      </div>
      <div className="bg-[#1a1d24] rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="p-3 w-10">
                <input type="checkbox" checked={users.length > 0 && users.filter((u) => !u.is_platform_admin).length === selected.size} onChange={selectAll} />
              </th>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Organizations</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-b border-gray-800 ${selected.has(u.id) ? 'bg-blue-900/20' : ''}`}>
                <td className="p-3">
                  {!u.is_platform_admin && (
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggleSelect(u.id, u.is_platform_admin ?? false)}
                    />
                  )}
                </td>
                <td className="p-3 text-white">
                  {u.name || '—'}
                  {u.is_platform_admin && (
                    <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">Admin</span>
                  )}
                </td>
                <td className="p-3 text-gray-400">{u.email || '—'}</td>
                <td className="p-3 text-gray-400">{u.org_count ?? 0}</td>
                <td className="p-3">
                  <span className={u.is_active !== false ? 'text-green-400' : 'text-red-400'}>
                    {u.status ?? (u.is_active !== false ? 'Active' : 'Suspended')}
                  </span>
                </td>
                <td className="p-3 text-gray-500">{formatDate(u.created_at)}</td>
                <td className="p-3 flex gap-2">
                  <Button variant="outline" size="sm" className="border-gray-600" onClick={() => openPerms(u)}>
                    Permissions
                  </Button>
                  {u.is_active !== false ? (
                    <Button variant="outline" size="sm" className="border-yellow-600 text-yellow-400" onClick={async () => { await adminApi.suspendUser(u.id); load() }}>
                      Suspend
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="border-green-600 text-green-400" onClick={async () => { await adminApi.activateUser(u.id); load() }}>
                      Activate
                    </Button>
                  )}
                  {!u.is_platform_admin && (
                    <Button variant="outline" size="sm" className="border-red-600 text-red-400" onClick={async () => { if (confirm('Delete this user?')) { await adminApi.deleteUser(u.id); load() } }}>
                      Delete
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1d24] rounded-lg p-6 border border-gray-800 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Add user</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-gray-400">Name</Label>
                <Input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} className="bg-[#0f1117] border-gray-700 mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Email</Label>
                <Input type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} className="bg-[#0f1117] border-gray-700 mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Password</Label>
                <Input type="password" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} className="bg-[#0f1117] border-gray-700 mt-1" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={addForm.is_platform_admin} onChange={(e) => setAddForm((f) => ({ ...f, is_platform_admin: e.target.checked }))} />
                Platform admin
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={addForm.unlimited_pro_orgs} onChange={(e) => setAddForm((f) => ({ ...f, unlimited_pro_orgs: e.target.checked }))} />
                Unlimited pro orgs
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={addForm.skip_trial} onChange={(e) => setAddForm((f) => ({ ...f, skip_trial: e.target.checked }))} />
                Skip trial
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <Button onClick={handleCreate} className="bg-white text-black">Create</Button>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {showPermsModal && permUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1d24] rounded-lg p-6 border border-gray-800 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-2">Edit permissions</h3>
            <p className="text-sm text-gray-500 mb-4">{permUser.email}</p>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <input type="checkbox" checked={permsForm.is_platform_admin} onChange={(e) => setPermsForm((f) => ({ ...f, is_platform_admin: e.target.checked }))} />
              Platform admin
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <input type="checkbox" checked={permsForm.unlimited_pro_orgs} onChange={(e) => setPermsForm((f) => ({ ...f, unlimited_pro_orgs: e.target.checked }))} />
              Unlimited pro orgs
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-4">
              <input type="checkbox" checked={permsForm.skip_trial} onChange={(e) => setPermsForm((f) => ({ ...f, skip_trial: e.target.checked }))} />
              Skip trial
            </label>
            <div className="flex gap-2">
              <Button onClick={handleUpdatePerms} className="bg-white text-black">Save</Button>
              <Button variant="outline" onClick={() => { setShowPermsModal(false); setPermUser(null) }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1d24] rounded-lg p-6 border border-gray-800 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-2">Delete {nonAdminSelected.length} users?</h3>
            <p className="text-sm text-gray-500 mb-4">Platform admins are not selected. This action cannot be undone.</p>
            <div className="flex gap-2">
              <Button onClick={handleBulkDelete} className="bg-red-600 text-white hover:bg-red-700">Delete</Button>
              <Button variant="outline" onClick={() => setShowBulkConfirm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
