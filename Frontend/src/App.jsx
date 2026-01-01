import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import MemberDashboard from './pages/MemberDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import PlayerReview from './pages/PlayerReview'
import MyCertificate from './pages/MyCertificate'
import CertificationAdmin from './pages/CertificationAdmin'
import EventTypesAdmin from './pages/EventTypesAdmin'
import CourtTypesAdmin from './pages/CourtTypesAdmin'
import ClubMemberRolesAdmin from './pages/ClubMemberRolesAdmin'
import TeamUnitsAdmin from './pages/TeamUnitsAdmin'
import SkillLevelsAdmin from './pages/SkillLevelsAdmin'
import Faq from './pages/Faq'
import FaqAdmin from './pages/FaqAdmin'
import Events from './pages/Events'
import Courts from './pages/Courts'
import Clubs from './pages/Clubs'
import Blog from './pages/Blog'
import BlogAdmin from './pages/BlogAdmin'
import MyBlog from './pages/MyBlog'
import Friends from './pages/Friends'
import Messages from './pages/Messages'
import PublicProfile from './pages/PublicProfile'
import ProtectedRoute from './components/ProtectedRoute'

import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AuthCallback from './pages/AuthCallback'


function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Player Certification - Public Review */}
      <Route path="/review/:token" element={<PlayerReview />} />

      {/* Community Features - Public */}
      <Route path="/events" element={<Events />} />
      <Route path="/courts" element={<Courts />} />
      <Route path="/clubs" element={<Clubs />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/faq" element={<Faq />} />

      {/* My Blog - For writers to manage their posts */}
      <Route path="/my-blog" element={
        <ProtectedRoute>
          <MyBlog />
        </ProtectedRoute>
      } />

      {/* Protected Routes - Any Authenticated Member */}
      <Route path="/member/dashboard" element={
        <ProtectedRoute>
          <MemberDashboard />
        </ProtectedRoute>
      } />

      {/* Redirect old student dashboard route */}
      <Route path="/student/dashboard" element={<Navigate to="/member/dashboard" replace />} />

      {/* Member Certificate */}
      <Route path="/my-certificate" element={
        <ProtectedRoute>
          <MyCertificate />
        </ProtectedRoute>
      } />

      {/* Friends */}
      <Route path="/friends" element={
        <ProtectedRoute>
          <Friends />
        </ProtectedRoute>
      } />

      {/* Messages */}
      <Route path="/messages" element={
        <ProtectedRoute>
          <Messages />
        </ProtectedRoute>
      } />

      {/* Public Profile - View other users */}
      <Route path="/users/:userId" element={
        <ProtectedRoute>
          <PublicProfile />
        </ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin/dashboard" element={
        <ProtectedRoute role="Admin">
          <AdminDashboard />
        </ProtectedRoute>
      } />

      <Route path="/admin/certification" element={
        <ProtectedRoute role="Admin">
          <CertificationAdmin />
        </ProtectedRoute>
      } />

      <Route path="/admin/event-types" element={
        <ProtectedRoute role="Admin">
          <EventTypesAdmin />
        </ProtectedRoute>
      } />

      <Route path="/admin/court-types" element={
        <ProtectedRoute role="Admin">
          <CourtTypesAdmin />
        </ProtectedRoute>
      } />

      <Route path="/admin/club-member-roles" element={
        <ProtectedRoute role="Admin">
          <ClubMemberRolesAdmin />
        </ProtectedRoute>
      } />

      <Route path="/admin/team-units" element={
        <ProtectedRoute role="Admin">
          <TeamUnitsAdmin />
        </ProtectedRoute>
      } />

      <Route path="/admin/skill-levels" element={
        <ProtectedRoute role="Admin">
          <SkillLevelsAdmin />
        </ProtectedRoute>
      } />

      <Route path="/admin/blog" element={
        <ProtectedRoute role="Admin">
          <BlogAdmin />
        </ProtectedRoute>
      } />

      <Route path="/admin/faq" element={
        <ProtectedRoute role="Admin">
          <FaqAdmin />
        </ProtectedRoute>
      } />

      {/* Protected Routes - Any Authenticated User */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />

      <Route path="/notifications" element={
        <ProtectedRoute>
          <Notifications />
        </ProtectedRoute>
      } />

      {/* Fallback 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
