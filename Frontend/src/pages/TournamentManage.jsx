import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Trophy, Calendar, Clock, MapPin, Play, Check, X,
  ChevronDown, ChevronUp, RefreshCw, Shuffle, Settings, Target,
  AlertCircle, Loader2, Plus, Edit2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tournamentApi, eventsApi, getSharedAssetUrl } from '../services/api';

export default function TournamentManage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [event, setEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [error, setError] = useState(null);

  // Schedule generation state
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [assigningNumbers, setAssigningNumbers] = useState(false);

  // Schedule display state
  const [schedule, setSchedule] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (eventId) {
      loadDashboard();
      loadEvent();
    }
  }, [eventId]);

  useEffect(() => {
    if (selectedDivision?.scheduleReady) {
      loadSchedule(selectedDivision.id);
    } else {
      setSchedule(null);
    }
  }, [selectedDivision]);

  const loadDashboard = async () => {
    try {
      const response = await tournamentApi.getDashboard(eventId);
      if (response.success) {
        setDashboard(response.data);
        if (!selectedDivision && response.data.divisions?.length > 0) {
          setSelectedDivision(response.data.divisions[0]);
        }
      } else {
        setError(response.message || 'Failed to load tournament dashboard');
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load tournament dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadEvent = async () => {
    try {
      const response = await eventsApi.getEvent(eventId);
      if (response.success) {
        setEvent(response.data);
      }
    } catch (err) {
      console.error('Error loading event:', err);
    }
  };

  const loadSchedule = async (divisionId) => {
    setLoadingSchedule(true);
    try {
      const response = await tournamentApi.getSchedule(divisionId);
      if (response.success) {
        setSchedule(response.data);
      }
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!confirm(`Are you sure you want to change tournament status to "${newStatus}"?`)) return;

    setUpdatingStatus(true);
    try {
      const response = await tournamentApi.updateTournamentStatus(eventId, newStatus);
      if (response.success) {
        loadDashboard();
        loadEvent();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleGenerateSchedule = async (divisionId, scheduleType = 'RoundRobin') => {
    if (!confirm(`Generate ${scheduleType} schedule for this division? This will create all matches.`)) return;

    setGeneratingSchedule(true);
    try {
      const response = await tournamentApi.generateSchedule(divisionId, {
        divisionId,
        scheduleType,
        bestOf: 1
      });
      if (response.success) {
        loadDashboard();
      } else {
        alert(response.message || 'Failed to generate schedule');
      }
    } catch (err) {
      console.error('Error generating schedule:', err);
      alert('Failed to generate schedule');
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const handleAssignUnitNumbers = async (divisionId) => {
    if (!confirm('Assign random unit numbers to all teams? This is typically done before revealing the schedule.')) return;

    setAssigningNumbers(true);
    try {
      const response = await tournamentApi.assignUnitNumbers(divisionId);
      if (response.success) {
        loadDashboard();
      } else {
        alert(response.message || 'Failed to assign numbers');
      }
    } catch (err) {
      console.error('Error assigning numbers:', err);
    } finally {
      setAssigningNumbers(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link to="/events" className="text-orange-600 hover:underline">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const isOrganizer = event?.organizedByUserId === user?.id;
  const statusColors = {
    Draft: 'bg-gray-100 text-gray-700',
    RegistrationOpen: 'bg-green-100 text-green-700',
    RegistrationClosed: 'bg-yellow-100 text-yellow-700',
    ScheduleReady: 'bg-blue-100 text-blue-700',
    Running: 'bg-purple-100 text-purple-700',
    Completed: 'bg-gray-100 text-gray-700',
    Cancelled: 'bg-red-100 text-red-700'
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/events" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{dashboard?.eventName || 'Tournament'}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[dashboard?.tournamentStatus] || 'bg-gray-100 text-gray-700'}`}>
                    {dashboard?.tournamentStatus?.replace(/([A-Z])/g, ' $1').trim() || 'Unknown'}
                  </span>
                  {event && (
                    <span className="text-sm text-gray-500">
                      {formatDate(event.startDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {isOrganizer && (
              <div className="flex items-center gap-2">
                <select
                  value={dashboard?.tournamentStatus || ''}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  disabled={updatingStatus}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="Draft">Draft</option>
                  <option value="RegistrationOpen">Registration Open</option>
                  <option value="RegistrationClosed">Registration Closed</option>
                  <option value="ScheduleReady">Schedule Ready</option>
                  <option value="Running">Running</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto">
            {['overview', 'divisions', 'courts', 'schedule'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Users className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboard?.stats?.totalRegistrations || 0}
                    </div>
                    <div className="text-sm text-gray-500">Registered</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboard?.stats?.checkedInPlayers || 0}
                    </div>
                    <div className="text-sm text-gray-500">Checked In</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Target className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboard?.stats?.completedMatches || 0} / {dashboard?.stats?.totalMatches || 0}
                    </div>
                    <div className="text-sm text-gray-500">Matches</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboard?.stats?.inUseCourts || 0} / {dashboard?.stats?.availableCourts + dashboard?.stats?.inUseCourts || 0}
                    </div>
                    <div className="text-sm text-gray-500">Courts in Use</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Division Summary */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Division Status</h2>
              <div className="space-y-4">
                {dashboard?.divisions?.map(div => (
                  <div key={div.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{div.name}</h3>
                        <div className="flex gap-4 text-sm text-gray-500 mt-1">
                          <span>{div.registeredUnits} / {div.maxUnits || '∞'} teams</span>
                          {div.waitlistedUnits > 0 && (
                            <span className="text-yellow-600">+{div.waitlistedUnits} waitlisted</span>
                          )}
                          <span>{div.completedMatches} / {div.totalMatches} matches</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {div.scheduleReady ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                            Schedule Ready
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                            No Schedule
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    {div.totalMatches > 0 && (
                      <div className="mt-3">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${(div.completedMatches / div.totalMatches) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Court Status */}
            {dashboard?.courts?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Court Status</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {dashboard.courts.map(court => (
                    <div
                      key={court.id}
                      className={`border rounded-lg p-4 ${
                        court.status === 'InUse' ? 'border-orange-300 bg-orange-50' :
                        court.status === 'Available' ? 'border-green-300 bg-green-50' :
                        'border-gray-200'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{court.courtLabel}</div>
                      <div className={`text-sm ${
                        court.status === 'InUse' ? 'text-orange-600' :
                        court.status === 'Available' ? 'text-green-600' :
                        'text-gray-500'
                      }`}>
                        {court.status}
                      </div>
                      {court.currentGame && (
                        <div className="text-xs text-gray-500 mt-1">
                          Game #{court.currentGame.gameNumber}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divisions Tab */}
        {activeTab === 'divisions' && (
          <div className="space-y-6">
            {dashboard?.divisions?.map(div => (
              <div key={div.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{div.name}</h2>
                    <p className="text-sm text-gray-500">
                      {div.registeredUnits} teams registered
                    </p>
                  </div>
                  {isOrganizer && (
                    <div className="flex items-center gap-2">
                      {!div.unitsAssigned && (
                        <button
                          onClick={() => handleAssignUnitNumbers(div.id)}
                          disabled={assigningNumbers}
                          className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Shuffle className="w-4 h-4" />
                          Assign Numbers
                        </button>
                      )}
                      {!div.scheduleReady && div.registeredUnits >= 2 && (
                        <button
                          onClick={() => handleGenerateSchedule(div.id)}
                          disabled={generatingSchedule}
                          className="px-3 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 flex items-center gap-2 disabled:opacity-50"
                        >
                          {generatingSchedule ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Generate Schedule
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {div.registeredUnits === 0 ? (
                  <p className="text-gray-500 text-center py-8">No teams registered yet</p>
                ) : (
                  <div className="text-sm text-gray-500">
                    {div.scheduleReady
                      ? `${div.completedMatches} of ${div.totalMatches} matches completed`
                      : 'Schedule not yet generated'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Courts Tab */}
        {activeTab === 'courts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Tournament Courts</h2>
              {isOrganizer && (
                <button className="px-3 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Court
                </button>
              )}
            </div>

            {dashboard?.courts?.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Courts Configured</h3>
                <p className="text-gray-500 mb-4">Add courts to start assigning games</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboard?.courts?.map(court => (
                  <div key={court.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900">{court.courtLabel}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        court.status === 'InUse' ? 'bg-orange-100 text-orange-700' :
                        court.status === 'Available' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {court.status}
                      </span>
                    </div>
                    {court.locationDescription && (
                      <p className="text-sm text-gray-500">{court.locationDescription}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Match Schedule</h2>
              <button
                onClick={loadDashboard}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Division selector */}
            {dashboard?.divisions?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dashboard.divisions.map(div => (
                  <button
                    key={div.id}
                    onClick={() => setSelectedDivision(div)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${
                      selectedDivision?.id === div.id
                        ? 'bg-orange-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {div.name}
                  </button>
                ))}
              </div>
            )}

            {selectedDivision?.scheduleReady ? (
              loadingSchedule ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                </div>
              ) : schedule ? (
                <div className="space-y-6">
                  {/* Rounds and Matches */}
                  {schedule.rounds?.map((round, roundIdx) => (
                    <div key={roundIdx} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b">
                        <h3 className="font-medium text-gray-900">
                          {round.roundName || `${round.roundType} - Round ${round.roundNumber}`}
                        </h3>
                      </div>
                      <div className="divide-y">
                        {round.matches?.map((match, matchIdx) => (
                          <div key={matchIdx} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="text-sm text-gray-400 w-8">#{match.matchNumber}</div>
                                <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                                  <div className={`text-right ${match.winnerName === match.unit1Name ? 'font-semibold text-green-600' : 'text-gray-900'}`}>
                                    {match.unit1Name || `Unit #${match.unit1Number || '?'}`}
                                  </div>
                                  <div className="text-center">
                                    {match.score ? (
                                      <span className="font-medium text-gray-700">{match.score}</span>
                                    ) : (
                                      <span className="text-gray-400">vs</span>
                                    )}
                                  </div>
                                  <div className={`${match.winnerName === match.unit2Name ? 'font-semibold text-green-600' : 'text-gray-900'}`}>
                                    {match.unit2Name || `Unit #${match.unit2Number || '?'}`}
                                  </div>
                                </div>
                              </div>
                              <span className={`ml-4 px-2 py-1 text-xs font-medium rounded-full ${
                                match.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                match.status === 'InProgress' ? 'bg-orange-100 text-orange-700' :
                                match.status === 'Scheduled' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {match.status}
                              </span>
                            </div>
                            {match.courtLabel && (
                              <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                                <MapPin className="w-3 h-3" />
                                {match.courtLabel}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Pool Standings */}
                  {schedule.poolStandings?.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b">
                        <h3 className="font-medium text-gray-900">Pool Standings</h3>
                      </div>
                      <div className="p-4 space-y-6">
                        {schedule.poolStandings.map((pool, poolIdx) => (
                          <div key={poolIdx}>
                            <h4 className="font-medium text-gray-700 mb-2">
                              {pool.poolName || `Pool ${pool.poolNumber}`}
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="text-gray-500 border-b">
                                  <tr>
                                    <th className="text-left py-2 pr-4">#</th>
                                    <th className="text-left py-2 pr-4">Team</th>
                                    <th className="text-center py-2 px-2">W</th>
                                    <th className="text-center py-2 px-2">L</th>
                                    <th className="text-center py-2 px-2">GW</th>
                                    <th className="text-center py-2 px-2">GL</th>
                                    <th className="text-center py-2 px-2">+/-</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pool.standings?.map((standing, idx) => (
                                    <tr key={idx} className="border-b last:border-0">
                                      <td className="py-2 pr-4 font-medium text-gray-400">{standing.rank}</td>
                                      <td className="py-2 pr-4 text-gray-900">
                                        {standing.unitName || `Unit #${standing.unitNumber}`}
                                      </td>
                                      <td className="py-2 px-2 text-center text-green-600">{standing.matchesWon}</td>
                                      <td className="py-2 px-2 text-center text-red-600">{standing.matchesLost}</td>
                                      <td className="py-2 px-2 text-center text-gray-600">{standing.gamesWon}</td>
                                      <td className="py-2 px-2 text-center text-gray-600">{standing.gamesLost}</td>
                                      <td className={`py-2 px-2 text-center ${
                                        standing.pointDifferential > 0 ? 'text-green-600' :
                                        standing.pointDifferential < 0 ? 'text-red-600' : 'text-gray-400'
                                      }`}>
                                        {standing.pointDifferential > 0 ? '+' : ''}{standing.pointDifferential}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-gray-600">
                    Schedule for {selectedDivision.name} is ready.
                    {selectedDivision.completedMatches} of {selectedDivision.totalMatches} matches completed.
                  </p>
                </div>
              )
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Yet</h3>
                <p className="text-gray-500 mb-4">
                  Generate a schedule from the Divisions tab when you have enough registrations
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
