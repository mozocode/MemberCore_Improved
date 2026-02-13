import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Plus, Users, LogOut, Loader2, MoreVertical, UserPlus, Building2 } from 'lucide-react'

interface Organization {
  id: string
  name: string
  type: string
  icon_color?: string
  logo?: string
  public_slug?: string
}

export function UserDashboard() {
  const { user, signout } = useAuth()
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .get('/organizations')
      .then((res) => setOrgs(res.data))
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link to="/" className="text-xl font-bold">
          MemberCore
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">{user?.email}</span>
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-lg"
              aria-label="Menu"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl z-50">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/join')
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  <UserPlus className="h-4 w-4" />
                  Join an organization
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/create-organization')
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  <Building2 className="h-4 w-4" />
                  Create an organization
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    signout()
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 hover:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Your Organizations</h1>
          <Link to="/create-organization">
            <Button>
              <Plus className="h-4 w-4" />
              Create Organization
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : orgs.length === 0 ? (
          <Card className="border-zinc-800">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="h-16 w-16 text-zinc-600 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No organizations yet</h2>
              <p className="text-zinc-400 mb-6 text-center max-w-sm">
                Create your first organization to start managing members, events, and more.
              </p>
              <Link to="/create-organization">
                <Button>Create Organization</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {orgs.map((org) => (
              <Link key={org.id} to={`/org/${org.id}`}>
                <Card className="border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center gap-4">
                    {org.logo ? (
                      <img
                        src={org.logo}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div
                        className="h-12 w-12 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: org.icon_color || '#3f3f46' }}
                      >
                        <Users className="h-6 w-6" />
                      </div>
                    )}
                    <div>
                      <CardTitle>{org.name}</CardTitle>
                      <p className="text-sm text-zinc-400">{org.type}</p>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
