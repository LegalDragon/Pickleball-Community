import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Calendar, Clock, MapPin, Play, Check,
  ChevronRight, AlertCircle, Loader2, Settings, FileText,
  LayoutGrid, UserCheck, DollarSign, Shuffle, Trophy, Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api, { eventsApi, getSharedAssetUrl } from '../services/api';

// Scheduling API
const schedulingApi = {
  generateRound: (eventId, data) => api.post(`/gameday/events/${eventId}/generate-round`, data),
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

  useEffect(() => {
    if (eventId) {
      loadEvent();
    }
  }, [eventId]);

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

        {/* Quick Scheduling */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Quick Scheduling</h2>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="space-y-4">
              {/* Scheduling Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scheduling Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSchedulingMethod('popcorn')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      schedulingMethod === 'popcorn'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Shuffle className={`w-6 h-6 ${schedulingMethod === 'popcorn' ? 'text-orange-600' : 'text-gray-400'}`} />
                      <div className="text-left">
                        <div className={`font-medium ${schedulingMethod === 'popcorn' ? 'text-orange-900' : 'text-gray-900'}`}>
                          Popcorn
                        </div>
                        <div className="text-xs text-gray-500">Random player pairing</div>
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
                    <div className="flex items-center gap-3">
                      <Trophy className={`w-6 h-6 ${schedulingMethod === 'gauntlet' ? 'text-purple-600' : 'text-gray-400'}`} />
                      <div className="text-left">
                        <div className={`font-medium ${schedulingMethod === 'gauntlet' ? 'text-purple-900' : 'text-gray-900'}`}>
                          Gauntlet
                        </div>
                        <div className="text-xs text-gray-500">Winners stay on court</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Options */}
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

              {/* Generate Button */}
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

              {/* Result */}
              {lastResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-800">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">
                      Created {lastResult.gamesCreated} games with {lastResult.playersAssigned} players
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
                {schedulingMethod === 'popcorn' ? (
                  <p><strong>Popcorn:</strong> Players are randomly shuffled and paired into teams for each round. Everyone gets a fresh matchup.</p>
                ) : (
                  <p><strong>Gauntlet:</strong> Winning teams stay on their court while losing teams rotate out. New challengers are randomly assigned.</p>
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
            <li>• Use <strong>Quick Scheduling</strong> to automatically create games for all players</li>
            <li>• <strong>Popcorn</strong> is great for social play - everyone gets randomly matched</li>
            <li>• <strong>Gauntlet</strong> keeps winners playing - great for competitive sessions</li>
            <li>• Use <strong>Game Day Manager</strong> for manual game creation and scoring</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
