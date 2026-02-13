import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import { OrgDirectory } from '@/pages/org/OrgDirectory'
import { OrgMembers } from '@/pages/org/OrgMembers'
import { OrgDues } from '@/pages/org/OrgDues'
import { OrgDocuments } from '@/pages/org/OrgDocuments'
import { OrgPolls } from '@/pages/org/OrgPolls'
import { OrgSettings } from '@/pages/org/OrgSettings'
import { Loader2 } from 'lucide-react'

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
      <Route
        path="/join"
        element={
          <ProtectedRoute>
            <JoinOrganization />
          </ProtectedRoute>
        }
      />
      <Route
        path="/join/:code"
        element={
          <ProtectedRoute>
            <JoinOrganization />
          </ProtectedRoute>
        }
      />
      <Route
        path="/org/:orgId"
        element={
          <ProtectedRoute>
            <OrgLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OrgHome />} />
        <Route path="chat" element={<OrgChat />} />
        <Route path="calendar" element={<OrgCalendar />} />
        <Route path="calendar/:eventId" element={<OrgEventDetail />} />
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
