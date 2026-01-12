import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import MemberDashboard from './pages/MemberDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Profile from './pages/Profile'
import ProfileCompletion from './pages/ProfileCompletion'
import Notifications from './pages/Notifications'
import PlayerReview from './pages/PlayerReview'
import MyCertificate from './pages/MyCertificate'
import CertificationAdmin from './pages/CertificationAdmin'
import EventTypesAdmin from './pages/EventTypesAdmin'
import VenueTypesAdmin from './pages/VenueTypesAdmin'
import ClubMemberRolesAdmin from './pages/ClubMemberRolesAdmin'
import TeamUnitsAdmin from './pages/TeamUnitsAdmin'
import SkillLevelsAdmin from './pages/SkillLevelsAdmin'
import Faq from './pages/Faq'
import FaqAdmin from './pages/FaqAdmin'
import Features from './pages/Features'
import FeaturesAdmin from './pages/FeaturesAdmin'
import Feedback from './pages/Feedback'
import FeedbackAdmin from './pages/FeedbackAdmin'
import Events from './pages/Events'
import TournamentManage from './pages/TournamentManage'
import GameDayManage from './pages/GameDayManage'
import Venues from './pages/Venues'
import Clubs from './pages/Clubs'
import Leagues from './pages/Leagues'
import LeagueDetail from './pages/LeagueDetail'
import LeagueStructure from './pages/LeagueStructure'
import LeagueAdmin from './pages/LeagueAdmin'
import Blog from './pages/Blog'
import BlogAdmin from './pages/BlogAdmin'
import MyBlog from './pages/MyBlog'
import Friends from './pages/Friends'
import Messages from './pages/Messages'
import PublicProfile from './pages/PublicProfile'
import PlayerHistory from './pages/PlayerHistory'
import ProtectedRoute from './components/ProtectedRoute'

import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AuthCallback from './pages/AuthCallback'
import InstaGameList from './pages/InstaGame/InstaGameList'
import InstaGameCreate from './pages/InstaGame/InstaGameCreate'
import InstaGameMain from './pages/InstaGame/InstaGameMain'


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
      <Route path="/tournament/:eventId/manage" element={
        <ProtectedRoute>
          <TournamentManage />
        </ProtectedRoute>
      } />
      <Route path="/gameday/:eventId/manage" element={
        <ProtectedRoute>
          <GameDayManage />
        </ProtectedRoute>
      } />
      <Route path="/venues" element={<Venues />} />
      <Route path="/courts" element={<Navigate to="/venues" replace />} />
      <Route path="/clubs" element={<Clubs />} />
      <Route path="/leagues" element={<Leagues />} />
      <Route path="/leagues/structure" element={<LeagueStructure />} />
      <Route path="/leagues/:id" element={<LeagueDetail />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/features" element={<Features />} />
      <Route path="/feedback" element={<Feedback />} />

      {/* InstaGame - Pickup Games */}
      <Route path="/instagame" element={
        <ProtectedRoute>
          <InstaGameList />
        </ProtectedRoute>
      } />
      <Route path="/instagame/create" element={
        <ProtectedRoute>
          <InstaGameCreate />
        </ProtectedRoute>
      } />
      <Route path="/instagame/join/:code" element={
        <ProtectedRoute>
          <InstaGameList />
        </ProtectedRoute>
      } />
      <Route path="/instagame/:id" element={
        <ProtectedRoute>
          <InstaGameMain />
        </ProtectedRoute>
      } />

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

      {/* Player History - Awards, Games, Ratings */}
      <Route path="/history" element={
        <ProtectedRoute>
          <PlayerHistory />
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

      <Route path="/admin/venue-types" element={
        <ProtectedRoute role="Admin">
          <VenueTypesAdmin />
        </ProtectedRoute>
      } />
      <Route path="/admin/court-types" element={<Navigate to="/admin/venue-types" replace />} />

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

      <Route path="/admin/features" element={
        <ProtectedRoute role="Admin">
          <FeaturesAdmin />
        </ProtectedRoute>
      } />

      <Route path="/admin/feedback" element={
        <ProtectedRoute role="Admin">
          <FeedbackAdmin />
        </ProtectedRoute>
      } />

      <Route path="/admin/leagues" element={
        <ProtectedRoute role="Admin">
          <LeagueAdmin />
        </ProtectedRoute>
      } />

      {/* Profile Completion - First-time users must complete their profile */}
      <Route path="/complete-profile" element={
        <ProtectedRoute skipProfileCheck>
          <ProfileCompletion />
        </ProtectedRoute>
      } />

      {/* Protected Routes - Any Authenticated User */}
      <Route path="/profile" element={
        <ProtectedRoute skipProfileCheck>
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
