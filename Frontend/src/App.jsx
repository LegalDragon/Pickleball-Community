import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Marketplace from './pages/Marketplace'
import SessionScheduler from './pages/SessionScheduler'
import MaterialCreator from './pages/MaterialCreator'
import EditMaterial from './pages/EditMaterial'
import MaterialDetail from './pages/MaterialDetail'
import CourseCreator from './pages/CourseCreator'
import CourseEditor from './pages/CourseEditor'
import CourseDetail from './pages/CourseDetail'
import CoachProfile from './pages/CoachProfile'
import CoachDashboard from './pages/CoachDashboard'
import StudentDashboard from './pages/StudentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import BlogList from './pages/BlogList'
import BlogPost from './pages/BlogPost'
import BlogEditor from './pages/BlogEditor'
import BlogManagement from './pages/BlogManagement'
import PlayerReview from './pages/PlayerReview'
import MyCertificate from './pages/MyCertificate'
import CertificationAdmin from './pages/CertificationAdmin'
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
      <Route path="/Marketplace" element={<Marketplace />} />
      <Route path="/courses/:id" element={<CourseDetail />} />
      <Route path="/coaches/:id" element={<CoachProfile />} />
      <Route path="/coach/materials/edit/:id" element={<EditMaterial />} />
      <Route path="/coach/materials/:id" element={<MaterialDetail />} />

      {/* Blog Routes (Public) */}
      <Route path="/blog" element={<BlogList />} />
      <Route path="/blog/:slug" element={<BlogPost />} />

      {/* Player Certification - Public Review */}
      <Route path="/review/:token" element={<PlayerReview />} />


      {/* Protected Routes - Role Specific */}
      <Route path="/coach/dashboard" element={
        <ProtectedRoute role="Coach">
          <CoachDashboard />
        </ProtectedRoute>
      } />
<Route path="/SessionScheduler" element={
        <ProtectedRoute role="Coach">
          <SessionScheduler />
        </ProtectedRoute>
      } />
<Route path="/Coach/Materials/Create" element={
        <ProtectedRoute role="Coach">
          <MaterialCreator />
        </ProtectedRoute>
      } />

      <Route path="/coach/courses/create" element={
        <ProtectedRoute role="Coach">
          <CourseCreator />
        </ProtectedRoute>
      } />

      <Route path="/coach/courses/edit/:id" element={
        <ProtectedRoute role="Coach">
          <CourseEditor />
        </ProtectedRoute>
      } />

      {/* Coach Blog Routes */}
      <Route path="/coach/blog" element={
        <ProtectedRoute role="Coach">
          <BlogManagement />
        </ProtectedRoute>
      } />
      <Route path="/coach/blog/new" element={
        <ProtectedRoute role="Coach">
          <BlogEditor />
        </ProtectedRoute>
      } />
      <Route path="/coach/blog/edit/:id" element={
        <ProtectedRoute role="Coach">
          <BlogEditor />
        </ProtectedRoute>
      } />

      <Route path="/student/dashboard" element={
        <ProtectedRoute role="Student">
          <StudentDashboard />
        </ProtectedRoute>
      } />

      {/* Student Certificate */}
      <Route path="/my-certificate" element={
        <ProtectedRoute role="Student">
          <MyCertificate />
        </ProtectedRoute>
      } />

      <Route path="/admin/dashboard" element={
        <ProtectedRoute role="Admin">
          <AdminDashboard />
        </ProtectedRoute>
      } />

      {/* Admin Certification Configuration */}
      <Route path="/admin/certification" element={
        <ProtectedRoute role="Admin">
          <CertificationAdmin />
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