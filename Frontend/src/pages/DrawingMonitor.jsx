import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Radio, Users, ChevronLeft, Play, SkipForward, Check, X, Loader2,
  AlertCircle, User, Wifi, WifiOff, Eye, Shuffle, Trophy, Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDrawingHub } from '../hooks/useDrawingHub';
import { tournamentApi, getSharedAssetUrl } from '../services/api';

// Confetti effect component
function Confetti({ active }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (active) {
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        color: ['#F97316', '#EF4444', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'][Math.floor(Math.random() * 6)]
      }));
      setParticles(newParticles);
      const timer = setTimeout(() => setParticles([]), 4000);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute w-3 h-3 rounded-full"
          style={{
            left: `${p.x}%`,
            backgroundColor: p.color,
            animation: `confetti ${p.duration}s ease-out ${p.delay}s forwards`
          }}
        />
      ))}
    </div>
  );
}

export default function DrawingMonitor() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [drawingLoading, setDrawingLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [latestUnit, setLatestUnit] = useState(null);
  const lastDrawnRef = useRef({});

  const {
    connect,
    disconnect,
    joinEventDrawing,
    leaveEventDrawing,
    viewers,
    divisionStates,
    initializeDivisionStates,
    connectionState,
    isConnected
  } = useDrawingHub();

  // Load event drawing state
  const loadEventData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await tournamentApi.getEventDrawingState(eventId);
      if (response.success && response.data) {
        const data = response.data;
        setEventData(data);
        initializeDivisionStates(data.divisions);

        // Check if user is organizer
        // This would typically come from the event data or a separate check
        setIsOrganizer(isAuthenticated); // Simplified - you'd check actual organizer status
      } else {
        setError('Failed to load event data');
      }
    } catch (err) {
      console.error('Error loading event:', err);
      setError(err?.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  // Connect to SignalR and join event drawing
  useEffect(() => {
    if (!eventId) return;

    let mounted = true;

    const init = async () => {
      await loadEventData();

      const conn = await connect();
      if (!conn || !mounted) return;

      // Join event drawing with user info
      const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : null;
      const avatarUrl = user?.profileImageUrl || null;
      await joinEventDrawing(parseInt(eventId), displayName, avatarUrl);
    };

    init();

    return () => {
      mounted = false;
      leaveEventDrawing(parseInt(eventId));
      disconnect();
    };
  }, [eventId, user]);

  // Track latest drawn unit for animation
  useEffect(() => {
    Object.entries(divisionStates).forEach(([divId, state]) => {
      if (state.drawnUnits && state.drawnUnits.length > 0) {
        const newest = state.drawnUnits[state.drawnUnits.length - 1];
        const key = `${divId}-${newest.unitId}`;
        if (!lastDrawnRef.current[key]) {
          lastDrawnRef.current[key] = true;
          setLatestUnit({ divisionId: parseInt(divId), ...newest });
          setTimeout(() => setLatestUnit(null), 3000);
        }
      }
    });
  }, [divisionStates]);

  // Drawing actions (for organizers)
  const handleStartDrawing = async (divisionId) => {
    try {
      setDrawingLoading(true);
      const response = await tournamentApi.startDrawing(divisionId);
      if (!response.success) {
        alert(response.message || 'Failed to start drawing');
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to start drawing');
    } finally {
      setDrawingLoading(false);
    }
  };

  const handleDrawNext = async (divisionId) => {
    try {
      setDrawingLoading(true);
      const response = await tournamentApi.drawNextUnit(divisionId);
      if (!response.success) {
        alert(response.message || 'Failed to draw unit');
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to draw unit');
    } finally {
      setDrawingLoading(false);
    }
  };

  const handleCompleteDrawing = async (divisionId) => {
    try {
      setDrawingLoading(true);
      const response = await tournamentApi.completeDrawing(divisionId);
      if (response.success) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      } else {
        alert(response.message || 'Failed to complete drawing');
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to complete drawing');
    } finally {
      setDrawingLoading(false);
    }
  };

  const handleCancelDrawing = async (divisionId) => {
    if (!confirm('Are you sure you want to cancel this drawing? All progress will be lost.')) return;

    try {
      setDrawingLoading(true);
      await tournamentApi.cancelDrawing(divisionId);
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to cancel drawing');
    } finally {
      setDrawingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading drawing...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const divisions = Object.values(divisionStates);
  const authenticatedViewers = viewers.filter(v => v.isAuthenticated);
  const anonymousCount = viewers.filter(v => !v.isAuthenticated).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 5px rgba(249, 115, 22, 0.5); }
          50% { box-shadow: 0 0 20px rgba(249, 115, 22, 0.8); }
        }
        @keyframes slide-in {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.5s ease-out; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
      `}</style>

      <Confetti active={showConfetti} />

      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/events/${eventId}`}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                    <Radio className="w-5 h-5 text-white" />
                  </div>
                  {divisions.some(d => d.drawingInProgress) && (
                    <div className="absolute -top-1 -right-1 w-3 h-3">
                      <div className="absolute inset-0 bg-red-500 rounded-full animate-ping" />
                      <div className="relative w-full h-full bg-red-500 rounded-full" />
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Live Drawing</h1>
                  <p className="text-sm text-gray-400">{eventData?.eventName}</p>
                </div>
              </div>
            </div>

            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              isConnected ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'
            }`}>
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isConnected ? 'Live' : connectionState === 'connecting' ? 'Connecting...' : 'Offline'}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content - Divisions */}
          <div className="lg:col-span-3 space-y-6">
            {/* Latest Draw Highlight */}
            {latestUnit && (
              <div className="animate-slide-in">
                <div className="p-4 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/50 rounded-xl">
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <div className="text-sm text-orange-400 mb-1">Just Drawn!</div>
                      <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center animate-pulse-glow">
                        <span className="text-2xl font-bold text-white">#{latestUnit.unitNumber}</span>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-bold text-white">{latestUnit.unitName}</div>
                      {latestUnit.memberNames && latestUnit.memberNames.length > 0 && (
                        <div className="text-sm text-gray-400">
                          {latestUnit.memberNames.join(' & ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Divisions */}
            {divisions.map((division) => (
              <div
                key={division.divisionId}
                className={`bg-gray-800/50 rounded-xl overflow-hidden border ${
                  division.drawingInProgress
                    ? 'border-orange-500/50 shadow-lg shadow-orange-500/10'
                    : 'border-gray-700'
                }`}
              >
                {/* Division Header */}
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      division.drawingInProgress
                        ? 'bg-orange-500'
                        : division.scheduleStatus === 'UnitsAssigned'
                        ? 'bg-green-500'
                        : 'bg-gray-700'
                    }`}>
                      {division.drawingInProgress ? (
                        <Shuffle className="w-5 h-5 text-white animate-pulse" />
                      ) : division.scheduleStatus === 'UnitsAssigned' ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <Clock className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{division.divisionName}</h3>
                      <p className="text-sm text-gray-400">
                        {division.teamSize === 1 ? 'Singles' : `${division.teamSize} players/team`}
                        {' '}&bull;{' '}
                        {division.totalUnits} {division.totalUnits === 1 ? 'team' : 'teams'}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    division.drawingInProgress
                      ? 'bg-orange-500/20 text-orange-400'
                      : division.scheduleStatus === 'UnitsAssigned'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {division.drawingInProgress
                      ? `Drawing ${division.drawnCount}/${division.totalUnits}`
                      : division.scheduleStatus === 'UnitsAssigned'
                      ? 'Complete'
                      : 'Pending'}
                  </div>
                </div>

                {/* Progress Bar */}
                {(division.drawingInProgress || division.drawnCount > 0) && (
                  <div className="px-4 py-3 bg-gray-900/30">
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-400">
                        {division.drawnCount}/{division.totalUnits}
                      </div>
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-500"
                          style={{ width: `${(division.drawnCount / division.totalUnits) * 100}%` }}
                        />
                      </div>
                      <div className="text-sm text-gray-400">
                        {Math.round((division.drawnCount / division.totalUnits) * 100)}%
                      </div>
                    </div>
                  </div>
                )}

                {/* Drawn Units */}
                {division.drawnUnits && division.drawnUnits.length > 0 && (
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      Draw Order
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {division.drawnUnits.map((unit) => (
                        <div
                          key={unit.unitId}
                          className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                            latestUnit?.unitId === unit.unitId && latestUnit?.divisionId === division.divisionId
                              ? 'bg-orange-500/20 border border-orange-500/50'
                              : 'bg-gray-700/50'
                          }`}
                        >
                          <div className="w-7 h-7 bg-gradient-to-br from-orange-400 to-red-500 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-white">#{unit.unitNumber}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white truncate">{unit.unitName}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remaining Units */}
                {division.remainingUnitNames && division.remainingUnitNames.length > 0 && (
                  <div className="p-4 border-t border-gray-700/50">
                    <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <Shuffle className="w-4 h-4" />
                      Still in the Draw ({division.remainingUnitNames.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {division.remainingUnitNames.map((name, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-700/50 rounded text-sm text-gray-300"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Controls */}
                {isOrganizer && isAuthenticated && (
                  <div className="p-4 border-t border-gray-700 bg-gray-900/30">
                    <div className="flex flex-wrap gap-2">
                      {!division.drawingInProgress && division.scheduleStatus !== 'UnitsAssigned' && (
                        <button
                          onClick={() => handleStartDrawing(division.divisionId)}
                          disabled={drawingLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          Start Drawing
                        </button>
                      )}
                      {division.drawingInProgress && (
                        <>
                          <button
                            onClick={() => handleDrawNext(division.divisionId)}
                            disabled={drawingLoading || division.drawnCount >= division.totalUnits}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                          >
                            {drawingLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <SkipForward className="w-4 h-4" />
                            )}
                            Draw Next
                          </button>
                          {division.drawnCount >= division.totalUnits && (
                            <button
                              onClick={() => handleCompleteDrawing(division.divisionId)}
                              disabled={drawingLoading}
                              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                            >
                              <Check className="w-4 h-4" />
                              Complete
                            </button>
                          )}
                          <button
                            onClick={() => handleCancelDrawing(division.divisionId)}
                            disabled={drawingLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {divisions.length === 0 && (
              <div className="bg-gray-800/50 rounded-xl p-12 text-center border border-gray-700">
                <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-400">No divisions found</h3>
                <p className="text-sm text-gray-500 mt-2">This event doesn't have any divisions set up yet.</p>
              </div>
            )}
          </div>

          {/* Sidebar - Viewers */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Viewers Panel */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Eye className="w-4 h-4 text-orange-400" />
                      Watching
                    </h3>
                    <span className="text-sm text-gray-400">{viewers.length}</span>
                  </div>
                </div>

                <div className="p-4 max-h-96 overflow-y-auto">
                  {authenticatedViewers.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {authenticatedViewers.map((viewer) => (
                        <div
                          key={viewer.connectionId}
                          className="flex items-center gap-3 p-2 bg-gray-700/30 rounded-lg"
                        >
                          {viewer.avatarUrl ? (
                            <img
                              src={getSharedAssetUrl(viewer.avatarUrl)}
                              alt={viewer.displayName}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                              <User className="w-4 h-4 text-orange-400" />
                            </div>
                          )}
                          <span className="text-sm text-white truncate">{viewer.displayName}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {anonymousCount > 0 && (
                    <div className="flex items-center gap-3 p-2 bg-gray-700/30 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                        <Users className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-sm text-gray-400">
                        {anonymousCount} Anonymous {anonymousCount === 1 ? 'viewer' : 'viewers'}
                      </span>
                    </div>
                  )}

                  {viewers.length === 0 && (
                    <div className="text-center py-6">
                      <Eye className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No viewers yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Event Info */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
                <h3 className="font-semibold text-white mb-3">Event Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className={`font-medium ${
                      eventData?.tournamentStatus === 'Drawing'
                        ? 'text-orange-400'
                        : 'text-gray-300'
                    }`}>
                      {eventData?.tournamentStatus || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Divisions</span>
                    <span className="text-gray-300">{divisions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Completed</span>
                    <span className="text-gray-300">
                      {divisions.filter(d => d.scheduleStatus === 'UnitsAssigned').length}/{divisions.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
