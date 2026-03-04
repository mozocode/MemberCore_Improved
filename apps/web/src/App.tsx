import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { PageSkeleton } from '@/components/PageSkeleton'
import { Loader2 } from 'lucide-react'

// Critical path: landing + auth (small initial bundle)
import { Landing } from '@/pages/Landing'
import { SignIn } from '@/pages/SignIn'
import { SignUp } from '@/pages/SignUp'

// Lazy-loaded routes (code-split; load on first visit)
const UserDashboard = lazy(() => import('@/pages/UserDashboard').then((m) => ({ default: m.UserDashboard })))
const CreateOrganization = lazy(() => import('@/pages/CreateOrganization').then((m) => ({ default: m.CreateOrganization })))
const JoinOrganization = lazy(() => import('@/pages/JoinOrganization').then((m) => ({ default: m.JoinOrganization })))
const OrgLayout = lazy(() => import('@/components/OrgLayout').then((m) => ({ default: m.OrgLayout })))
const OrgHome = lazy(() => import('@/pages/OrgHome').then((m) => ({ default: m.OrgHome })))
const OrgChat = lazy(() => import('@/pages/org/OrgChat').then((m) => ({ default: m.OrgChat })))
const OrgCalendar = lazy(() => import('@/pages/org/OrgCalendar').then((m) => ({ default: m.OrgCalendar })))
const OrgEventDetail = lazy(() => import('@/pages/org/OrgEventDetail').then((m) => ({ default: m.OrgEventDetail })))
const OrgTicketDetail = lazy(() => import('@/pages/org/OrgTicketDetail').then((m) => ({ default: m.OrgTicketDetail })))
const OrgDirectory = lazy(() => import('@/pages/org/OrgDirectory').then((m) => ({ default: m.OrgDirectory })))
const OrgMembers = lazy(() => import('@/pages/org/OrgMembers').then((m) => ({ default: m.OrgMembers })))
const OrgDues = lazy(() => import('@/pages/org/OrgDues').then((m) => ({ default: m.OrgDues })))
const OrgDocuments = lazy(() => import('@/pages/org/OrgDocuments').then((m) => ({ default: m.OrgDocuments })))
const OrgPolls = lazy(() => import('@/pages/org/OrgPolls').then((m) => ({ default: m.OrgPolls })))
const OrgMessages = lazy(() => import('@/pages/org/OrgMessages').then((m) => ({ default: m.OrgMessages })))
const OrgSettings = lazy(() => import('@/pages/org/OrgSettings').then((m) => ({ default: m.OrgSettings })))
const PublicDirectory = lazy(() => import('@/pages/PublicDirectory').then((m) => ({ default: m.PublicDirectory })))
const PublicEventDetail = lazy(() => import('@/pages/PublicEventDetail').then((m) => ({ default: m.PublicEventDetail })))
const PublicMyTicket = lazy(() => import('@/pages/PublicMyTicket').then((m) => ({ default: m.PublicMyTicket })))
const Privacy = lazy(() => import('@/pages/Privacy').then((m) => ({ default: m.default })))
const AssociationManagementSoftware = lazy(() => import('@/pages/AssociationManagementSoftware').then((m) => ({ default: m.default })))
const MotorcycleClubs = lazy(() => import('@/pages/MotorcycleClubs').then((m) => ({ default: m.default })))
const CompareWildApricot = lazy(() => import('@/pages/CompareWildApricot').then((m) => ({ default: m.default })))
const Nonprofits = lazy(() => import('@/pages/Nonprofits').then((m) => ({ default: m.default })))
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview').then((m) => ({ default: m.default })))
const AdminGrowth = lazy(() => import('@/pages/admin/AdminGrowth').then((m) => ({ default: m.default })))
const AdminActivation = lazy(() => import('@/pages/admin/AdminActivation').then((m) => ({ default: m.default })))
const AdminAcquisition = lazy(() => import('@/pages/admin/AdminAcquisition').then((m) => ({ default: m.default })))
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers').then((m) => ({ default: m.default })))
const AdminOrganizations = lazy(() => import('@/pages/admin/AdminOrganizations').then((m) => ({ default: m.default })))
const AdminVerification = lazy(() => import('@/pages/admin/AdminVerification').then((m) => ({ default: m.default })))
const AdminOrgTypeRequests = lazy(() => import('@/pages/admin/AdminOrgTypeRequests').then((m) => ({ default: m.default })))
const AdminBilling = lazy(() => import('@/pages/admin/AdminBilling').then((m) => ({ default: m.default })))
const AdminReports = lazy(() => import('@/pages/admin/AdminReports').then((m) => ({ default: m.default })))

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }
  if (!user) return <Navigate to="/signin" replace />
  return <>{children}</>
}

function OrgOrJoinByParam() {
  const { orgId } = useParams<{ orgId: string }>()
  const isUuid = orgId != null && UUID_REGEX.test(orgId)
  if (isUuid) {
    return (
      <ProtectedRoute>
        <OrgLayout />
      </ProtectedRoute>
    )
  }
  return <JoinOrganization slug={orgId ?? undefined} />
}

function AppRoutes() {
  const { pathname } = useLocation()
  if (pathname === '/signup' || pathname === '/signup/') {
    return <SignUp />
  }
  if (pathname === '/signin' || pathname === '/signin/') {
    return <SignIn />
  }
  // Ensure association page always renders (avoids catch-all redirect from trailing slash or cache)
  if (pathname === '/association-management-software' || pathname === '/association-management-software/') {
    if (pathname.endsWith('/')) {
      return <Navigate to="/association-management-software" replace />
    }
    return (
      <Suspense fallback={<PageSkeleton />}>
        <AssociationManagementSoftware />
      </Suspense>
    )
  }
  // Motorcycle clubs landing – same early handling so it never hits catch-all
  if (pathname === '/motorcycle-clubs' || pathname === '/motorcycle-clubs/') {
    if (pathname.endsWith('/')) {
      return <Navigate to="/motorcycle-clubs" replace />
    }
    return (
      <Suspense fallback={<PageSkeleton />}>
        <MotorcycleClubs />
      </Suspense>
    )
  }
  // Compare Wild Apricot – public comparison page
  if (pathname === '/compare/wild-apricot' || pathname === '/compare/wild-apricot/') {
    if (pathname.endsWith('/')) {
      return <Navigate to="/compare/wild-apricot" replace />
    }
    return (
      <Suspense fallback={<PageSkeleton />}>
        <CompareWildApricot />
      </Suspense>
    )
  }
  // Nonprofits landing page
  if (pathname === '/nonprofits' || pathname === '/nonprofits/') {
    if (pathname.endsWith('/')) {
      return <Navigate to="/nonprofits" replace />
    }
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Nonprofits />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={<PageSkeleton />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signin/" element={<Navigate to="/signin" replace />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/signup/" element={<Navigate to="/signup" replace />} />
      <Route
        path="/user-dashboard"
        element={
          <ProtectedRoute>
            <UserDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create-organization"
        element={
          <ProtectedRoute>
            <CreateOrganization />
          </ProtectedRoute>
        }
      />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/association-management-software" element={<AssociationManagementSoftware />} />
      <Route path="/association-management-software/" element={<Navigate to="/association-management-software" replace />} />
      <Route path="/motorcycle-clubs" element={<MotorcycleClubs />} />
      <Route path="/motorcycle-clubs/" element={<Navigate to="/motorcycle-clubs" replace />} />
      <Route path="/compare/wild-apricot" element={<CompareWildApricot />} />
      <Route path="/compare/wild-apricot/" element={<Navigate to="/compare/wild-apricot" replace />} />
      <Route path="/nonprofits" element={<Nonprofits />} />
      <Route path="/nonprofits/" element={<Navigate to="/nonprofits" replace />} />
      <Route path="/directory" element={<PublicDirectory />} />
      <Route path="/events/:eventId/my-ticket" element={<PublicMyTicket />} />
      <Route path="/events/:eventId" element={<PublicEventDetail />} />
      <Route path="/join" element={<JoinOrganization />} />
      <Route path="/join/:code" element={<JoinOrganization />} />
      <Route path="/super-admin" element={<ProtectedRoute><AdminOverview /></ProtectedRoute>} />
      <Route path="/super-admin/growth" element={<ProtectedRoute><AdminGrowth /></ProtectedRoute>} />
      <Route path="/super-admin/activation" element={<ProtectedRoute><AdminActivation /></ProtectedRoute>} />
      <Route path="/super-admin/acquisition" element={<ProtectedRoute><AdminAcquisition /></ProtectedRoute>} />
      <Route path="/super-admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/super-admin/organizations" element={<ProtectedRoute><AdminOrganizations /></ProtectedRoute>} />
      <Route path="/super-admin/verification" element={<ProtectedRoute><AdminVerification /></ProtectedRoute>} />
      <Route path="/super-admin/club-type-requests" element={<ProtectedRoute><AdminOrgTypeRequests /></ProtectedRoute>} />
      <Route path="/super-admin/billing" element={<ProtectedRoute><AdminBilling /></ProtectedRoute>} />
      <Route path="/super-admin/reports" element={<ProtectedRoute><AdminReports /></ProtectedRoute>} />
      <Route path="/org/:orgId" element={<OrgOrJoinByParam />}>
        <Route index element={<OrgHome />} />
        <Route path="chat" element={<OrgChat />} />
        <Route path="messages" element={<OrgMessages />} />
        <Route path="calendar" element={<OrgCalendar />} />
        <Route path="calendar/:eventId" element={<OrgEventDetail />} />
        <Route path="tickets/:ticketId" element={<OrgTicketDetail />} />
        <Route path="directory" element={<OrgDirectory />} />
        <Route path="members" element={<OrgMembers />} />
        <Route path="dues" element={<OrgDues />} />
        <Route path="documents" element={<OrgDocuments />} />
        <Route path="polls" element={<OrgPolls />} />
        <Route path="settings/*" element={<OrgSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  )
}
