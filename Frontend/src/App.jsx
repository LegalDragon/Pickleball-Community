import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import MemberDashboard from './pages/MemberDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Profile from './pages/Profile'
import ProfileCompletion from './pages/ProfileCompletion'
import Notifications from './pages/Notifications'
import NotificationAck from './pages/NotificationAck'
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
import EventView from './pages/EventView'
import EventRegistration from './pages/EventRegistration'
import TournamentManage from './pages/TournamentManage'
import CourtPlanning from './pages/CourtPlanning'
import AutoScheduler from './pages/AutoScheduler'
import TournamentScheduleDashboard from './pages/TournamentScheduleDashboard'
import EventMassNotification from './pages/EventMassNotification'
import GameDayManage from './pages/GameDayManage'
import TournamentGameDay from './pages/TournamentGameDay'
import StaffDashboard from './pages/StaffDashboard'
import EventManage from './pages/EventManage'
import AdminEventManage from './pages/AdminEventManage'
import EventDashboard from './pages/EventDashboard'
import EventRunningAdmin from './pages/EventRunningAdmin'
import TDGameDayDashboard from './pages/TDGameDayDashboard'
import PlayerGameDay from './pages/PlayerGameDay'
import PlayerCheckIn from './pages/PlayerCheckIn'
import PlayerBadge from './pages/PlayerBadge'
import EventScoreboard from './pages/EventScoreboard'
import DrawingMonitor from './pages/DrawingMonitor'
import DivisionSchedule from './pages/DivisionSchedule'
import ScheduleOverview from './pages/ScheduleOverview'
import Venues from './pages/Venues'
import Clubs from './pages/Clubs'
import Leagues from './pages/Leagues'
import LeagueDetail from './pages/LeagueDetail'
import LeagueStructure from './pages/LeagueStructure'
import LeagueAdmin from './pages/LeagueAdmin'
import ObjectAssetTypesAdmin from './pages/ObjectAssetTypesAdmin'
import Blog from './pages/Blog'
import BlogAdmin from './pages/BlogAdmin'
import MyBlog from './pages/MyBlog'
import Friends from './pages/Friends'
import Messages from './pages/Messages'
import PlayerHistory from './pages/PlayerHistory'
import ProtectedRoute from './components/ProtectedRoute'
import ActiveEventNotices from './components/ActiveEventNotices'

import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AuthCallback from './pages/AuthCallback'
import ChatBot from './components/ChatBot'
import InstaGameList from './pages/InstaGame/InstaGameList'
import InstaGameCreate from './pages/InstaGame/InstaGameCreate'
import InstaGameMain from './pages/InstaGame/InstaGameMain'
import VideoRoomList from './pages/VideoRooms/VideoRoomList'
import VideoRoomJoin from './pages/VideoRooms/VideoRoomJoin'
import VideoRoomCall from './pages/VideoRooms/VideoRoomCall'
import MyTemplates from './pages/MyTemplates'
import NotificationSystemAdmin from './pages/NotificationSystemAdmin'


function App() {
  return (
    <>
      <ActiveEventNotices />
      <ChatBot />
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
      <Route path="/event/:eventId" element={<EventView />} />
      <Route path="/event/:eventId/register" element={<EventRegistration />} />
      <Route path="/tournament/:eventId/manage" element={
        <ProtectedRoute>
          <TournamentManage />
        </ProtectedRoute>
      } />
      <Route path="/event/:eventId/court-planning" element={
        <ProtectedRoute>
          <CourtPlanning />
        </ProtectedRoute>
      } />
      <Route path="/event/:eventId/auto-scheduler" element={
        <ProtectedRoute>
          <AutoScheduler />
        </ProtectedRoute>
      } />
      <Route path="/tournament/:eventId/schedule-dashboard" element={
        <ProtectedRoute>
          <TournamentScheduleDashboard />
        </ProtectedRoute>
      } />
      <Route path="/event/:eventId/notifications" element={
        <ProtectedRoute>
          <EventMassNotification />
        </ProtectedRoute>
      } />
      <Route path="/event/:eventId/staff-dashboard" element={
        <ProtectedRoute>
          <StaffDashboard />
        </ProtectedRoute>
      } />
      <Route path="/gameday/:eventId/manage" element={
        <ProtectedRoute>
          <GameDayManage />
        </ProtectedRoute>
      } />
      <Route path="/event/:eventId/manage" element={
        <ProtectedRoute>
          <EventManage />
        </ProtectedRoute>
      } />
      <Route path="/event/:eventId/admin-manage" element={
        <ProtectedRoute>
          <AdminEventManage />
        </ProtectedRoute>
      } />
      <Route path="/event-dashboard/:eventId" element={
        <ProtectedRoute>
          <EventDashboard />
        </ProtectedRoute>
      } />
      <Route path="/event-running/:eventId/admin" element={
        <ProtectedRoute>
          <EventRunningAdmin />
        </ProtectedRoute>
      } />
      <Route path="/event/:eventId/td-dashboard" element={
        <ProtectedRoute>
          <TDGameDayDashboard />
        </ProtectedRoute>
      } />
      <Route path="/event/:eventId/gameday" element={
        <ProtectedRoute>
          <PlayerGameDay />
        </ProtectedRoute>
      } />
      <Route path="/event/:eventId/game-day" element={
        <ProtectedRoute>
          <PlayerGameDay />
        </ProtectedRoute>
      } />
      <Route path="/event/:eventId/check-in" element={
        <ProtectedRoute>
          <PlayerCheckIn />
        </ProtectedRoute>
      } />
      {/* Public badge page - no auth required */}
      <Route path="/badge/:memberId" element={<PlayerBadge />} />
      <Route path="/event/:eventId/scoreboard" element={<EventScoreboard />} />
      <Route path="/event/:eventId/drawing" element={<DrawingMonitor />} />
      <Route path="/tournament/:eventId/schedules" element={
        <ProtectedRoute>
          <ScheduleOverview />
        </ProtectedRoute>
      } />
      <Route path="/tournament/:eventId/gameday" element={
        <ProtectedRoute>
          <TournamentGameDay />
        </ProtectedRoute>
      } />
      <Route path="/event/:eventId/division/:divisionId/schedule" element={<DivisionSchedule />} />
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

      {/* Video Rooms */}
      <Route path="/rooms" element={<VideoRoomList />} />
      <Route path="/rooms/:roomCode" element={<VideoRoomJoin />} />
      <Route path="/rooms/:roomCode/call" element={<VideoRoomCall />} />

      {/* My Blog - For writers to manage their posts */}
      <Route path="/my-blog" element={
        <ProtectedRoute>
          <MyBlog />
        </ProtectedRoute>
      } />

      {/* My Templates - For TDs to manage their phase templates */}
      <Route path="/my-templates" element={
        <ProtectedRoute>
          <MyTemplates />
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

      <Route path="/admin/asset-types" element={
        <ProtectedRoute role="Admin">
          <ObjectAssetTypesAdmin />
        </ProtectedRoute>
      } />

      <Route path="/admin/notification-system" element={
        <ProtectedRoute role="Admin">
          <NotificationSystemAdmin />
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

      {/* Public notification acknowledgment page */}
      <Route path="/notification/ack/:token" element={<NotificationAck />} />

      <Route path="/notifications" element={
        <ProtectedRoute>
          <Notifications />
        </ProtectedRoute>
      } />

      {/* Fallback 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}

export default App
