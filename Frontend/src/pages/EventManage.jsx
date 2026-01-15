import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Calendar, Clock, MapPin, Play, Check,
  ChevronRight, AlertCircle, Loader2, Settings,
  LayoutGrid, UserCheck, DollarSign, Shuffle, Trophy, Zap,
  UserPlus, X, Plus, Search, ToggleLeft, ToggleRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api, { eventsApi, checkInApi } from '../services/api';

// Scheduling API
const schedulingApi = {
  generateRound: (eventId, data) => api.post(`/gameday/events/${eventId}/generate-round`, data),
  getPlayers: (eventId, checkedInOnly = false) => api.get(`/gameday/events/${eventId}/players?checkedInOnly=${checkedInOnly}`),
  createManualGame: (eventId, data) => api.post(`/gameday/events/${eventId}/manual-game`, data),
  searchUsers: (eventId, query) => api.get(`/gameday/events/${eventId}/search-users?query=${encodeURIComponent(query)}`),
  onSiteJoin: (eventId, data) => api.post(`/gameday/events/${eventId}/on-site-join`, data),
};

export default function EventManage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);

  // Scheduling state
  const [schedulingMethod, setSchedulingMethod] = useState('popcorn');
  const [teamSize, setTeamSize] = useState(2);
  const [checkedInOnly, setCheckedInOnly] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // Manual scheduling state
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [team1Players, setTeam1Players] = useState([]);
  const [team2Players, setTeam2Players] = useState([]);
  const [manualCheckedInOnly, setManualCheckedInOnly] = useState(false);

  // On-site join state
  const [allowOnSiteJoin, setAllowOnSiteJoin] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(null);

  useEffect(() => {
    if (eventId) {
      loadEvent();
    }
  }, [eventId]);

  // Load players when manual mode is selected
  useEffect(() => {
    if (schedulingMethod === 'manual' && eventId) {
      loadPlayers();
    }
  }, [schedulingMethod, eventId, manualCheckedInOnly]);

  const loadPlayers = async () => {
    setLoadingPlayers(true);
    try {
      const response = await schedulingApi.getPlayers(eventId, manualCheckedInOnly);
      if (response.success) {
        setAvailablePlayers(response.data || []);
      }
    } catch (err) {
      console.error('Error loading players:', err);
      toast.error('Failed to load players');
    } finally {
      setLoadingPlayers(false);
    }
  };

  const loadEvent = async () => {
    try {
      const response = await eventsApi.getEvent(eventId);
      if (response.success) {
        setEvent(response.data);
      } else {
        setError(response.message || 'Failed to load event');
      }
    } catch (err) {
      console.error('Error loading event:', err);
      setError('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRound = async () => {
    setGenerating(true);
    setLastResult(null);
    try {
      const response = await schedulingApi.generateRound(eventId, {
        method: schedulingMethod,
        teamSize: teamSize,
        checkedInOnly: checkedInOnly,
        bestOf: 1
      });
      if (response.success) {
        setLastResult(response.data);
        toast.success(response.message || `Created ${response.data.gamesCreated} games`);
      } else {
        toast.error(response.message || 'Failed to generate games');
      }
    } catch (err) {
      console.error('Error generating round:', err);
      toast.error(err.response?.data?.message || 'Failed to generate games');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateManualGame = async () => {
    if (team1Players.length === 0 || team2Players.length === 0) {
      toast.error('Please select players for both teams');
      return;
    }

    setGenerating(true);
    setLastResult(null);
    try {
      const response = await schedulingApi.createManualGame(eventId, {
        team1PlayerIds: team1Players.map(p => p.userId),
        team2PlayerIds: team2Players.map(p => p.userId),
        bestOf: 1
      });
      if (response.success) {
        setLastResult({ gamesCreated: 1, playersAssigned: team1Players.length + team2Players.length });
        toast.success('Game created successfully');
        // Clear selections and reload players
        setTeam1Players([]);
        setTeam2Players([]);
        loadPlayers();
      } else {
        toast.error(response.message || 'Failed to create game');
      }
    } catch (err) {
      console.error('Error creating game:', err);
      toast.error(err.response?.data?.message || 'Failed to create game');
    } finally {
      setGenerating(false);
    }
  };

  const addPlayerToTeam = (player, team) => {
    if (team === 1) {
      if (!team1Players.find(p => p.userId === player.userId)) {
        setTeam1Players([...team1Players, player]);
      }
    } else {
      if (!team2Players.find(p => p.userId === player.userId)) {
        setTeam2Players([...team2Players, player]);
      }
    }
  };

  const removePlayerFromTeam = (playerId, team) => {
    if (team === 1) {
      setTeam1Players(team1Players.filter(p => p.userId !== playerId));
    } else {
      setTeam2Players(team2Players.filter(p => p.userId !== playerId));
    }
  };

  // On-site join handlers
  const handleSearchUsers = async (query) => {
    setUserSearchQuery(query);
    if (query.length < 2) {
      setUserSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    try {
      const response = await schedulingApi.searchUsers(eventId, query);
      if (response.success) {
        setUserSearchResults(response.data || []);
      }
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleAddOnSitePlayer = async (userToAdd) => {
    setAddingPlayer(userToAdd.userId);
    try {
      const response = await schedulingApi.onSiteJoin(eventId, {
        userId: userToAdd.userId
      });
      if (response.success) {
        toast.success(response.message || `${userToAdd.name} added to event`);
        // Clear search and reload players
        setUserSearchQuery('');
        setUserSearchResults([]);
        // Reload available players if in manual mode
        if (schedulingMethod === 'manual') {
          loadPlayers();
        }
      } else {
        toast.error(response.message || 'Failed to add player');
      }
    } catch (err) {
      console.error('Error adding player:', err);
      toast.error(err.response?.data?.message || 'Failed to add player');
    } finally {
      setAddingPlayer(null);
    }
  };

  // Get players not yet assigned to any team
  const unassignedPlayers = availablePlayers.filter(
    p => !team1Players.find(t => t.userId === p.userId) && !team2Players.find(t => t.userId === p.userId)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-500 mb-4">{error || 'Event not found'}</p>
          <button onClick={() => navigate('/events')} className="text-blue-600 hover:underline">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  // Check if user is organizer
  const isOrganizer = event.organizedByUserId === user?.id;

  if (!isOrganizer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">You don't have permission to manage this event.</p>
          <button onClick={() => navigate('/events')} className="text-blue-600 hover:underline">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Calculate stats
  const totalRegistrations = event.divisions?.reduce((sum, d) => sum + (d.registeredCount || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/events?id=${eventId}`)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{event.name}</h1>
              <p className="text-sm text-gray-500">
                {event.eventTypeName || 'Event'} Dashboard
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Event Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            {event.posterImageUrl ? (
              <img
                src={getSharedAssetUrl(event.posterImageUrl)}
                alt={event.name}
                className="w-20 h-20 rounded-lg object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(event.startDate)}
                </div>
                {event.venueName && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {event.venueName}
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{totalRegistrations}</div>
                  <div className="text-xs text-gray-500">Registrations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{event.divisions?.length || 0}</div>
                  <div className="text-xs text-gray-500">Divisions</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Management Tools</h2>

          {/* Game Day Manager - Primary Action */}
          <Link
            to={`/gameday/${eventId}/manage`}
            className="block bg-blue-50 border-2 border-blue-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Play className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900">Game Day Manager</h3>
                <p className="text-blue-700 text-sm mt-1">
                  Create games, manage courts, and track scores in real-time
                </p>
              </div>
              <ChevronRight className="w-6 h-6 text-blue-400" />
            </div>
          </Link>

          {/* Secondary Actions Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* View Registrations */}
            <Link
              to={`/events?id=${eventId}`}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="p-2 bg-gray-100 rounded-lg">
                <Users className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">Registrations</div>
                <div className="text-sm text-gray-500">{totalRegistrations} registered</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>

            {/* Check-in */}
            <Link
              to={`/gameday/${eventId}/manage`}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">Check-in Players</div>
                <div className="text-sm text-gray-500">Manage attendance</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>

            {/* Courts */}
            <Link
              to={`/gameday/${eventId}/manage`}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="p-2 bg-orange-100 rounded-lg">
                <LayoutGrid className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">Manage Courts</div>
                <div className="text-sm text-gray-500">Court setup & assignments</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>

            {/* Edit Event */}
            <Link
              to={`/events?id=${eventId}`}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="p-2 bg-purple-100 rounded-lg">
                <Settings className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">Event Settings</div>
                <div className="text-sm text-gray-500">Edit event details</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* On-Site Join */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">On-Site Join</h2>
            <button
              onClick={() => setAllowOnSiteJoin(!allowOnSiteJoin)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                allowOnSiteJoin
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {allowOnSiteJoin ? (
                <>
                  <ToggleRight className="w-5 h-5" />
                  Enabled
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5" />
                  Disabled
                </>
              )}
            </button>
          </div>

          {allowOnSiteJoin && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Search for players to add them to this event. They will be automatically checked in.
                </p>

                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {searchingUsers && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
                  )}
                </div>

                {/* Search Results */}
                {userSearchResults.length > 0 && (
                  <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                    <div className="divide-y divide-gray-100">
                      {userSearchResults.map(user => (
                        <div key={user.userId} className="flex items-center justify-between p-3 hover:bg-gray-50">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                              {user.profileImageUrl ? (
                                <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">{user.name}</div>
                              {user.email && (
                                <div className="text-xs text-gray-500 truncate">{user.email}</div>
                              )}
                            </div>
                          </div>
                          {user.isAlreadyRegistered ? (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                              Already registered
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddOnSitePlayer(user)}
                              disabled={addingPlayer === user.userId}
                              className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 flex items-center gap-1"
                            >
                              {addingPlayer === user.userId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  Add
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {userSearchQuery.length >= 2 && userSearchResults.length === 0 && !searchingUsers && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No users found matching "{userSearchQuery}"
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Scheduling */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Quick Scheduling</h2>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="space-y-4">
              {/* Scheduling Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scheduling Method</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setSchedulingMethod('popcorn')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      schedulingMethod === 'popcorn'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shuffle className={`w-5 h-5 ${schedulingMethod === 'popcorn' ? 'text-orange-600' : 'text-gray-400'}`} />
                      <div className="text-left">
                        <div className={`font-medium text-sm ${schedulingMethod === 'popcorn' ? 'text-orange-900' : 'text-gray-900'}`}>
                          Popcorn
                        </div>
                        <div className="text-xs text-gray-500">Random</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSchedulingMethod('gauntlet')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      schedulingMethod === 'gauntlet'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className={`w-5 h-5 ${schedulingMethod === 'gauntlet' ? 'text-purple-600' : 'text-gray-400'}`} />
                      <div className="text-left">
                        <div className={`font-medium text-sm ${schedulingMethod === 'gauntlet' ? 'text-purple-900' : 'text-gray-900'}`}>
                          Gauntlet
                        </div>
                        <div className="text-xs text-gray-500">Winners stay</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSchedulingMethod('manual')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      schedulingMethod === 'manual'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus className={`w-5 h-5 ${schedulingMethod === 'manual' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div className="text-left">
                        <div className={`font-medium text-sm ${schedulingMethod === 'manual' ? 'text-blue-900' : 'text-gray-900'}`}>
                          Manual
                        </div>
                        <div className="text-xs text-gray-500">Pick players</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Automatic Scheduling Options (Popcorn/Gauntlet) */}
              {schedulingMethod !== 'manual' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Team Size</label>
                      <select
                        value={teamSize}
                        onChange={(e) => setTeamSize(parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg p-2"
                      >
                        <option value={1}>Singles (1v1)</option>
                        <option value={2}>Doubles (2v2)</option>
                        <option value={3}>Triples (3v3)</option>
                        <option value={4}>Quads (4v4)</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 p-2">
                        <input
                          type="checkbox"
                          checked={checkedInOnly}
                          onChange={(e) => setCheckedInOnly(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Checked-in only</span>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateRound}
                    disabled={generating}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Generate Round
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Manual Scheduling - Player Selection */}
              {schedulingMethod === 'manual' && (
                <div className="space-y-4">
                  {/* Checked-in filter */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={manualCheckedInOnly}
                        onChange={(e) => setManualCheckedInOnly(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Show checked-in only</span>
                    </label>
                    <button
                      onClick={loadPlayers}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Refresh
                    </button>
                  </div>

                  {loadingPlayers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* Team Selection */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Team 1 */}
                        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Team 1 ({team1Players.length})
                          </h4>
                          <div className="space-y-1 min-h-[60px]">
                            {team1Players.map(player => (
                              <div key={player.userId} className="flex items-center justify-between bg-white rounded px-2 py-1 text-sm">
                                <span className="truncate">{player.name}</span>
                                <button
                                  onClick={() => removePlayerFromTeam(player.userId, 1)}
                                  className="text-red-500 hover:text-red-700 ml-1"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {team1Players.length === 0 && (
                              <div className="text-xs text-blue-600 italic">Click players below to add</div>
                            )}
                          </div>
                        </div>

                        {/* Team 2 */}
                        <div className="border border-orange-200 rounded-lg p-3 bg-orange-50">
                          <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Team 2 ({team2Players.length})
                          </h4>
                          <div className="space-y-1 min-h-[60px]">
                            {team2Players.map(player => (
                              <div key={player.userId} className="flex items-center justify-between bg-white rounded px-2 py-1 text-sm">
                                <span className="truncate">{player.name}</span>
                                <button
                                  onClick={() => removePlayerFromTeam(player.userId, 2)}
                                  className="text-red-500 hover:text-red-700 ml-1"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {team2Players.length === 0 && (
                              <div className="text-xs text-orange-600 italic">Click players below to add</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Available Players */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Available Players ({unassignedPlayers.length})
                        </h4>
                        <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                          {unassignedPlayers.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">
                              {availablePlayers.length === 0 ? 'No players registered' : 'All players assigned'}
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {unassignedPlayers.map(player => (
                                <div key={player.userId} className="flex items-center justify-between p-2 hover:bg-gray-50">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`text-sm truncate ${!player.isAvailable ? 'text-gray-400' : ''}`}>
                                      {player.name}
                                    </span>
                                    {player.isCheckedIn && (
                                      <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">In</span>
                                    )}
                                    {!player.isAvailable && (
                                      <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">Playing</span>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => addPlayerToTeam(player, 1)}
                                      disabled={!player.isAvailable}
                                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      T1
                                    </button>
                                    <button
                                      onClick={() => addPlayerToTeam(player, 2)}
                                      disabled={!player.isAvailable}
                                      className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      T2
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Create Game Button */}
                      <button
                        onClick={handleCreateManualGame}
                        disabled={generating || team1Players.length === 0 || team2Players.length === 0}
                        className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-5 h-5" />
                            Create Game
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Result */}
              {lastResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-800">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">
                      Created {lastResult.gamesCreated} game{lastResult.gamesCreated !== 1 ? 's' : ''} with {lastResult.playersAssigned} players
                    </span>
                  </div>
                  <Link
                    to={`/gameday/${eventId}/manage`}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800"
                  >
                    View in Game Day Manager
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              )}

              {/* Method Description */}
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                {schedulingMethod === 'popcorn' && (
                  <p><strong>Popcorn:</strong> Players are randomly shuffled and paired into teams for each round. Everyone gets a fresh matchup.</p>
                )}
                {schedulingMethod === 'gauntlet' && (
                  <p><strong>Gauntlet:</strong> Winning teams stay on their court while losing teams rotate out. New challengers are randomly assigned.</p>
                )}
                {schedulingMethod === 'manual' && (
                  <p><strong>Manual:</strong> Select players individually for each team. Great for setting up specific matchups or accommodating player requests.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Quick Tips
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>On-Site Join</strong> - Add walk-in players who are automatically checked in</li>
            <li>• <strong>Popcorn</strong> is great for social play - everyone gets randomly matched</li>
            <li>• <strong>Gauntlet</strong> keeps winners playing - great for competitive sessions</li>
            <li>• <strong>Manual</strong> lets you pick exactly who plays - perfect for specific requests</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
