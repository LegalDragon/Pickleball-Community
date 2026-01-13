import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users, LayoutGrid, Play, Settings, ChevronDown, ChevronUp, MessageSquare,
  Clock, CheckCircle, XCircle, RefreshCw, ArrowLeft, Send, AlertTriangle,
  Calendar, MapPin, Trophy, ListOrdered, Zap, User, Bell
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { getSharedAssetUrl } from '../services/api';

// API endpoints
const eventRunningApi = {
  getAdminDashboard: (eventId) => api.get(`/event-running/${eventId}/admin`),
  updateEventStatus: (eventId, data) => api.put(`/event-running/${eventId}/status`, data),
  queueMatch: (eventId, data) => api.post(`/event-running/${eventId}/queue-match`, data),
  assignCourt: (eventId, matchId, data) => api.put(`/event-running/${eventId}/matches/${matchId}/court`, data),
  startMatch: (eventId, matchId) => api.post(`/event-running/${eventId}/matches/${matchId}/start`),
  editGameScore: (eventId, gameId, data) => api.put(`/event-running/${eventId}/games/${gameId}/score`, data),
  updatePlayerStatus: (eventId, playerId, data) => api.put(`/event-running/${eventId}/players/${playerId}/status`, data),
  messagePlayer: (eventId, data) => api.post(`/event-running/${eventId}/message-player`, data),
  broadcast: (eventId, data) => api.post(`/event-running/${eventId}/broadcast`, data),
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'courts', label: 'Courts', icon: LayoutGrid },
  { id: 'queue', label: 'Queue', icon: ListOrdered },
  { id: 'players', label: 'Players', icon: Users },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
];

const STATUS_COLORS = {
  Scheduled: 'bg-gray-100 text-gray-700',
  Ready: 'bg-yellow-100 text-yellow-700',
  Queued: 'bg-orange-100 text-orange-700',
  InProgress: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
};

const TOURNAMENT_STATUS_COLORS = {
  Draft: 'bg-gray-100 text-gray-700',
  RegistrationOpen: 'bg-blue-100 text-blue-700',
  RegistrationClosed: 'bg-yellow-100 text-yellow-700',
  ScheduleReady: 'bg-purple-100 text-purple-700',
  Running: 'bg-green-100 text-green-700',
  Completed: 'bg-gray-100 text-gray-700',
  Cancelled: 'bg-red-100 text-red-700',
};

const EventRunningAdmin = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { joinEvent, leaveEvent } = useNotifications();

  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [matchFilter, setMatchFilter] = useState('all');
  const [viewMode, setViewMode] = useState('schedule'); // schedule, court

  // Modal states
  const [showScoreEdit, setShowScoreEdit] = useState(null);
  const [showPlayerMessage, setShowPlayerMessage] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showAssignCourt, setShowAssignCourt] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await eventRunningApi.getAdminDashboard(eventId);
      if (response.success) {
        setData(response.data);
        if (!selectedDivision && response.data.divisions?.length > 0) {
          setSelectedDivision(response.data.divisions[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId && isAuthenticated) {
      loadData();
      joinEvent?.(eventId);
    }
    return () => {
      if (eventId) leaveEvent?.(eventId);
    };
  }, [eventId, isAuthenticated]);

  // Filtered matches
  const filteredMatches = useMemo(() => {
    if (!data?.matches) return [];
    let matches = [...data.matches];

    if (selectedDivision) {
      matches = matches.filter(m => m.divisionId === selectedDivision);
    }

    if (matchFilter === 'active') {
      matches = matches.filter(m => ['Ready', 'Queued', 'InProgress'].includes(m.status));
    } else if (matchFilter === 'completed') {
      matches = matches.filter(m => m.status === 'Completed');
    } else if (matchFilter === 'disputed') {
      matches = matches.filter(m => m.isDisputed);
    }

    return matches;
  }, [data?.matches, selectedDivision, matchFilter]);

  // Matches by court
  const matchesByCourt = useMemo(() => {
    if (!data?.courts || !data?.matches) return {};
    const byCourt = { unassigned: [] };
    data.courts.forEach(c => { byCourt[c.id] = []; });

    filteredMatches.forEach(match => {
      if (match.courtId) {
        if (byCourt[match.courtId]) {
          byCourt[match.courtId].push(match);
        }
      } else {
        byCourt.unassigned.push(match);
      }
    });

    return byCourt;
  }, [data?.courts, filteredMatches]);

  const handleStartEvent = async () => {
    if (!confirm('Are you sure you want to start this event? All registered players will be notified.')) return;
    try {
      await eventRunningApi.updateEventStatus(eventId, { status: 'Running' });
      loadData();
    } catch (err) {
      console.error('Error starting event:', err);
    }
  };

  const handleCompleteEvent = async () => {
    if (!confirm('Are you sure you want to mark this event as completed?')) return;
    try {
      await eventRunningApi.updateEventStatus(eventId, { status: 'Completed' });
      loadData();
    } catch (err) {
      console.error('Error completing event:', err);
    }
  };

  const handleQueueMatch = async (matchId, courtId) => {
    try {
      await eventRunningApi.queueMatch(eventId, { matchId, courtId });
      loadData();
    } catch (err) {
      console.error('Error queuing match:', err);
    }
  };

  const handleStartMatch = async (matchId) => {
    try {
      await eventRunningApi.startMatch(eventId, matchId);
      loadData();
    } catch (err) {
      console.error('Error starting match:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500">Please sign in to manage this event.</p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Event not found'}</p>
          <button onClick={() => navigate('/events')} className="text-blue-600 hover:underline">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/events')} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{data.eventName}</h1>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TOURNAMENT_STATUS_COLORS[data.tournamentStatus] || 'bg-gray-100'}`}>
                    {data.tournamentStatus}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Tournament Director Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {data.tournamentStatus === 'ScheduleReady' && (
                <button
                  onClick={handleStartEvent}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Zap className="w-4 h-4" />
                  Start Event
                </button>
              )}
              {data.tournamentStatus === 'Running' && (
                <button
                  onClick={handleCompleteEvent}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <Trophy className="w-4 h-4" />
                  Complete Event
                </button>
              )}
              <button onClick={loadData} className="p-2 hover:bg-gray-100 rounded-lg" title="Refresh">
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'queue' && data.matchQueue?.length > 0 && (
                  <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {data.matchQueue.length}
                  </span>
                )}
                {tab.id === 'overview' && data.stats?.disputedGames > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {data.stats.disputedGames}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <OverviewTab
            data={data}
            onStartMatch={handleStartMatch}
            onEditScore={(match) => setShowScoreEdit(match)}
          />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab
            data={data}
            filteredMatches={filteredMatches}
            selectedDivision={selectedDivision}
            setSelectedDivision={setSelectedDivision}
            matchFilter={matchFilter}
            setMatchFilter={setMatchFilter}
            viewMode={viewMode}
            setViewMode={setViewMode}
            matchesByCourt={matchesByCourt}
            onStartMatch={handleStartMatch}
            onAssignCourt={(match) => setShowAssignCourt(match)}
            onEditScore={(match) => setShowScoreEdit(match)}
          />
        )}
        {activeTab === 'courts' && (
          <CourtsTab
            data={data}
            onStartMatch={handleStartMatch}
            onEditScore={(match) => setShowScoreEdit(match)}
          />
        )}
        {activeTab === 'queue' && (
          <QueueTab
            data={data}
            onQueueMatch={handleQueueMatch}
            onStartMatch={handleStartMatch}
            onAssignCourt={(match) => setShowAssignCourt(match)}
            onRefresh={loadData}
          />
        )}
        {activeTab === 'players' && (
          <PlayersTab
            data={data}
            selectedDivision={selectedDivision}
            setSelectedDivision={setSelectedDivision}
            eventId={eventId}
            onMessage={(player) => setShowPlayerMessage(player)}
            onRefresh={loadData}
          />
        )}
        {activeTab === 'messages' && (
          <MessagesTab
            data={data}
            eventId={eventId}
            onBroadcast={() => setShowBroadcast(true)}
            onMessage={(player) => setShowPlayerMessage(player)}
          />
        )}
      </div>

      {/* Modals */}
      {showScoreEdit && (
        <ScoreEditModal
          match={showScoreEdit}
          eventId={eventId}
          onClose={() => setShowScoreEdit(null)}
          onSuccess={() => { setShowScoreEdit(null); loadData(); }}
        />
      )}
      {showPlayerMessage && (
        <PlayerMessageModal
          player={showPlayerMessage}
          eventId={eventId}
          onClose={() => setShowPlayerMessage(null)}
          onSuccess={() => setShowPlayerMessage(null)}
        />
      )}
      {showBroadcast && (
        <BroadcastModal
          eventId={eventId}
          onClose={() => setShowBroadcast(false)}
          onSuccess={() => { setShowBroadcast(false); loadData(); }}
        />
      )}
      {showAssignCourt && (
        <AssignCourtModal
          match={showAssignCourt}
          courts={data.courts}
          eventId={eventId}
          onClose={() => setShowAssignCourt(null)}
          onSuccess={() => { setShowAssignCourt(null); loadData(); }}
        />
      )}
    </div>
  );
};

// ==========================================
// Tab Components
// ==========================================

const StatCard = ({ label, value, sub, color = 'gray', icon: Icon }) => (
  <div className="bg-white rounded-xl p-4 border border-gray-200">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`text-2xl font-bold ${color === 'blue' ? 'text-blue-600' : color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      {Icon && <Icon className={`w-8 h-8 ${color === 'blue' ? 'text-blue-200' : color === 'green' ? 'text-green-200' : color === 'red' ? 'text-red-200' : 'text-gray-200'}`} />}
    </div>
  </div>
);

const OverviewTab = ({ data, onStartMatch, onEditScore }) => {
  const { stats, matches, courts } = data;
  const inProgressMatches = matches?.filter(m => m.status === 'InProgress') || [];
  const disputedMatches = matches?.filter(m => m.isDisputed) || [];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Players" value={stats.totalPlayers} sub={`${stats.checkedInPlayers} checked in`} icon={Users} />
        <StatCard label="Courts" value={stats.totalCourts} sub={`${stats.activeCourts} in use`} icon={LayoutGrid} />
        <StatCard label="Matches" value={stats.totalMatches} sub={`${stats.completedMatches} completed`} icon={Play} />
        <StatCard label="In Progress" value={stats.inProgressMatches} color="blue" icon={Zap} />
        {stats.disputedGames > 0 && (
          <StatCard label="Disputed" value={stats.disputedGames} color="red" icon={AlertTriangle} />
        )}
      </div>

      {/* Disputed Games Alert */}
      {disputedMatches.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Score Disputes</h3>
          </div>
          <div className="space-y-2">
            {disputedMatches.map(match => (
              <div key={match.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-200">
                <div>
                  <p className="font-medium">{match.unit1?.name} vs {match.unit2?.name}</p>
                  <p className="text-sm text-gray-500">{match.divisionName} - {match.roundName || `Round ${match.roundNumber}`}</p>
                  {match.disputeReason && (
                    <p className="text-sm text-red-600 mt-1">Reason: {match.disputeReason}</p>
                  )}
                </div>
                <button
                  onClick={() => onEditScore(match)}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Matches */}
      {inProgressMatches.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Active Matches</h3>
          <div className="space-y-2">
            {inProgressMatches.map(match => (
              <MatchCard key={match.id} match={match} onEditScore={onEditScore} />
            ))}
          </div>
        </div>
      )}

      {/* Court Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Court Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {courts.map(court => (
            <div
              key={court.id}
              className={`p-3 rounded-lg border-2 ${
                court.status === 'InUse'
                  ? 'border-blue-500 bg-blue-50'
                  : court.status === 'Maintenance'
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <p className="font-medium">{court.label}</p>
              <p className="text-sm text-gray-500">{court.status}</p>
              {court.currentMatch && (
                <p className="text-xs text-blue-600 mt-1">
                  {court.currentMatch.unit1Name} vs {court.currentMatch.unit2Name}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MatchCard = ({ match, onEditScore, onStartMatch, onAssignCourt, showActions = true }) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[match.status]}`}>
          {match.status}
        </span>
        {match.courtLabel && (
          <span className="text-xs text-gray-500">{match.courtLabel}</span>
        )}
        {match.isDisputed && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            Disputed
          </span>
        )}
      </div>
      <p className="font-medium mt-1">
        {match.unit1?.name || 'TBD'} vs {match.unit2?.name || 'TBD'}
      </p>
      <p className="text-sm text-gray-500">{match.divisionName} - {match.roundName || `Match ${match.matchNumber}`}</p>
      {match.status === 'InProgress' && (
        <p className="text-lg font-bold text-blue-600 mt-1">
          {match.unit1Score} - {match.unit2Score}
          {match.bestOf > 1 && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              (Game {match.currentGameNumber}, Sets: {match.unit1Wins}-{match.unit2Wins})
            </span>
          )}
        </p>
      )}
    </div>
    {showActions && (
      <div className="flex items-center gap-2">
        {match.status === 'Ready' && onAssignCourt && (
          <button
            onClick={() => onAssignCourt(match)}
            className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg"
            title="Assign Court"
          >
            <MapPin className="w-4 h-4" />
          </button>
        )}
        {(match.status === 'Queued' || match.status === 'Ready') && onStartMatch && (
          <button
            onClick={() => onStartMatch(match.id)}
            className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
            title="Start Match"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        {(match.status === 'InProgress' || match.status === 'Completed' || match.isDisputed) && onEditScore && (
          <button
            onClick={() => onEditScore(match)}
            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
            title="Edit Score"
          >
            <Trophy className="w-4 h-4" />
          </button>
        )}
      </div>
    )}
  </div>
);

const ScheduleTab = ({
  data, filteredMatches, selectedDivision, setSelectedDivision,
  matchFilter, setMatchFilter, viewMode, setViewMode, matchesByCourt,
  onStartMatch, onAssignCourt, onEditScore
}) => (
  <div className="space-y-4">
    {/* Filters */}
    <div className="flex flex-wrap gap-3 items-center">
      <select
        value={selectedDivision || ''}
        onChange={(e) => setSelectedDivision(e.target.value ? parseInt(e.target.value) : null)}
        className="px-3 py-2 border border-gray-300 rounded-lg"
      >
        <option value="">All Divisions</option>
        {data.divisions.map(d => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
      <select
        value={matchFilter}
        onChange={(e) => setMatchFilter(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg"
      >
        <option value="all">All Matches</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="disputed">Disputed</option>
      </select>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setViewMode('schedule')}
          className={`px-3 py-1 rounded ${viewMode === 'schedule' ? 'bg-white shadow' : ''}`}
        >
          By Schedule
        </button>
        <button
          onClick={() => setViewMode('court')}
          className={`px-3 py-1 rounded ${viewMode === 'court' ? 'bg-white shadow' : ''}`}
        >
          By Court
        </button>
      </div>
    </div>

    {/* Matches */}
    {viewMode === 'schedule' ? (
      <div className="bg-white rounded-xl border border-gray-200 divide-y">
        {filteredMatches.length === 0 ? (
          <p className="p-4 text-gray-500 text-center">No matches found</p>
        ) : (
          filteredMatches.map(match => (
            <div key={match.id} className="p-4">
              <MatchCard
                match={match}
                onStartMatch={onStartMatch}
                onAssignCourt={onAssignCourt}
                onEditScore={onEditScore}
              />
            </div>
          ))
        )}
      </div>
    ) : (
      <div className="space-y-4">
        {data.courts.map(court => (
          <div key={court.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{court.label}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  court.status === 'InUse' ? 'bg-blue-100 text-blue-700' :
                  court.status === 'Available' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {court.status}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {matchesByCourt[court.id]?.length > 0 ? (
                matchesByCourt[court.id].map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onStartMatch={onStartMatch}
                    onEditScore={onEditScore}
                  />
                ))
              ) : (
                <p className="text-gray-400 text-sm">No matches assigned</p>
              )}
            </div>
          </div>
        ))}
        {matchesByCourt.unassigned?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold mb-3">Unassigned</h3>
            <div className="space-y-2">
              {matchesByCourt.unassigned.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onStartMatch={onStartMatch}
                  onAssignCourt={onAssignCourt}
                  onEditScore={onEditScore}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )}
  </div>
);

const CourtsTab = ({ data, onStartMatch, onEditScore }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {data.courts.map(court => (
      <div
        key={court.id}
        className={`bg-white rounded-xl border-2 p-4 ${
          court.status === 'InUse' ? 'border-blue-500' :
          court.status === 'Available' ? 'border-green-500' :
          'border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">{court.label}</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            court.status === 'InUse' ? 'bg-blue-100 text-blue-700' :
            court.status === 'Available' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {court.status}
          </span>
        </div>
        {court.currentMatch ? (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="font-medium">{court.currentMatch.unit1Name} vs {court.currentMatch.unit2Name}</p>
            <div className="flex items-center justify-between mt-2">
              <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[court.currentMatch.status]}`}>
                {court.currentMatch.status}
              </span>
              <button
                onClick={() => {
                  const match = data.matches.find(m => m.id === court.currentMatch.id);
                  if (match) onEditScore(match);
                }}
                className="text-blue-600 text-sm hover:underline"
              >
                View/Edit
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-4">Available</p>
        )}
      </div>
    ))}
  </div>
);

const QueueTab = ({ data, onQueueMatch, onStartMatch, onAssignCourt, onRefresh }) => {
  const readyMatches = data.matches?.filter(m => m.status === 'Ready' || m.status === 'Scheduled') || [];
  const queuedMatches = data.matchQueue || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ready to Queue */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold mb-3">Ready to Queue ({readyMatches.length})</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {readyMatches.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No matches ready</p>
          ) : (
            readyMatches.map(match => (
              <div key={match.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{match.unit1?.name || 'TBD'} vs {match.unit2?.name || 'TBD'}</p>
                  <p className="text-sm text-gray-500">{match.divisionName}</p>
                </div>
                <button
                  onClick={() => onAssignCourt(match)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  Assign Court
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Court Queue */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold mb-3">Court Queue ({queuedMatches.length})</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {queuedMatches.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No matches in queue</p>
          ) : (
            queuedMatches.map((match, index) => (
              <div key={match.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">{match.unit1?.name || 'TBD'} vs {match.unit2?.name || 'TBD'}</p>
                    <p className="text-sm text-gray-500">{match.courtLabel} - {match.divisionName}</p>
                  </div>
                </div>
                <button
                  onClick={() => onStartMatch(match.id)}
                  className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                >
                  Start
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const PlayersTab = ({ data, selectedDivision, setSelectedDivision, eventId, onMessage, onRefresh }) => {
  const [updating, setUpdating] = useState(null);

  const handleCheckIn = async (playerId, isCheckedIn) => {
    try {
      setUpdating(playerId);
      await eventRunningApi.updatePlayerStatus(eventId, playerId, { isCheckedIn, notifyPlayer: true });
      onRefresh();
    } catch (err) {
      console.error('Error updating player:', err);
    } finally {
      setUpdating(null);
    }
  };

  const allPlayers = useMemo(() => {
    if (!data.divisions) return [];
    const players = [];
    data.divisions
      .filter(d => !selectedDivision || d.id === selectedDivision)
      .forEach(division => {
        division.units.forEach(unit => {
          unit.members.forEach(member => {
            if (!players.find(p => p.userId === member.userId)) {
              players.push({
                ...member,
                divisionName: division.name,
                unitName: unit.name,
                unitId: unit.id,
              });
            }
          });
        });
      });
    return players;
  }, [data.divisions, selectedDivision]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={selectedDivision || ''}
          onChange={(e) => setSelectedDivision(e.target.value ? parseInt(e.target.value) : null)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">All Divisions</option>
          {data.divisions.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <span className="text-gray-500">
          {allPlayers.filter(p => p.isCheckedIn).length} / {allPlayers.length} checked in
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium">Player</th>
              <th className="text-left p-3 font-medium">Division</th>
              <th className="text-left p-3 font-medium">Team</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {allPlayers.map(player => (
              <tr key={`${player.userId}-${player.unitId}`} className="hover:bg-gray-50">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {player.profileImageUrl ? (
                      <img
                        src={getSharedAssetUrl(player.profileImageUrl)}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <span className="font-medium">{player.name}</span>
                  </div>
                </td>
                <td className="p-3 text-gray-600">{player.divisionName}</td>
                <td className="p-3 text-gray-600">{player.unitName}</td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleCheckIn(player.userId, !player.isCheckedIn)}
                    disabled={updating === player.userId}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      player.isCheckedIn
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {updating === player.userId ? '...' : player.isCheckedIn ? 'Checked In' : 'Not Checked In'}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => onMessage(player)}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                    title="Message Player"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MessagesTab = ({ data, eventId, onBroadcast, onMessage }) => {
  const allPlayers = useMemo(() => {
    if (!data.divisions) return [];
    const players = [];
    data.divisions.forEach(division => {
      division.units.forEach(unit => {
        unit.members.forEach(member => {
          if (!players.find(p => p.userId === member.userId)) {
            players.push({ ...member, divisionName: division.name });
          }
        });
      });
    });
    return players;
  }, [data.divisions]);

  return (
    <div className="space-y-4">
      <button
        onClick={onBroadcast}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Bell className="w-4 h-4" />
        Broadcast to All Players
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold mb-3">Send Direct Message</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {allPlayers.map(player => (
            <div key={player.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {player.profileImageUrl ? (
                  <img
                    src={getSharedAssetUrl(player.profileImageUrl)}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{player.name}</p>
                  <p className="text-sm text-gray-500">{player.divisionName}</p>
                </div>
              </div>
              <button
                onClick={() => onMessage(player)}
                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Modals
// ==========================================

const ScoreEditModal = ({ match, eventId, onClose, onSuccess }) => {
  const currentGame = match.games?.find(g => g.status !== 'Finished') || match.games?.[match.games.length - 1];
  const [unit1Score, setUnit1Score] = useState(currentGame?.unit1Score || 0);
  const [unit2Score, setUnit2Score] = useState(currentGame?.unit2Score || 0);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await eventRunningApi.editGameScore(eventId, currentGame?.id || match.id, {
        unit1Score,
        unit2Score,
        isFinished,
        notifyPlayers: true,
      });
      onSuccess();
    } catch (err) {
      console.error('Error updating score:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Edit Score</h3>
        <p className="text-gray-600 mb-4">
          {match.unit1?.name || 'Team 1'} vs {match.unit2?.name || 'Team 2'}
        </p>

        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">{match.unit1?.name}</p>
            <input
              type="number"
              value={unit1Score}
              onChange={(e) => setUnit1Score(parseInt(e.target.value) || 0)}
              className="w-20 h-16 text-center text-2xl font-bold border border-gray-300 rounded-lg"
              min="0"
            />
          </div>
          <span className="text-2xl text-gray-400">-</span>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">{match.unit2?.name}</p>
            <input
              type="number"
              value={unit2Score}
              onChange={(e) => setUnit2Score(parseInt(e.target.value) || 0)}
              className="w-20 h-16 text-center text-2xl font-bold border border-gray-300 rounded-lg"
              min="0"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 mb-6">
          <input
            type="checkbox"
            checked={isFinished}
            onChange={(e) => setIsFinished(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span>Mark game as finished</span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Score'}
          </button>
        </div>
      </div>
    </div>
  );
};

const PlayerMessageModal = ({ player, eventId, onClose, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    try {
      setLoading(true);
      await eventRunningApi.messagePlayer(eventId, { playerId: player.userId, message });
      onSuccess();
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Message {player.name}</h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your message..."
          className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !message.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BroadcastModal = ({ eventId, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    try {
      setLoading(true);
      await eventRunningApi.broadcast(eventId, { title: title || undefined, message });
      onSuccess();
    } catch (err) {
      console.error('Error broadcasting:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Broadcast to All Players</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full p-3 border border-gray-300 rounded-lg mb-3"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your message..."
          className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !message.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Broadcast'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AssignCourtModal = ({ match, courts, eventId, onClose, onSuccess }) => {
  const [selectedCourt, setSelectedCourt] = useState(match.courtId || '');
  const [loading, setLoading] = useState(false);

  const availableCourts = courts.filter(c => c.status === 'Available' || c.id === match.courtId);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await eventRunningApi.assignCourt(eventId, match.id, {
        courtId: selectedCourt || null,
        notifyPlayers: true,
      });
      onSuccess();
    } catch (err) {
      console.error('Error assigning court:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Assign Court</h3>
        <p className="text-gray-600 mb-4">
          {match.unit1?.name || 'Team 1'} vs {match.unit2?.name || 'Team 2'}
        </p>
        <select
          value={selectedCourt}
          onChange={(e) => setSelectedCourt(e.target.value ? parseInt(e.target.value) : '')}
          className="w-full p-3 border border-gray-300 rounded-lg mb-4"
        >
          <option value="">No Court (Queue Only)</option>
          {availableCourts.map(court => (
            <option key={court.id} value={court.id}>
              {court.label} {court.status !== 'Available' && `(${court.status})`}
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventRunningAdmin;
