import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Trophy, Users, Clock, MapPin, CheckCircle2,
  ClipboardList, Radio, Settings, Bell, ChevronRight, Loader2,
  Filter, RefreshCw, Play, Pause, AlertTriangle, Search,
  Activity, BarChart3, Target
} from 'lucide-react';
import { tournamentApi, eventStaffApi, gameDayApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Tab Components (defined below)
import GameDayScoreboard from '../components/tournament/GameDayScoreboard';
import GameDayScoreEntry from '../components/tournament/GameDayScoreEntry';
import GameDayNotifications from '../components/tournament/GameDayNotifications';
import GameDayAdvancement from '../components/tournament/GameDayAdvancement';
import GameDayCheckIn from '../components/tournament/GameDayCheckIn';
import TournamentProgressTracker from '../components/tournament/TournamentProgressTracker';
import GameDayActivityFeed from '../components/tournament/GameDayActivityFeed';
import CourtUtilizationPanel from '../components/tournament/CourtUtilizationPanel';

/**
 * TournamentGameDay - Live tournament execution page
 * Role-based tabs with scoreboard, score entry, notifications, and advancement controls
 */
export default function TournamentGameDay() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [activeTab, setActiveTab] = useState('scoreboard');
  const [error, setError] = useState(null);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    loadData();
  }, [eventId]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadData(true); // silent refresh
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, eventId]);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      // Load event dashboard and permissions in parallel
      const [dashboardRes, permissionsRes] = await Promise.all([
        tournamentApi.getDashboard(eventId),
        eventStaffApi.getDashboard(eventId).catch(() => ({ success: false }))
      ]);

      if (dashboardRes.success) {
        setEvent(dashboardRes.data);
      } else {
        setError('Failed to load event data');
      }

      // Extract permissions from staff dashboard or default for organizers
      if (permissionsRes.success) {
        setPermissions(permissionsRes.data.permissions);
      } else {
        // Check if user is organizer
        if (dashboardRes.data?.isOrganizer || dashboardRes.data?.organizedByUserId === user?.id) {
          setPermissions({
            canRecordScores: true,
            canCheckInPlayers: true,
            canManageCourts: true,
            canManageSchedule: true,
            canViewAllData: true,
            canFullyManageEvent: true,
            isOrganizer: true
          });
        } else {
          // Public view - only scoreboard
          setPermissions({
            canRecordScores: false,
            canCheckInPlayers: false,
            canManageCourts: false,
            canManageSchedule: false,
            canViewAllData: false,
            canFullyManageEvent: false,
            isOrganizer: false
          });
        }
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading game day data:', err);
      if (!silent) setError('Failed to load event data');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Quick stats for header bar
  const [quickStats, setQuickStats] = useState(null);

  // Load quick stats periodically
  const loadQuickStats = useCallback(async () => {
    try {
      const res = await gameDayApi.getQuickStats(eventId);
      if (res.success) setQuickStats(res.data);
    } catch (err) {
      // Silent fail for quick stats
    }
  }, [eventId]);

  useEffect(() => {
    if (permissions?.isOrganizer) {
      loadQuickStats();
      const interval = setInterval(loadQuickStats, 15000);
      return () => clearInterval(interval);
    }
  }, [permissions, loadQuickStats]);

  // Define available tabs based on permissions
  const getTabs = () => {
    const tabs = [
      { id: 'scoreboard', label: 'Scoreboard', icon: Trophy, always: true }
    ];

    if (permissions?.isOrganizer || permissions?.canFullyManageEvent) {
      tabs.push({ id: 'progress', label: 'Progress', icon: Target });
    }

    if (permissions?.canCheckInPlayers || permissions?.isOrganizer) {
      tabs.push({ id: 'checkin', label: 'Check-in', icon: Users });
    }

    if (permissions?.canRecordScores || permissions?.isOrganizer) {
      tabs.push({ id: 'scores', label: 'Score Entry', icon: ClipboardList });
    }

    if (permissions?.canManageSchedule || permissions?.isOrganizer) {
      tabs.push({ id: 'advancement', label: 'Advancement', icon: ChevronRight });
    }

    if (permissions?.isOrganizer || permissions?.canFullyManageEvent) {
      tabs.push({ id: 'courts', label: 'Courts', icon: BarChart3 });
    }

    if (permissions?.isOrganizer || permissions?.canFullyManageEvent) {
      tabs.push({ id: 'activity', label: 'Activity', icon: Activity });
    }

    return tabs;
  };

  const tabs = getTabs();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-500">Loading game day...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-6 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/tournament/${eventId}/manage`)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                  {event?.eventName || 'Tournament'} - Game Day
                </h1>
                <p className="text-xs text-gray-500">
                  Live tournament execution • Last updated: {lastRefresh.toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Stats Badges (for organizers) */}
              {quickStats && (
                <div className="hidden md:flex items-center gap-2 mr-2">
                  {quickStats.activeGames > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      <Play className="w-3 h-3" /> {quickStats.activeGames} live
                    </span>
                  )}
                  <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {quickStats.completedEncounters}/{quickStats.totalEncounters}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    <MapPin className="w-3 h-3" /> {quickStats.availableCourts}/{quickStats.totalCourts}
                  </span>
                </div>
              )}

              {/* Auto-refresh toggle */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                  autoRefresh
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {autoRefresh ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                Auto-refresh
              </button>

              {/* Manual refresh */}
              <button
                onClick={() => loadData()}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                title="Refresh now"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.debug && (
                  <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                    DEBUG
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'scoreboard' && (
          <GameDayScoreboard
            eventId={eventId}
            event={event}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'checkin' && (
          <GameDayCheckIn
            eventId={eventId}
            event={event}
            permissions={permissions}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'scores' && (
          <GameDayScoreEntry
            eventId={eventId}
            event={event}
            permissions={permissions}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'advancement' && (
          <GameDayAdvancement
            eventId={eventId}
            event={event}
            permissions={permissions}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'progress' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TournamentProgressTracker
                eventId={eventId}
                onDivisionClick={(divId) => {
                  // Could navigate to division schedule
                  console.log('Division clicked:', divId);
                }}
              />
            </div>
            <div>
              <GameDayActivityFeed
                eventId={eventId}
                maxItems={15}
                compact={true}
              />
            </div>
          </div>
        )}

        {activeTab === 'courts' && (
          <CourtUtilizationPanel
            eventId={eventId}
            showControls={permissions?.isOrganizer || permissions?.canManageCourts}
            onCourtStatusChange={() => loadData(true)}
          />
        )}

        {activeTab === 'activity' && (
          <GameDayActivityFeed
            eventId={eventId}
            maxItems={50}
            autoRefresh={autoRefresh}
          />
        )}

        {activeTab === 'notifications' && (
          <GameDayNotifications
            eventId={eventId}
            event={event}
            debugMode={true}
          />
        )}
      </div>
    </div>
  );
}
