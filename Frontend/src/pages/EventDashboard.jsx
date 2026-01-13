import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar, MapPin, Clock, CheckCircle, XCircle, RefreshCw, ArrowLeft,
  Trophy, AlertTriangle, Bell, User, Users, ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { getSharedAssetUrl } from '../services/api';

// API endpoints
const eventRunningApi = {
  getPlayerDashboard: (eventId) => api.get(`/event-running/player/${eventId}`),
  checkIn: (eventId) => api.post(`/event-running/player/${eventId}/check-in`),
  submitScore: (gameId, data) => api.post(`/event-running/player/games/${gameId}/score`, data),
};

const STATUS_COLORS = {
  Scheduled: 'bg-gray-100 text-gray-700',
  Ready: 'bg-yellow-100 text-yellow-700',
  Queued: 'bg-orange-100 text-orange-700',
  InProgress: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
};

const EventDashboard = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { joinEvent, leaveEvent, addListener } = useNotifications();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule');
  const [checkingIn, setCheckingIn] = useState(false);

  // Modal states
  const [showScoreSubmit, setShowScoreSubmit] = useState(null);
  const [showScoreVerify, setShowScoreVerify] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await eventRunningApi.getPlayerDashboard(eventId);
      if (response.success) {
        setData(response.data);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      if (err.response?.status === 404) {
        setError('You are not registered for this event');
      } else {
        setError('Failed to load event data');
      }
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

  // Listen for real-time updates
  useEffect(() => {
    if (!addListener) return;
    const removeListener = addListener((notification) => {
      if (notification.referenceType === 'Event' && notification.referenceId === parseInt(eventId)) {
        loadData();
      }
      if (notification.referenceType === 'Game') {
        loadData();
      }
    });
    return removeListener;
  }, [addListener, eventId]);

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      await eventRunningApi.checkIn(eventId);
      loadData();
    } catch (err) {
      console.error('Error checking in:', err);
    } finally {
      setCheckingIn(false);
    }
  };

  // Get current match (playing or next up)
  const currentMatch = useMemo(() => {
    if (!data?.schedule) return null;
    return data.schedule.find(m => m.status === 'InProgress') ||
      data.schedule.find(m => m.status === 'Queued') ||
      data.schedule.find(m => m.status === 'Ready');
  }, [data?.schedule]);

  // Check if user is checked in
  const isCheckedIn = useMemo(() => {
    return data?.myUnits?.every(u => u.members.every(m => m.isMe ? m.isCheckedIn : true)) ?? false;
  }, [data?.myUnits]);

  // Matches needing attention (verify score)
  const matchesNeedingAction = useMemo(() => {
    if (!data?.schedule) return [];
    return data.schedule.filter(m => m.needsScoreVerification || m.isDisputed);
  }, [data?.schedule]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please sign in to view your event dashboard.</p>
          <Link to="/login" className="text-blue-600 hover:underline">Sign In</Link>
        </div>
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => navigate('/events')} className="text-blue-600 hover:underline">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/events')} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{data.eventName}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {data.venueName && (
                    <>
                      <MapPin className="w-4 h-4" />
                      <span>{data.venueName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button onClick={loadData} className="p-2 hover:bg-gray-100 rounded-lg" title="Refresh">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Check-in Banner */}
        {!isCheckedIn && data.tournamentStatus === 'Running' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Check-in Required</p>
                  <p className="text-sm text-yellow-600">Please check in to confirm your participation</p>
                </div>
              </div>
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                {checkingIn ? 'Checking in...' : 'Check In'}
              </button>
            </div>
          </div>
        )}

        {/* Action Required */}
        {matchesNeedingAction.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-red-800">Action Required</h3>
            </div>
            <div className="space-y-2">
              {matchesNeedingAction.map(match => (
                <div key={match.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-200">
                  <div>
                    <p className="font-medium">{match.unit1Name} vs {match.unit2Name}</p>
                    <p className="text-sm text-gray-500">
                      {match.needsScoreVerification ? 'Please verify the score' : 'Score disputed'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowScoreVerify(match)}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                  >
                    {match.needsScoreVerification ? 'Verify' : 'View'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current/Next Match */}
        {currentMatch && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              {currentMatch.status === 'InProgress' ? (
                <span className="flex items-center gap-1 text-blue-700">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  NOW PLAYING
                </span>
              ) : (
                <span className="text-blue-700">UP NEXT</span>
              )}
              {currentMatch.courtLabel && (
                <span className="text-blue-600 font-medium">- {currentMatch.courtLabel}</span>
              )}
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <p className={`font-bold text-lg ${currentMatch.myUnitId === currentMatch.unit1Id ? 'text-blue-600' : ''}`}>
                    {currentMatch.unit1Name}
                  </p>
                  {currentMatch.myUnitId === currentMatch.unit1Id && (
                    <span className="text-xs text-blue-500">You</span>
                  )}
                </div>
                <div className="px-4">
                  {currentMatch.status === 'InProgress' ? (
                    <div className="text-center">
                      <p className="text-3xl font-bold">{currentMatch.unit1Score} - {currentMatch.unit2Score}</p>
                      {currentMatch.bestOf > 1 && (
                        <p className="text-sm text-gray-500">
                          Game {currentMatch.currentGameNumber} ({currentMatch.unit1Wins}-{currentMatch.unit2Wins})
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">vs</span>
                  )}
                </div>
                <div className="text-center flex-1">
                  <p className={`font-bold text-lg ${currentMatch.myUnitId === currentMatch.unit2Id ? 'text-blue-600' : ''}`}>
                    {currentMatch.unit2Name}
                  </p>
                  {currentMatch.myUnitId === currentMatch.unit2Id && (
                    <span className="text-xs text-blue-500">You</span>
                  )}
                </div>
              </div>
              {currentMatch.status === 'InProgress' && (
                <button
                  onClick={() => setShowScoreSubmit(currentMatch)}
                  className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Submit Score
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {['schedule', 'standings', 'notifications'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium capitalize ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'schedule' && (
          <div className="space-y-3">
            {data.schedule.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No matches scheduled yet</p>
            ) : (
              data.schedule.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onSubmitScore={() => setShowScoreSubmit(match)}
                  onVerifyScore={() => setShowScoreVerify(match)}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'standings' && (
          <div className="space-y-4">
            {data.myUnits.map(unit => (
              <div key={unit.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{unit.name}</h3>
                    <p className="text-sm text-gray-500">{unit.divisionName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{unit.matchesWon}-{unit.matchesLost}</p>
                    <p className="text-xs text-gray-500">{unit.matchesPlayed} played</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unit.members.map(member => (
                    <div key={member.userId} className="flex items-center gap-2">
                      {member.profileImageUrl ? (
                        <img
                          src={getSharedAssetUrl(member.profileImageUrl)}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <span className={`text-sm ${member.isMe ? 'font-medium text-blue-600' : ''}`}>
                        {member.name}
                      </span>
                      {member.isCheckedIn && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-2">
            {data.notifications.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No notifications</p>
            ) : (
              data.notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg ${notification.isRead ? 'bg-white' : 'bg-blue-50'} border border-gray-200`}
                >
                  <div className="flex items-start gap-3">
                    <Bell className={`w-5 h-5 ${notification.isRead ? 'text-gray-400' : 'text-blue-500'}`} />
                    <div className="flex-1">
                      <p className="font-medium">{notification.title}</p>
                      {notification.message && (
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Court Status */}
        {data.courts?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold mb-3">Court Status</h3>
            <div className="grid grid-cols-3 gap-2">
              {data.courts.map(court => (
                <div
                  key={court.id}
                  className={`p-2 rounded-lg text-center text-sm ${
                    court.status === 'InUse'
                      ? 'bg-blue-100 text-blue-700'
                      : court.status === 'Available'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {court.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showScoreSubmit && (
        <ScoreSubmitModal
          match={showScoreSubmit}
          onClose={() => setShowScoreSubmit(null)}
          onSuccess={() => { setShowScoreSubmit(null); loadData(); }}
        />
      )}
      {showScoreVerify && (
        <ScoreVerifyModal
          match={showScoreVerify}
          onClose={() => setShowScoreVerify(null)}
          onSuccess={() => { setShowScoreVerify(null); loadData(); }}
        />
      )}
    </div>
  );
};

// ==========================================
// Components
// ==========================================

const MatchCard = ({ match, onSubmitScore, onVerifyScore }) => {
  const isMyTeamUnit1 = match.myUnitId === match.unit1Id;

  return (
    <div className={`bg-white rounded-xl border p-4 ${
      match.status === 'InProgress' ? 'border-blue-500' :
      match.needsScoreVerification ? 'border-red-500' :
      'border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[match.status]}`}>
            {match.status}
          </span>
          {match.courtLabel && (
            <span className="text-xs text-gray-500">{match.courtLabel}</span>
          )}
        </div>
        {match.scheduledTime && (
          <span className="text-xs text-gray-500">
            {new Date(match.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className={`flex-1 ${isMyTeamUnit1 ? 'font-bold text-blue-600' : ''}`}>
          {match.unit1Name}
        </div>
        <div className="px-4 text-center">
          {match.status === 'Completed' || match.status === 'InProgress' ? (
            <span className="font-bold">{match.unit1Score} - {match.unit2Score}</span>
          ) : (
            <span className="text-gray-400">vs</span>
          )}
        </div>
        <div className={`flex-1 text-right ${!isMyTeamUnit1 ? 'font-bold text-blue-600' : ''}`}>
          {match.unit2Name}
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        {match.divisionName} - {match.roundName || `Match ${match.matchNumber}`}
      </p>

      {/* Actions */}
      {match.status === 'InProgress' && !match.needsScoreVerification && (
        <button
          onClick={onSubmitScore}
          className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          Submit Score
        </button>
      )}
      {match.needsScoreVerification && (
        <button
          onClick={onVerifyScore}
          className="w-full mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
        >
          Verify Score
        </button>
      )}
      {match.isDisputed && (
        <p className="mt-3 text-sm text-red-600 text-center">Score disputed - awaiting TD resolution</p>
      )}

      {/* Game history for best-of */}
      {match.bestOf > 1 && match.games?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex justify-center gap-2">
            {match.games.map(game => (
              <div
                key={game.id}
                className={`text-xs px-2 py-1 rounded ${
                  game.status === 'Finished'
                    ? game.winnerUnitId === match.myUnitId
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                G{game.gameNumber}: {game.unit1Score}-{game.unit2Score}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ScoreSubmitModal = ({ match, onClose, onSuccess }) => {
  const currentGame = match.games?.find(g => g.status !== 'Finished') || match.games?.[match.games.length - 1];
  const [unit1Score, setUnit1Score] = useState(currentGame?.unit1Score || 0);
  const [unit2Score, setUnit2Score] = useState(currentGame?.unit2Score || 0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await eventRunningApi.submitScore(currentGame?.id || match.id, {
        unit1Score,
        unit2Score,
      });
      onSuccess();
    } catch (err) {
      console.error('Error submitting score:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold mb-4 text-center">Submit Score</h3>

        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">{match.unit1Name}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUnit1Score(Math.max(0, unit1Score - 1))}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl"
              >
                -
              </button>
              <span className="text-3xl font-bold w-12 text-center">{unit1Score}</span>
              <button
                onClick={() => setUnit1Score(unit1Score + 1)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl"
              >
                +
              </button>
            </div>
          </div>
          <span className="text-2xl text-gray-400">-</span>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">{match.unit2Name}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUnit2Score(Math.max(0, unit2Score - 1))}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl"
              >
                -
              </button>
              <span className="text-3xl font-bold w-12 text-center">{unit2Score}</span>
              <button
                onClick={() => setUnit2Score(unit2Score + 1)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500 text-center mb-4">
          Your opponent will need to verify this score
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ScoreVerifyModal = ({ match, onClose, onSuccess }) => {
  const currentGame = match.games?.find(g => g.status !== 'Finished') || match.games?.[match.games.length - 1];
  const [loading, setLoading] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await eventRunningApi.submitScore(currentGame?.id || match.id, {
        unit1Score: currentGame?.unit1Score || 0,
        unit2Score: currentGame?.unit2Score || 0,
        confirm: true,
      });
      onSuccess();
    } catch (err) {
      console.error('Error confirming score:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) return;
    try {
      setLoading(true);
      await eventRunningApi.submitScore(currentGame?.id || match.id, {
        unit1Score: currentGame?.unit1Score || 0,
        unit2Score: currentGame?.unit2Score || 0,
        confirm: false,
        disputeReason,
      });
      onSuccess();
    } catch (err) {
      console.error('Error disputing score:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold mb-4 text-center">Verify Score</h3>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">{match.unit1Name}</p>
              <p className="text-3xl font-bold">{currentGame?.unit1Score || 0}</p>
            </div>
            <span className="text-2xl text-gray-400">-</span>
            <div className="text-center">
              <p className="text-sm text-gray-500">{match.unit2Name}</p>
              <p className="text-3xl font-bold">{currentGame?.unit2Score || 0}</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 text-center mb-4">
          Your opponent submitted this score. Is it correct?
        </p>

        {disputing ? (
          <div className="space-y-3">
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Please explain the correct score..."
              className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setDisputing(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleDispute}
                disabled={loading || !disputeReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Dispute'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Confirming...' : 'Confirm Score'}
            </button>
            <button
              onClick={() => setDisputing(true)}
              className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              Dispute Score
            </button>
            <button onClick={onClose} className="w-full px-4 py-2 text-gray-500 hover:bg-gray-50 rounded-lg">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDashboard;
