import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Landing } from '@/pages/Landing'
import { SignIn } from '@/pages/SignIn'
import { SignUp } from '@/pages/SignUp'
import { UserDashboard } from '@/pages/UserDashboard'
import { CreateOrganization } from '@/pages/CreateOrganization'
import { JoinOrganization } from '@/pages/JoinOrganization'
import { OrgHome } from '@/pages/OrgHome'
import { OrgLayout } from '@/components/OrgLayout'
import { OrgChat } from '@/pages/org/OrgChat'
import { OrgCalendar } from '@/pages/org/OrgCalendar'
import { OrgEventDetail } from '@/pages/org/OrgEventDetail'
import { OrgTicketDetail } from '@/pages/org/OrgTicketDetail'
import { OrgDirectory } from '@/pages/org/OrgDirectory'
import { OrgMembers } from '@/pages/org/OrgMembers'
import { OrgDues } from '@/pages/org/OrgDues'
import { OrgDocuments } from '@/pages/org/OrgDocuments'
import { OrgPolls } from '@/pages/org/OrgPolls'
import { OrgMessages } from '@/pages/org/OrgMessages'
import { OrgSettings } from '@/pages/org/OrgSettings'
import { PublicDirectory } from '@/pages/PublicDirectory'
import { PublicEventDetail } from '@/pages/PublicEventDetail'
import {
  AdminOverview,
  AdminGrowth,
  AdminActivation,
  AdminAcquisition,
  AdminUsers,
  AdminOrganizations,
  AdminVerification,
  AdminOrgTypeRequests,
  AdminBilling,
  AdminReports,
} from '@/pages/admin'
import { Loader2 } from 'lucide-react'

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
  return (
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
      <Route path="/directory" element={<PublicDirectory />} />
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
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
