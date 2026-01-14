import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users, LayoutGrid, Play, Settings, Plus, Trash2, ChevronDown, ChevronUp,
  Clock, CheckCircle, XCircle, Pause, RefreshCw, ArrowLeft, Edit2, Save, X, Info
} from 'lucide-react';
import api, { scoreMethodsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getSharedAssetUrl } from '../services/api';
import HelpIcon from '../components/ui/HelpIcon';

// API endpoints
const gamedayApi = {
  getOverview: (eventId) => api.get(`/gameday/events/${eventId}`),
  addCourt: (eventId, data) => api.post(`/gameday/events/${eventId}/courts`, data),
  updateCourt: (courtId, data) => api.put(`/gameday/courts/${courtId}`, data),
  deleteCourt: (courtId) => api.delete(`/gameday/courts/${courtId}`),
  createGame: (eventId, data) => api.post(`/gameday/events/${eventId}/games`, data),
  updateGameStatus: (matchId, data) => api.put(`/gameday/games/${matchId}/status`, data),
  updateScore: (matchId, data) => api.put(`/gameday/games/${matchId}/score`, data),
  assignCourt: (matchId, data) => api.put(`/gameday/games/${matchId}/court`, data),
  deleteGame: (matchId) => api.delete(`/gameday/games/${matchId}`),
  createScoreFormat: (eventId, data) => api.post(`/gameday/events/${eventId}/score-formats`, data),
  setDivisionScoreFormat: (divisionId, data) => api.put(`/gameday/divisions/${divisionId}/score-format`, data),
  generateRound: (eventId, data) => api.post(`/gameday/events/${eventId}/generate-round`, data),
  getAvailablePlayers: (eventId, divisionId, checkedInOnly) =>
    api.get(`/gameday/events/${eventId}/players`, { params: { divisionId, checkedInOnly } }),
  createManualGame: (eventId, data) => api.post(`/gameday/events/${eventId}/manual-game`, data),
  checkInPlayer: (eventId, userId) => api.post(`/gameday/events/${eventId}/check-in`, { userId }),
  bulkCheckIn: (eventId, userIds) => api.post(`/gameday/events/${eventId}/bulk-check-in`, { userIds }),
  checkInAll: (eventId) => api.post(`/gameday/events/${eventId}/check-in-all`),
  undoCheckIn: (eventId, userId) => api.post(`/gameday/events/${eventId}/undo-check-in`, { userId })
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'players', label: 'Players', icon: Users },
  { id: 'courts', label: 'Courts', icon: LayoutGrid },
  { id: 'games', label: 'Games', icon: Play },
  { id: 'settings', label: 'Settings', icon: Settings }
];

const STATUS_COLORS = {
  Pending: 'bg-gray-100 text-gray-700',
  Queued: 'bg-yellow-100 text-yellow-700',
  InProgress: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700'
};

const GameDayManage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showNewGame, setShowNewGame] = useState(false);
  const [showScoreEdit, setShowScoreEdit] = useState(null);
  const [showNewFormat, setShowNewFormat] = useState(false);

  // Filter states
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [gameFilter, setGameFilter] = useState('all'); // all, active, completed
  const [viewMode, setViewMode] = useState('list'); // list, by-court

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await gamedayApi.getOverview(eventId);
      if (response.success) {
        setData(response.data);
        if (!selectedDivision && response.data.divisions?.length > 0) {
          setSelectedDivision(response.data.divisions[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading game day data:', err);
      setError('Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId && isAuthenticated) {
      loadData();
    }
  }, [eventId, isAuthenticated]);

  // Filtered games
  const filteredGames = useMemo(() => {
    if (!data?.games) return [];
    let games = [...data.games];

    if (selectedDivision) {
      games = games.filter(g => g.divisionId === selectedDivision);
    }

    if (gameFilter === 'active') {
      games = games.filter(g => ['Pending', 'Queued', 'InProgress'].includes(g.status));
    } else if (gameFilter === 'completed') {
      games = games.filter(g => g.status === 'Completed');
    }

    return games;
  }, [data?.games, selectedDivision, gameFilter]);

  // Games by court
  const gamesByCourt = useMemo(() => {
    if (!data?.courts || !data?.games) return {};
    const byCourt = { unassigned: [] };
    data.courts.forEach(c => { byCourt[c.id] = []; });

    filteredGames.forEach(game => {
      if (game.courtId) {
        if (byCourt[game.courtId]) {
          byCourt[game.courtId].push(game);
        }
      } else {
        byCourt.unassigned.push(game);
      }
    });

    return byCourt;
  }, [data?.courts, filteredGames]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500">Please sign in to manage this event.</p>
      </div>
    );
  }

  if (loading) {
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

  if (!data.isOrganizer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500">You don't have permission to manage this event.</p>
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
              <button
                onClick={() => navigate(`/events`)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{data.eventName}</h1>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  Game Day Management
                  <HelpIcon topicCode="gameday.overview" size="sm" />
                </p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
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
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <OverviewTab data={data} onGameClick={(g) => { setShowScoreEdit(g); }} />
        )}
        {activeTab === 'players' && (
          <PlayersTab
            data={data}
            selectedDivision={selectedDivision}
            setSelectedDivision={setSelectedDivision}
            eventId={eventId}
            onRefresh={loadData}
          />
        )}
        {activeTab === 'courts' && (
          <CourtsTab data={data} onRefresh={loadData} eventId={eventId} />
        )}
        {activeTab === 'games' && (
          <GamesTab
            data={data}
            filteredGames={filteredGames}
            gamesByCourt={gamesByCourt}
            selectedDivision={selectedDivision}
            setSelectedDivision={setSelectedDivision}
            gameFilter={gameFilter}
            setGameFilter={setGameFilter}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onNewGame={() => setShowNewGame(true)}
            onGameClick={(g) => setShowScoreEdit(g)}
            onRefresh={loadData}
            eventId={eventId}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            data={data}
            onNewFormat={() => setShowNewFormat(true)}
            onRefresh={loadData}
            eventId={eventId}
          />
        )}
      </div>

      {/* New Game Modal */}
      {showNewGame && (
        <NewGameModal
          data={data}
          selectedDivision={selectedDivision}
          eventId={eventId}
          onClose={() => setShowNewGame(false)}
          onSuccess={() => { setShowNewGame(false); loadData(); }}
        />
      )}

      {/* Score Edit Modal */}
      {showScoreEdit && (
        <ScoreEditModal
          game={showScoreEdit}
          data={data}
          onClose={() => setShowScoreEdit(null)}
          onSuccess={() => { setShowScoreEdit(null); loadData(); }}
        />
      )}

      {/* New Format Modal */}
      {showNewFormat && (
        <NewFormatModal
          eventId={eventId}
          onClose={() => setShowNewFormat(false)}
          onSuccess={() => { setShowNewFormat(false); loadData(); }}
        />
      )}
    </div>
  );
};

// ==========================================
// Tab Components
// ==========================================

const OverviewTab = ({ data, onGameClick }) => {
  const { stats, games, courts } = data;
  const activeGames = games?.filter(g => g.status === 'InProgress') || [];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Players" value={stats.totalPlayers} sub={`${stats.checkedInPlayers} checked in`} helpTopicCode="gameday.checkIn" />
        <StatCard label="Courts" value={stats.totalCourts} sub={`${stats.activeCourts} in use`} />
        <StatCard label="Games" value={stats.totalGames} sub={`${stats.completedGames} completed`} />
        <StatCard label="In Progress" value={stats.inProgressGames} color="blue" />
      </div>

      {/* Active Games */}
      {activeGames.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Active Games</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {activeGames.map(game => (
              <GameCard key={game.id} game={game} onClick={() => onGameClick(game)} />
            ))}
          </div>
        </div>
      )}

      {/* Court Status */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Court Status</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {courts?.map(court => {
            const courtGame = games?.find(g => g.courtId === court.id && g.status === 'InProgress');
            return (
              <div
                key={court.id}
                className={`p-4 rounded-xl border ${
                  court.status === 'InUse' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                }`}
              >
                <div className="font-medium text-gray-900">{court.label}</div>
                {courtGame ? (
                  <div className="mt-2 text-sm">
                    <div className="text-blue-600 font-medium">
                      {courtGame.unit1?.name} vs {courtGame.unit2?.name}
                    </div>
                    <div className="text-gray-500">
                      {courtGame.unit1Score} - {courtGame.unit2Score}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-gray-500">Available</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const PlayersTab = ({ data, selectedDivision, setSelectedDivision, eventId, onRefresh }) => {
  const [checkingIn, setCheckingIn] = useState(null);
  const [bulkCheckingIn, setBulkCheckingIn] = useState(false);

  // Calculate stats
  const selectedDivisionData = data.divisions.find(d => d.id === selectedDivision);
  const allPlayers = selectedDivisionData?.units.flatMap(u => u.members) || [];
  const checkedInCount = allPlayers.filter(m => m.isCheckedIn).length;
  const totalCount = allPlayers.length;

  const handleToggleCheckIn = async (userId, isCurrentlyCheckedIn) => {
    setCheckingIn(userId);
    try {
      if (isCurrentlyCheckedIn) {
        await gamedayApi.undoCheckIn(eventId, userId);
      } else {
        await gamedayApi.checkInPlayer(eventId, userId);
      }
      onRefresh?.();
    } catch (err) {
      console.error('Error toggling check-in:', err);
    } finally {
      setCheckingIn(null);
    }
  };

  const handleBulkCheckIn = async () => {
    const uncheckedPlayers = allPlayers.filter(m => !m.isCheckedIn);
    if (uncheckedPlayers.length === 0) return;

    setBulkCheckingIn(true);
    try {
      await gamedayApi.checkInAll(eventId);
      onRefresh?.();
    } catch (err) {
      console.error('Error bulk checking in:', err);
    } finally {
      setBulkCheckingIn(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Check-in Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {checkedInCount} / {totalCount}
            </div>
            <div className="text-sm text-gray-500">Players checked in</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${totalCount > 0 ? (checkedInCount / totalCount) * 100 : 0}%` }}
              />
            </div>
            {checkedInCount < totalCount && (
              <button
                onClick={handleBulkCheckIn}
                disabled={bulkCheckingIn}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
              >
                {bulkCheckingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Check In All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Division Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {data.divisions.map(div => {
          const divPlayers = div.units.flatMap(u => u.members);
          const divCheckedIn = divPlayers.filter(m => m.isCheckedIn).length;
          return (
            <button
              key={div.id}
              onClick={() => setSelectedDivision(div.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedDivision === div.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {div.name} ({divCheckedIn}/{divPlayers.length})
            </button>
          );
        })}
      </div>

      {/* Units/Players List */}
      {data.divisions
        .filter(d => d.id === selectedDivision)
        .map(division => (
          <div key={division.id} className="space-y-3">
            {division.units.map(unit => {
              const unitCheckedIn = unit.members.filter(m => m.isCheckedIn).length;
              const allCheckedIn = unitCheckedIn === unit.members.length;
              return (
                <div key={unit.id} className={`bg-white rounded-xl border p-4 ${allCheckedIn ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      {unit.name}
                      {allCheckedIn && <CheckCircle className="w-4 h-4 text-green-500" />}
                    </div>
                    <span className="text-xs text-gray-500">{unitCheckedIn}/{unit.members.length} checked in</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {unit.members.map(member => (
                      <div
                        key={member.userId}
                        className={`flex items-center gap-2 p-2 rounded-lg ${member.isCheckedIn ? 'bg-green-100' : 'bg-gray-100'}`}
                      >
                        {member.profileImageUrl ? (
                          <img
                            src={getSharedAssetUrl(member.profileImageUrl)}
                            alt={member.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-600">
                            {member.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <span className="text-sm text-gray-700">{member.name}</span>
                        <button
                          onClick={() => handleToggleCheckIn(member.userId, member.isCheckedIn)}
                          disabled={checkingIn === member.userId}
                          className={`p-1 rounded transition ${
                            member.isCheckedIn
                              ? 'text-green-600 hover:bg-green-200'
                              : 'text-blue-600 hover:bg-blue-100'
                          }`}
                          title={member.isCheckedIn ? "Undo check-in" : "Check in"}
                        >
                          {checkingIn === member.userId ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : member.isCheckedIn ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
};

const CourtsTab = ({ data, onRefresh, eventId }) => {
  const [newCourtLabel, setNewCourtLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingCourt, setEditingCourt] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [updating, setUpdating] = useState(null);

  const handleAddCourt = async () => {
    if (!newCourtLabel.trim()) return;
    setAdding(true);
    try {
      await gamedayApi.addCourt(eventId, { label: newCourtLabel.trim() });
      setNewCourtLabel('');
      onRefresh();
    } catch (err) {
      console.error('Error adding court:', err);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCourt = async (courtId) => {
    if (!confirm('Delete this court?')) return;
    try {
      await gamedayApi.deleteCourt(courtId);
      onRefresh();
    } catch (err) {
      alert('Cannot delete court with active games');
    }
  };

  const handleStartEdit = (court) => {
    setEditingCourt(court.id);
    setEditLabel(court.label);
  };

  const handleSaveEdit = async (courtId) => {
    if (!editLabel.trim()) return;
    setUpdating(courtId);
    try {
      await gamedayApi.updateCourt(courtId, { label: editLabel.trim() });
      setEditingCourt(null);
      onRefresh();
    } catch (err) {
      console.error('Error updating court:', err);
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleActive = async (court) => {
    setUpdating(court.id);
    try {
      await gamedayApi.updateCourt(court.id, { isActive: !court.isActive });
      onRefresh();
    } catch (err) {
      console.error('Error toggling court:', err);
    } finally {
      setUpdating(null);
    }
  };

  const handleSetStatus = async (courtId, status) => {
    setUpdating(courtId);
    try {
      await gamedayApi.updateCourt(courtId, { status });
      onRefresh();
    } catch (err) {
      console.error('Error updating court status:', err);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Court */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Add Court</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCourtLabel}
            onChange={(e) => setNewCourtLabel(e.target.value)}
            placeholder="Court label (e.g., Court 1)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAddCourt()}
          />
          <button
            onClick={handleAddCourt}
            disabled={adding || !newCourtLabel.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Courts List */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.courts.map(court => (
          <div
            key={court.id}
            className={`bg-white rounded-xl border p-4 transition-all ${
              court.isActive === false
                ? 'border-gray-300 bg-gray-50 opacity-60'
                : court.status === 'InUse'
                  ? 'border-blue-300 bg-blue-50'
                  : court.status === 'Maintenance'
                    ? 'border-yellow-300 bg-yellow-50'
                    : 'border-gray-200'
            }`}
          >
            {/* Court Header */}
            <div className="flex items-center justify-between mb-3">
              {editingCourt === court.id ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(court.id);
                      if (e.key === 'Escape') setEditingCourt(null);
                    }}
                  />
                  <button
                    onClick={() => handleSaveEdit(court.id)}
                    disabled={updating === court.id}
                    className="p-1 text-green-600 hover:text-green-700"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingCourt(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="font-medium text-gray-900">{court.label}</div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(court)}
                      className="p-1 text-gray-400 hover:text-blue-600 rounded"
                      title="Edit label"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCourt(court.id)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      title="Delete court"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 mb-3">
              <div className={`text-xs px-2 py-1 rounded font-medium ${
                court.status === 'InUse' ? 'bg-blue-100 text-blue-700' :
                court.status === 'Maintenance' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {court.status === 'InUse' ? 'In Use' : court.status}
              </div>
              {court.isActive === false && (
                <div className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600 font-medium">
                  Disabled
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleToggleActive(court)}
                disabled={updating === court.id || court.status === 'InUse'}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  court.isActive === false
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {court.isActive === false ? 'Enable' : 'Disable'}
              </button>
              {court.status !== 'InUse' && court.isActive !== false && (
                <button
                  onClick={() => handleSetStatus(court.id, court.status === 'Maintenance' ? 'Available' : 'Maintenance')}
                  disabled={updating === court.id}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    court.status === 'Maintenance'
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  } disabled:opacity-50`}
                >
                  {court.status === 'Maintenance' ? 'Set Available' : 'Maintenance'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.courts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No courts added yet. Add courts to start scheduling games.
        </div>
      )}
    </div>
  );
};

const GamesTab = ({
  data, filteredGames, gamesByCourt, selectedDivision, setSelectedDivision,
  gameFilter, setGameFilter, viewMode, setViewMode, onNewGame, onGameClick, onRefresh, eventId
}) => {
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const scheduleType = data.scheduleType || 'Manual Only';
  const canGenerateRounds = scheduleType === 'Dynamic';
  const canCreateManual = scheduleType !== 'None';

  const handleGenerateRound = async (method) => {
    setGenerating(true);
    setGenerateError('');
    try {
      const response = await gamedayApi.generateRound(eventId, {
        method, // 'popcorn' or 'gauntlet'
        divisionId: selectedDivision,
        teamSize: data.divisions.find(d => d.id === selectedDivision)?.teamSize || 2,
        checkedInOnly: true,
        maxGames: data.courts?.length || 4
      });
      if (response.success) {
        onRefresh();
      } else {
        setGenerateError(response.message || 'Failed to generate round');
      }
    } catch (err) {
      console.error('Error generating round:', err);
      setGenerateError(err.response?.data?.message || 'Failed to generate round');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Schedule Type Banner */}
      {scheduleType && (
        <div className={`p-3 rounded-lg flex items-center gap-3 ${
          scheduleType === 'Dynamic' ? 'bg-green-50 border border-green-200' :
          scheduleType === 'PrePlanned' ? 'bg-blue-50 border border-blue-200' :
          scheduleType === 'None' ? 'bg-gray-50 border border-gray-200' :
          'bg-yellow-50 border border-yellow-200'
        }`}>
          <Info className="w-5 h-5 text-gray-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-medium">{scheduleType} Scheduling:</span>{' '}
            {scheduleType === 'Dynamic' && 'Use Popcorn (random) or Gauntlet (winners stay) to auto-generate rounds'}
            {scheduleType === 'PrePlanned' && 'Schedule is set up before the event. Use manual adjustments if needed.'}
            {scheduleType === 'Manual Only' && 'Create games manually by selecting players'}
            {scheduleType === 'None' && 'No scheduling required for this event type'}
          </div>
        </div>
      )}

      {/* Error Message */}
      {generateError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {generateError}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto">
          <select
            value={selectedDivision || ''}
            onChange={(e) => setSelectedDivision(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="">All Divisions</option>
            {data.divisions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="all">All Games</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="list">List View</option>
            <option value="by-court">By Court</option>
          </select>
        </div>

        {/* Action Buttons based on ScheduleType */}
        <div className="flex items-center gap-2 flex-wrap">
          {canGenerateRounds && (
            <>
              <button
                onClick={() => handleGenerateRound('popcorn')}
                disabled={generating || !selectedDivision}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                title="Random player matchups"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Popcorn
              </button>
              <button
                onClick={() => handleGenerateRound('gauntlet')}
                disabled={generating || !selectedDivision}
                className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                title="Winners stay on court"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Gauntlet
              </button>
            </>
          )}
          {canCreateManual && (
            <button
              onClick={onNewGame}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Manual Game
            </button>
          )}
          <HelpIcon topicCode="gameday.rotation" size="sm" />
        </div>
      </div>

      {/* Generate Round Help Text */}
      {canGenerateRounds && !selectedDivision && (
        <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
          Select a division to enable automatic round generation
        </div>
      )}

      {/* Games */}
      {viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredGames.map(game => (
            <GameCard key={game.id} game={game} onClick={() => onGameClick(game)} showActions onRefresh={onRefresh} />
          ))}
          {filteredGames.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No games found. {canGenerateRounds ? 'Generate a round or create a manual game to get started.' : 'Create a new game to get started.'}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {data.courts.map(court => (
            <div key={court.id}>
              <h3 className="font-medium text-gray-900 mb-2">{court.label}</h3>
              <div className="space-y-2">
                {gamesByCourt[court.id]?.map(game => (
                  <GameCard key={game.id} game={game} onClick={() => onGameClick(game)} compact />
                ))}
                {(!gamesByCourt[court.id] || gamesByCourt[court.id].length === 0) && (
                  <div className="text-sm text-gray-400 py-2">No games</div>
                )}
              </div>
            </div>
          ))}
          {gamesByCourt.unassigned?.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-500 mb-2">Unassigned</h3>
              <div className="space-y-2">
                {gamesByCourt.unassigned.map(game => (
                  <GameCard key={game.id} game={game} onClick={() => onGameClick(game)} compact />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SettingsTab = ({ data, onNewFormat, onRefresh, eventId }) => {
  return (
    <div className="space-y-6">
      {/* Score Formats */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Score Formats</h3>
          <button
            onClick={onNewFormat}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            New Format
          </button>
        </div>
        <div className="space-y-2">
          {data.scoreFormats.map(format => (
            <div key={format.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">{format.name}</div>
                <div className="text-sm text-gray-500">
                  {format.scoreMethodName || format.scoringType} • Play to {format.maxPoints}
                  {format.capAfter > 0 && ` (cap ${format.maxPoints + format.capAfter})`}
                  {' '}• Win by {format.winByMargin}
                  {format.switchEndsAtMidpoint && ' • Change ends'}
                </div>
              </div>
              {format.isDefault && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Default</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Division Score Format Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-4">Division Score Formats</h3>
        <div className="space-y-3">
          {data.divisions.map(division => (
            <DivisionFormatSetting
              key={division.id}
              division={division}
              scoreFormats={data.scoreFormats}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Shared Components
// ==========================================

const StatCard = ({ label, value, sub, color = 'gray', helpTopicCode }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4">
    <div className={`text-2xl font-bold ${color === 'blue' ? 'text-blue-600' : 'text-gray-900'}`}>
      {value}
    </div>
    <div className="text-sm font-medium text-gray-700 flex items-center gap-1">
      {label}
      {helpTopicCode && <HelpIcon topicCode={helpTopicCode} size="sm" />}
    </div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
  </div>
);

const GameCard = ({ game, onClick, compact = false, showActions = false, onRefresh }) => {
  const handleStatusChange = async (status) => {
    try {
      await gamedayApi.updateGameStatus(game.id, { status });
      onRefresh?.();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this game?')) return;
    try {
      await gamedayApi.deleteGame(game.id);
      onRefresh?.();
    } catch (err) {
      console.error('Error deleting game:', err);
    }
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">{game.unit1?.name}</span>
            <span className="text-gray-400 mx-2">vs</span>
            <span className="font-medium">{game.unit2?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{game.unit1Score}-{game.unit2Score}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[game.status]}`}>
              {game.status}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 cursor-pointer" onClick={onClick}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[game.status]}`}>
              {game.status}
            </span>
            {game.courtLabel && (
              <span className="text-xs text-gray-500">{game.courtLabel}</span>
            )}
            {game.divisionName && (
              <span className="text-xs text-gray-400">{game.divisionName}</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Unit 1 */}
            <div className={`flex-1 text-right ${game.winnerUnitId === game.unit1?.id ? 'font-bold' : ''}`}>
              <div className="font-medium text-gray-900">{game.unit1?.name}</div>
              <div className="text-sm text-gray-500">
                {game.unit1?.members?.map(m => m.name).join(', ')}
              </div>
            </div>

            {/* Score */}
            <div className="text-center">
              <div className="text-2xl font-bold font-mono">
                {game.unit1Score} - {game.unit2Score}
              </div>
              {game.bestOf > 1 && (
                <div className="text-xs text-gray-500">
                  Games: {game.unit1Wins}-{game.unit2Wins}
                </div>
              )}
            </div>

            {/* Unit 2 */}
            <div className={`flex-1 ${game.winnerUnitId === game.unit2?.id ? 'font-bold' : ''}`}>
              <div className="font-medium text-gray-900">{game.unit2?.name}</div>
              <div className="text-sm text-gray-500">
                {game.unit2?.members?.map(m => m.name).join(', ')}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-1 ml-4">
            {game.status === 'Queued' && (
              <button
                onClick={() => handleStatusChange('InProgress')}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                title="Start"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            {game.status === 'InProgress' && (
              <button
                onClick={() => handleStatusChange('Completed')}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                title="Complete"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            )}
            {game.status !== 'Completed' && (
              <button
                onClick={handleDelete}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const DivisionFormatSetting = ({ division, scoreFormats, onRefresh }) => {
  const [saving, setSaving] = useState(false);

  const handleChange = async (formatId) => {
    setSaving(true);
    try {
      await gamedayApi.setDivisionScoreFormat(division.id, {
        scoreFormatId: formatId ? parseInt(formatId) : null
      });
      onRefresh();
    } catch (err) {
      console.error('Error setting format:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <span className="font-medium text-gray-900">{division.name}</span>
      <select
        value={division.defaultScoreFormatId || ''}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm"
      >
        <option value="">Use default</option>
        {scoreFormats.map(f => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
    </div>
  );
};

// ==========================================
// Modal Components
// ==========================================

const NewGameModal = ({ data, selectedDivision, eventId, onClose, onSuccess }) => {
  const [divisionId, setDivisionId] = useState(selectedDivision);
  const [unit1Id, setUnit1Id] = useState('');
  const [unit2Id, setUnit2Id] = useState('');
  const [courtId, setCourtId] = useState('');
  const [scoreFormatId, setScoreFormatId] = useState('');
  const [bestOf, setBestOf] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const currentDivision = data.divisions.find(d => d.id === divisionId);
  const availableUnits = currentDivision?.units || [];
  const availableCourts = data.courts.filter(c => c.status === 'Available');

  const handleSubmit = async () => {
    if (!unit1Id || !unit2Id) return;
    setSubmitting(true);
    try {
      await gamedayApi.createGame(eventId, {
        unit1Id: parseInt(unit1Id),
        unit2Id: parseInt(unit2Id),
        courtId: courtId ? parseInt(courtId) : null,
        scoreFormatId: scoreFormatId ? parseInt(scoreFormatId) : null,
        bestOf
      });
      onSuccess();
    } catch (err) {
      console.error('Error creating game:', err);
      alert('Failed to create game');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Schedule New Game</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
            <select
              value={divisionId || ''}
              onChange={(e) => { setDivisionId(parseInt(e.target.value)); setUnit1Id(''); setUnit2Id(''); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {data.divisions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team 1</label>
              <select
                value={unit1Id}
                onChange={(e) => setUnit1Id(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select team...</option>
                {availableUnits.filter(u => u.id.toString() !== unit2Id).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team 2</label>
              <select
                value={unit2Id}
                onChange={(e) => setUnit2Id(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select team...</option>
                {availableUnits.filter(u => u.id.toString() !== unit1Id).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Court (Optional)</label>
            <select
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Assign later</option>
              {availableCourts.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Score Format</label>
              <select
                value={scoreFormatId}
                onChange={(e) => setScoreFormatId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Use division default</option>
                {data.scoreFormats.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Best Of</label>
              <select
                value={bestOf}
                onChange={(e) => setBestOf(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value={1}>1 Game</option>
                <option value={3}>Best of 3</option>
                <option value={5}>Best of 5</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !unit1Id || !unit2Id}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ScoreEditModal = ({ game, data, onClose, onSuccess }) => {
  const [unit1Score, setUnit1Score] = useState(game.unit1Score);
  const [unit2Score, setUnit2Score] = useState(game.unit2Score);
  const [courtId, setCourtId] = useState(game.courtId || '');
  const [submitting, setSubmitting] = useState(false);

  const availableCourts = data.courts.filter(c => c.status === 'Available' || c.id === game.courtId);
  const isCompleted = game.status === 'Completed';
  const isInProgress = game.status === 'InProgress';
  const hasBestOf = game.bestOf > 1;

  // Quick score adjustment
  const adjustScore = (team, delta) => {
    if (team === 1) {
      setUnit1Score(prev => Math.max(0, prev + delta));
    } else {
      setUnit2Score(prev => Math.max(0, prev + delta));
    }
  };

  const handleSaveScore = async (finish = false) => {
    setSubmitting(true);
    try {
      await gamedayApi.updateScore(game.id, {
        gameNumber: game.currentGameNumber,
        unit1Score,
        unit2Score,
        isFinished: finish
      });
      onSuccess();
    } catch (err) {
      console.error('Error updating score:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignCourt = async () => {
    try {
      await gamedayApi.assignCourt(game.id, { courtId: courtId ? parseInt(courtId) : null });
      onSuccess();
    } catch (err) {
      console.error('Error assigning court:', err);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      await gamedayApi.updateGameStatus(game.id, { status });
      onSuccess();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleStartGame = async () => {
    try {
      await gamedayApi.updateGameStatus(game.id, { status: 'InProgress' });
      onSuccess();
    } catch (err) {
      console.error('Error starting game:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Game</h2>
            {game.courtLabel && (
              <span className="text-sm text-gray-500">{game.courtLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[game.status] || 'bg-gray-100 text-gray-600'}`}>
              {game.status}
            </span>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Teams with winner highlight */}
        <div className="flex items-center justify-between mb-4 text-center">
          <div className={`flex-1 p-2 rounded-lg ${isCompleted && game.winnerUnitId === game.unit1?.id ? 'bg-green-100 ring-2 ring-green-500' : ''}`}>
            <div className="font-medium text-gray-900">{game.unit1?.name}</div>
            <div className="text-xs text-gray-500">
              {game.unit1?.members?.map(m => m.name).join(', ')}
            </div>
            {isCompleted && game.winnerUnitId === game.unit1?.id && (
              <div className="text-xs text-green-600 font-medium mt-1">WINNER</div>
            )}
          </div>
          <div className="px-4 text-gray-400 text-sm">vs</div>
          <div className={`flex-1 p-2 rounded-lg ${isCompleted && game.winnerUnitId === game.unit2?.id ? 'bg-green-100 ring-2 ring-green-500' : ''}`}>
            <div className="font-medium text-gray-900">{game.unit2?.name}</div>
            <div className="text-xs text-gray-500">
              {game.unit2?.members?.map(m => m.name).join(', ')}
            </div>
            {isCompleted && game.winnerUnitId === game.unit2?.id && (
              <div className="text-xs text-green-600 font-medium mt-1">WINNER</div>
            )}
          </div>
        </div>

        {/* Best-of series info */}
        {hasBestOf && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-center text-sm text-gray-600 mb-2">
              Best of {game.bestOf} • Game {game.currentGameNumber}
            </div>
            <div className="flex justify-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{game.unit1Wins}</div>
                <div className="text-xs text-gray-500">Games Won</div>
              </div>
              <div className="text-xl text-gray-300 self-center">-</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{game.unit2Wins}</div>
                <div className="text-xs text-gray-500">Games Won</div>
              </div>
            </div>
            {/* Previous game scores */}
            {game.games?.length > 1 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Previous Games:</div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {game.games.filter(g => g.status === 'Finished').map(g => (
                    <span key={g.gameNumber} className="px-2 py-1 bg-white rounded text-xs">
                      G{g.gameNumber}: {g.unit1Score}-{g.unit2Score}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Score Input with +/- buttons */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2 text-center">
            {hasBestOf ? `Game ${game.currentGameNumber} Score` : 'Score'}
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustScore(1, -1)}
                  disabled={isCompleted || unit1Score === 0}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-xl font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={unit1Score}
                  onChange={(e) => setUnit1Score(parseInt(e.target.value) || 0)}
                  disabled={isCompleted}
                  className="w-16 h-14 text-3xl font-bold text-center border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
                <button
                  onClick={() => adjustScore(1, 1)}
                  disabled={isCompleted}
                  className="w-10 h-10 rounded-lg bg-blue-100 hover:bg-blue-200 disabled:opacity-50 text-xl font-bold text-blue-700"
                >
                  +
                </button>
              </div>
            </div>
            <span className="text-2xl text-gray-400">-</span>
            <div className="text-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustScore(2, -1)}
                  disabled={isCompleted || unit2Score === 0}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-xl font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={unit2Score}
                  onChange={(e) => setUnit2Score(parseInt(e.target.value) || 0)}
                  disabled={isCompleted}
                  className="w-16 h-14 text-3xl font-bold text-center border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
                <button
                  onClick={() => adjustScore(2, 1)}
                  disabled={isCompleted}
                  className="w-10 h-10 rounded-lg bg-blue-100 hover:bg-blue-200 disabled:opacity-50 text-xl font-bold text-blue-700"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Start Button */}
        {!isInProgress && !isCompleted && game.courtId && (
          <div className="mb-6">
            <button
              onClick={handleStartGame}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-lg font-medium"
            >
              <Play className="w-5 h-5" />
              Start Game
            </button>
          </div>
        )}

        {/* Court Assignment */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Court</label>
          <div className="flex gap-2">
            <select
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Unassigned</option>
              {availableCourts.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            {courtId !== (game.courtId || '').toString() && (
              <button
                onClick={handleAssignCourt}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Update
              </button>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <div className="flex flex-wrap gap-2">
            {['Pending', 'Queued', 'InProgress', 'Completed'].map(status => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  game.status === status
                    ? STATUS_COLORS[status] + ' ring-2 ring-offset-1 ring-blue-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Close
          </button>
          {!isCompleted && (
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveScore(false)}
                disabled={submitting}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => handleSaveScore(true)}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Finish Game
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const NewFormatModal = ({ eventId, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [scoreMethodId, setScoreMethodId] = useState('');
  const [maxPoints, setMaxPoints] = useState(11);
  const [winByMargin, setWinByMargin] = useState(2);
  const [capAfter, setCapAfter] = useState(0);
  const [switchEnds, setSwitchEnds] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scoreMethods, setScoreMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [showMethodDescription, setShowMethodDescription] = useState(false);

  // Load score methods on mount
  useEffect(() => {
    const loadScoreMethods = async () => {
      try {
        const response = await scoreMethodsApi.getAll();
        if (response.success) {
          setScoreMethods(response.data || []);
          // Set default score method if one exists
          const defaultMethod = response.data?.find(m => m.isDefault);
          if (defaultMethod) {
            setScoreMethodId(defaultMethod.id.toString());
          }
        }
      } catch (err) {
        console.error('Error loading score methods:', err);
      } finally {
        setLoadingMethods(false);
      }
    };
    loadScoreMethods();
  }, []);

  const selectedMethod = scoreMethods.find(m => m.id.toString() === scoreMethodId);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await gamedayApi.createScoreFormat(eventId, {
        name: name.trim(),
        scoreMethodId: scoreMethodId ? parseInt(scoreMethodId) : null,
        scoringType: selectedMethod?.baseType || 'Rally',
        maxPoints,
        winByMargin,
        capAfter,
        switchEndsAtMidpoint: switchEnds
      });
      onSuccess();
    } catch (err) {
      console.error('Error creating format:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Generate Play To options (7 to 39)
  const playToOptions = [];
  for (let i = 7; i <= 39; i++) {
    playToOptions.push(i);
  }

  // Generate Cap After options (0 to 9)
  const capAfterOptions = [];
  for (let i = 0; i <= 9; i++) {
    capAfterOptions.push(i);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-4">New Score Format</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Rally to 15"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Score Method</label>
            {loadingMethods ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : (
              <div className="relative">
                <select
                  value={scoreMethodId}
                  onChange={(e) => setScoreMethodId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg pr-10"
                >
                  <option value="">-- Select Score Method --</option>
                  {scoreMethods.map(method => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
                {selectedMethod?.description && (
                  <button
                    type="button"
                    onClick={() => setShowMethodDescription(!showMethodDescription)}
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600"
                    title="View description"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            {showMethodDescription && selectedMethod?.description && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                {selectedMethod.description}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Play To</label>
              <select
                value={maxPoints}
                onChange={(e) => setMaxPoints(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {playToOptions.map(pts => (
                  <option key={pts} value={pts}>{pts}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Win By</label>
              <select
                value={winByMargin}
                onChange={(e) => setWinByMargin(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cap After
              <span className="text-gray-500 font-normal ml-1">(0 = no cap)</span>
            </label>
            <select
              value={capAfter}
              onChange={(e) => setCapAfter(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {capAfterOptions.map(cap => (
                <option key={cap} value={cap}>
                  {cap === 0 ? 'No cap' : `+${cap} (cap at ${maxPoints + cap})`}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={switchEnds}
              onChange={(e) => setSwitchEnds(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Change Ends at midpoint</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Format'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameDayManage;
