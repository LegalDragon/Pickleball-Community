import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Radio, Users, ChevronLeft, Play, Check, X, Loader2,
  AlertCircle, User, Wifi, WifiOff, Eye, Shuffle, Trophy, Clock,
  RotateCcw, ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useDrawingHub } from '../hooks/useDrawingHub';
import { tournamentApi, getSharedAssetUrl } from '../services/api';
import DrawingModal from '../components/DrawingModal';

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

// Countdown component
function Countdown({ count, onComplete }) {
  useEffect(() => {
    if (count === 0) {
      onComplete?.();
    }
  }, [count, onComplete]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="text-[200px] font-bold text-orange-500 leading-none animate-pulse">
          {count}
        </div>
        <p className="text-2xl text-gray-400 mt-4">Get Ready!</p>
      </div>
    </div>
  );
}

// Drawing styles
const DRAWING_STYLES = [
  { id: 'wheel', name: 'Spin Wheel', icon: '🎡' },
  { id: 'cardFlip', name: 'Card Flip', icon: '🃏' },
  { id: 'slotMachine', name: 'Slot Machine', icon: '🎰' },
  { id: 'lottery', name: 'Ball Drop', icon: '🎱' }
];

export default function DrawingMonitor() {
  const { eventId } = useParams();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [selectedDivisionId, setSelectedDivisionId] = useState(null);
  const [drawingLoading, setDrawingLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Drawing animation state
  const [drawingStyle, setDrawingStyle] = useState('wheel');
  const [countdown, setCountdown] = useState(null);
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [pendingDrawResult, setPendingDrawResult] = useState(null);
  const [drawingUnit, setDrawingUnit] = useState(null);
  const [isAutoDrawing, setIsAutoDrawing] = useState(false);

  // Viewer tracking
  const previousViewersRef = useRef([]);

  const {
    connect,
    disconnect,
    joinEventDrawing,
    leaveEventDrawing,
    viewers,
    divisionStates,
    initializeDivisionStates,
    connectionState,
    isConnected,
    connection
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
        setIsOrganizer(data.isOrganizer);
        initializeDivisionStates(data.divisions);

        // Auto-select first division if none selected
        if (!selectedDivisionId && data.divisions.length > 0) {
          setSelectedDivisionId(data.divisions[0].divisionId);
        }
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

  // Listen for ViewerJoined events
  useEffect(() => {
    if (connection) {
      const handleViewerJoined = (viewer) => {
        if (viewer.isAuthenticated && viewer.displayName) {
          toast.success(`${viewer.displayName} joined the drawing`);
        }
      };

      connection.on('ViewerJoined', handleViewerJoined);
      return () => connection.off('ViewerJoined', handleViewerJoined);
    }
  }, [connection, toast]);

  // Auto-draw all units with animation pauses
  const handleAutoDrawAll = async (divisionId) => {
    const divState = divisionStates[divisionId];
    if (!divState) return;

    setIsAutoDrawing(true);

    const totalUnits = divState.totalUnits;
    const alreadyDrawn = divState.drawnCount || 0;
    const remaining = totalUnits - alreadyDrawn;

    for (let i = 0; i < remaining; i++) {
      try {
        const response = await tournamentApi.drawNextUnit(divisionId);
        if (response.success && response.data) {
          // Show the drawn unit briefly
          const updatedDivState = divisionStates[divisionId];
          setDrawingUnit({
            ...response.data,
            divisionId,
            remainingNames: updatedDivState?.remainingUnitNames || []
          });
          setShowDrawingModal(true);

          // Wait for animation - pause between draws
          await new Promise(resolve => setTimeout(resolve, 2500));

          setShowDrawingModal(false);
          setDrawingUnit(null);

          // Small pause between units
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          toast.error(response.message || 'Failed to draw unit');
          break;
        }
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to draw unit');
        break;
      }
    }

    setIsAutoDrawing(false);
    // Auto-complete the drawing when done
    handleCompleteDrawing(divisionId);
  };

  // Start drawing with countdown
  const handleStartDrawing = async (divisionId) => {
    if (!isOrganizer) return;

    try {
      setDrawingLoading(true);
      const response = await tournamentApi.startDrawing(divisionId);
      if (response.success) {
        // Start countdown
        setCountdown(10);
        const interval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              // Auto-draw all units after countdown
              handleAutoDrawAll(divisionId);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast.error(response.message || 'Failed to start drawing');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to start drawing');
    } finally {
      setDrawingLoading(false);
    }
  };

  const handleDrawNext = async (divisionId) => {
    try {
      setDrawingLoading(true);
      const response = await tournamentApi.drawNextUnit(divisionId);
      if (response.success && response.data) {
        // Show drawing animation
        const divState = divisionStates[divisionId];
        setDrawingUnit({
          ...response.data,
          divisionId,
          remainingNames: divState?.remainingUnitNames || []
        });
        setShowDrawingModal(true);
        setPendingDrawResult(response.data);
      } else {
        toast.error(response.message || 'Failed to draw unit');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to draw unit');
    } finally {
      setDrawingLoading(false);
    }
  };

  const handleAcceptDraw = () => {
    setShowDrawingModal(false);
    setPendingDrawResult(null);
    setDrawingUnit(null);

    // Check if all units drawn
    const divState = divisionStates[selectedDivisionId];
    if (divState && divState.drawnCount >= divState.totalUnits) {
      handleCompleteDrawing(selectedDivisionId);
    }
  };

  const handleRedraw = async () => {
    // Cancel current drawing and restart
    setShowDrawingModal(false);
    setPendingDrawResult(null);
    setDrawingUnit(null);

    try {
      await tournamentApi.cancelDrawing(selectedDivisionId);
      toast.success('Drawing cancelled. You can start again.');
    } catch (err) {
      toast.error('Failed to cancel drawing');
    }
  };

  const handleCompleteDrawing = async (divisionId) => {
    try {
      setDrawingLoading(true);
      const response = await tournamentApi.completeDrawing(divisionId);
      if (response.success) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
        toast.success('Drawing completed!');
      } else {
        toast.error(response.message || 'Failed to complete drawing');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to complete drawing');
    } finally {
      setDrawingLoading(false);
    }
  };

  const handleCancelDrawing = async (divisionId) => {
    if (!confirm('Are you sure you want to cancel this drawing? All progress will be lost.')) return;

    try {
      setDrawingLoading(true);
      await tournamentApi.cancelDrawing(divisionId);
      toast.success('Drawing cancelled');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to cancel drawing');
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
  const selectedDivision = selectedDivisionId ? divisionStates[selectedDivisionId] : null;
  const authenticatedViewers = viewers.filter(v => v.isAuthenticated);
  const anonymousCount = viewers.filter(v => !v.isAuthenticated).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 5px rgba(249, 115, 22, 0.5); }
          50% { box-shadow: 0 0 20px rgba(249, 115, 22, 0.8); }
        }
      `}</style>

      <Confetti active={showConfetti} />
      {countdown !== null && <Countdown count={countdown} />}

      {/* Drawing Modal */}
      {showDrawingModal && drawingUnit && (
        <DrawingModal
          isOpen={showDrawingModal}
          onClose={() => {
            setShowDrawingModal(false);
            setDrawingUnit(null);
          }}
          drawStyle={drawingStyle}
          unitNames={drawingUnit.remainingNames}
          selectedUnit={drawingUnit}
          onComplete={() => {}}
          slotNumber={drawingUnit.unitNumber}
        />
      )}

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

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full">
        <div className="flex-1 flex">
          {/* Left Panel */}
          <div className="w-80 border-r border-gray-700 flex flex-col">
            {/* Divisions List */}
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Divisions</h3>
              <div className="space-y-2">
                {divisions.map((division) => (
                  <button
                    key={division.divisionId}
                    onClick={() => setSelectedDivisionId(division.divisionId)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                      selectedDivisionId === division.divisionId
                        ? 'bg-orange-500/20 border border-orange-500/50'
                        : 'bg-gray-800/50 hover:bg-gray-700/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        division.drawingInProgress
                          ? 'bg-orange-500'
                          : division.scheduleStatus === 'UnitsAssigned'
                          ? 'bg-green-500'
                          : 'bg-gray-700'
                      }`}>
                        {division.drawingInProgress ? (
                          <Shuffle className="w-4 h-4 text-white animate-pulse" />
                        ) : division.scheduleStatus === 'UnitsAssigned' ? (
                          <Check className="w-4 h-4 text-white" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-white">{division.divisionName}</div>
                        <div className="text-xs text-gray-400">{division.totalUnits} units</div>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${
                      selectedDivisionId === division.divisionId ? 'text-orange-400' : 'text-gray-600'
                    }`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Units List (when division selected) */}
            {selectedDivision && (
              <div className="flex-1 overflow-y-auto p-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Units ({selectedDivision.units?.length || 0})
                </h3>
                <div className="space-y-2">
                  {selectedDivision.units?.map((unit) => (
                    <div
                      key={unit.unitId}
                      className={`p-3 rounded-lg ${
                        unit.unitNumber
                          ? 'bg-green-900/20 border border-green-500/30'
                          : 'bg-gray-800/50 border border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{unit.unitName}</span>
                        {unit.unitNumber && (
                          <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded">
                            #{unit.unitNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {unit.members?.map((member) => (
                          <div key={member.userId} className="relative group">
                            {member.avatarUrl ? (
                              <img
                                src={getSharedAssetUrl(member.avatarUrl)}
                                alt={member.name}
                                className="w-7 h-7 rounded-full object-cover border-2 border-gray-700"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center border-2 border-gray-600">
                                <User className="w-3 h-3 text-gray-400" />
                              </div>
                            )}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              {member.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center Panel */}
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            {selectedDivision ? (
              <>
                <h2 className="text-4xl font-bold text-white mb-2">{selectedDivision.divisionName}</h2>
                <p className="text-gray-400 mb-8">
                  {selectedDivision.teamSize === 1 ? 'Singles' : `${selectedDivision.teamSize} players/team`}
                  {' '}&bull;{' '}
                  {selectedDivision.totalUnits} units to draw
                </p>

                {/* Progress */}
                {selectedDivision.drawingInProgress && (
                  <div className="w-full max-w-md mb-8">
                    <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                      <span>Progress</span>
                      <span>{selectedDivision.drawnCount} / {selectedDivision.totalUnits}</span>
                    </div>
                    <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-500"
                        style={{ width: `${(selectedDivision.drawnCount / selectedDivision.totalUnits) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Drawing completed state */}
                {selectedDivision.scheduleStatus === 'UnitsAssigned' && (
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trophy className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-xl text-green-400 font-semibold">Drawing Complete!</p>
                  </div>
                )}

                {/* Admin Controls */}
                {isOrganizer && (
                  <div className="space-y-6">
                    {/* Drawing Style Selector */}
                    {!selectedDivision.drawingInProgress && selectedDivision.scheduleStatus !== 'UnitsAssigned' && (
                      <div className="flex flex-wrap justify-center gap-2 mb-4">
                        {DRAWING_STYLES.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setDrawingStyle(style.id)}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                              drawingStyle === style.id
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            <span>{style.icon}</span>
                            <span>{style.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Start Drawing Button */}
                    {!selectedDivision.drawingInProgress && selectedDivision.scheduleStatus !== 'UnitsAssigned' && (
                      <button
                        onClick={() => handleStartDrawing(selectedDivision.divisionId)}
                        disabled={drawingLoading}
                        className="px-12 py-6 bg-gradient-to-r from-orange-500 to-red-500 text-white text-2xl font-bold rounded-2xl hover:from-orange-600 hover:to-red-600 disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg shadow-orange-500/30"
                      >
                        {drawingLoading ? (
                          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                        ) : (
                          <>
                            <Play className="w-8 h-8 inline-block mr-3" />
                            Start Drawing
                          </>
                        )}
                      </button>
                    )}

                    {/* During Drawing Controls */}
                    {selectedDivision.drawingInProgress && (
                      <div className="flex flex-wrap justify-center gap-4">
                        {isAutoDrawing ? (
                          <div className="text-center">
                            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-3" />
                            <p className="text-xl text-white font-medium">Auto-drawing in progress...</p>
                            <p className="text-gray-400 mt-1">
                              {selectedDivision.drawnCount} of {selectedDivision.totalUnits} units drawn
                            </p>
                          </div>
                        ) : (
                          <>
                            {selectedDivision.drawnCount >= selectedDivision.totalUnits && (
                              <button
                                onClick={() => handleCompleteDrawing(selectedDivision.divisionId)}
                                disabled={drawingLoading}
                                className="px-8 py-4 bg-green-500 text-white text-xl font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                              >
                                <Check className="w-6 h-6" />
                                Accept & Complete
                              </button>
                            )}

                            <button
                              onClick={() => handleCancelDrawing(selectedDivision.divisionId)}
                              disabled={drawingLoading || isAutoDrawing}
                              className="px-8 py-4 bg-gray-700 text-gray-300 text-xl font-semibold rounded-xl hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                              <RotateCcw className="w-6 h-6" />
                              Redraw All
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Non-organizer view during drawing */}
                {!isOrganizer && selectedDivision.drawingInProgress && (
                  <div className="text-center">
                    <Loader2 className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-4" />
                    <p className="text-xl text-gray-400">Drawing in progress...</p>
                    <p className="text-gray-500 mt-2">Watch as units are drawn live!</p>
                  </div>
                )}

                {/* Drawn Units Display */}
                {selectedDivision.drawnUnits?.length > 0 && (
                  <div className="mt-8 w-full max-w-2xl">
                    <h3 className="text-lg font-semibold text-gray-400 mb-4 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-orange-400" />
                      Draw Results
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {selectedDivision.drawnUnits.map((unit) => (
                        <div
                          key={unit.unitId}
                          className="bg-gray-800/50 rounded-lg p-3 border border-gray-700"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <span className="text-lg font-bold text-white">#{unit.unitNumber}</span>
                          </div>
                          <p className="text-sm font-medium text-white text-center truncate">{unit.unitName}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center">
                <Shuffle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-xl text-gray-400">Select a division to begin</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Panel - Watchers */}
        <div className="border-t border-gray-700 bg-gray-900/50">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Eye className="w-5 h-5 text-orange-400" />
                <span className="font-medium">Watching ({viewers.length})</span>
              </div>
              <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1">
                {authenticatedViewers.map((viewer) => (
                  <div
                    key={viewer.connectionId}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full flex-shrink-0"
                  >
                    {viewer.avatarUrl ? (
                      <img
                        src={getSharedAssetUrl(viewer.avatarUrl)}
                        alt={viewer.displayName}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <User className="w-3 h-3 text-orange-400" />
                      </div>
                    )}
                    <span className="text-sm text-white">{viewer.displayName}</span>
                  </div>
                ))}
                {anonymousCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full flex-shrink-0">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">{anonymousCount} anonymous</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
