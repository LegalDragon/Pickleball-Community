import { useState, useEffect, useRef } from 'react';
import { X, Radio, Users, Check, Loader2, Clock, Shuffle, Trophy, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useDrawingHub } from '../hooks/useDrawingHub';
import { tournamentApi } from '../services/api';

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
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute w-3 h-3 rounded-full animate-confetti"
          style={{
            left: `${p.x}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`
          }}
        />
      ))}
    </div>
  );
}

export default function WatchDrawingModal({ isOpen, onClose, divisionId, divisionName, eventName }) {
  const {
    connect,
    disconnect,
    joinDrawingRoom,
    leaveDrawingRoom,
    drawingState,
    setDrawingState,
    connectionState,
    isConnected
  } = useDrawingHub();

  const [status, setStatus] = useState('connecting'); // connecting, waiting, active, completed, error
  const [error, setError] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [latestUnit, setLatestUnit] = useState(null);
  const lastUnitRef = useRef(null);

  // Connect to hub and join drawing room
  useEffect(() => {
    if (!isOpen || !divisionId) return;

    let mounted = true;

    const initConnection = async () => {
      setStatus('connecting');
      setError(null);

      try {
        const conn = await connect();
        if (!conn || !mounted) return;

        const joined = await joinDrawingRoom(divisionId);
        if (!joined || !mounted) {
          setError('Failed to join drawing room');
          setStatus('error');
          return;
        }

        // Fetch current drawing state
        const response = await tournamentApi.getDrawingState(divisionId);
        if (!mounted) return;

        if (response.data?.success && response.data.data) {
          setDrawingState(response.data.data);
          setStatus('active');
        } else {
          // No active drawing
          setStatus('waiting');
        }
      } catch (err) {
        console.error('Error connecting to drawing:', err);
        if (mounted) {
          setError('Failed to connect. Please try again.');
          setStatus('error');
        }
      }
    };

    initConnection();

    return () => {
      mounted = false;
      if (divisionId) {
        leaveDrawingRoom(divisionId);
      }
    };
  }, [isOpen, divisionId]);

  // Track when drawing state changes
  useEffect(() => {
    if (drawingState) {
      setStatus('active');

      // Check if a new unit was drawn
      if (drawingState.drawnUnits && drawingState.drawnUnits.length > 0) {
        const newest = drawingState.drawnUnits[drawingState.drawnUnits.length - 1];
        if (lastUnitRef.current !== newest.unitId) {
          lastUnitRef.current = newest.unitId;
          setLatestUnit(newest);
          // Clear the highlight after 3 seconds
          setTimeout(() => setLatestUnit(null), 3000);
        }
      }

      // Check if drawing completed
      if (drawingState.completed) {
        setStatus('completed');
        setShowConfetti(true);
      }
    }
  }, [drawingState]);

  // Handle drawing cancelled
  useEffect(() => {
    if (status === 'active' && !drawingState) {
      setStatus('waiting');
    }
  }, [drawingState, status]);

  // Disconnect when modal closes
  useEffect(() => {
    if (!isOpen && isConnected) {
      disconnect();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-pulse-ring {
          animation: pulse-ring 1.5s ease-out infinite;
        }
        @keyframes slide-in {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.5s ease-out;
        }
      `}</style>

      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-hidden shadow-2xl relative">
        <Confetti active={showConfetti} />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              {status === 'active' && (
                <div className="absolute -top-1 -right-1 w-3 h-3">
                  <div className="absolute inset-0 bg-red-500 rounded-full animate-ping" />
                  <div className="relative w-full h-full bg-red-500 rounded-full" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Live Drawing</h2>
              <p className="text-sm text-gray-400">{divisionName || 'Division'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
              {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isConnected ? 'Live' : 'Offline'}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Connecting State */}
          {status === 'connecting' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-orange-400 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Connecting...</h3>
              <p className="text-gray-400">Joining the live drawing feed</p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Connection Error</h3>
              <p className="text-gray-400 mb-4">{error || 'Unable to connect to the drawing'}</p>
              <button
                onClick={() => {
                  setStatus('connecting');
                  setError(null);
                  connect().then(() => joinDrawingRoom(divisionId));
                }}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Waiting State */}
          {status === 'waiting' && (
            <div className="text-center py-12">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 bg-orange-500/20 rounded-full animate-pulse-ring" />
                <div className="relative w-full h-full bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                  <Clock className="w-10 h-10 text-white" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Waiting for Drawing</h3>
              <p className="text-gray-400 mb-4">
                The drawing hasn't started yet. Stay tuned!
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full text-sm text-gray-400">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                Waiting for organizer to start
              </div>
            </div>
          )}

          {/* Active Drawing State */}
          {status === 'active' && drawingState && (
            <>
              {/* Info Bar */}
              <div className="flex items-center justify-between mb-6 p-4 bg-gray-800/50 rounded-xl">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{drawingState.drawnCount}</div>
                  <div className="text-xs text-gray-400">Drawn</div>
                </div>
                <div className="flex-1 mx-6">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-500"
                      style={{ width: `${(drawingState.drawnCount / drawingState.totalUnits) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{drawingState.totalUnits}</div>
                  <div className="text-xs text-gray-400">Total</div>
                </div>
              </div>

              {/* Latest Draw Highlight */}
              {latestUnit && (
                <div className="mb-6 animate-slide-in">
                  <div className="p-4 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/50 rounded-xl">
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <div className="text-sm text-orange-400 mb-1">Just Drawn!</div>
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
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

              {/* Drawn Units List */}
              {drawingState.drawnUnits && drawingState.drawnUnits.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Drawn Units ({drawingState.drawnUnits.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {[...drawingState.drawnUnits].reverse().map((unit, idx) => (
                      <div
                        key={unit.unitId}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                          latestUnit?.unitId === unit.unitId
                            ? 'bg-orange-500/20 border border-orange-500/50'
                            : 'bg-gray-800/50'
                        }`}
                      >
                        <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-white">#{unit.unitNumber}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{unit.unitName}</div>
                          {unit.memberNames && unit.memberNames.length > 0 && (
                            <div className="text-xs text-gray-400 truncate">
                              {unit.memberNames.join(' & ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remaining Units */}
              {drawingState.remainingUnitNames && drawingState.remainingUnitNames.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Shuffle className="w-4 h-4" />
                    Still in the Draw ({drawingState.remainingUnitNames.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {drawingState.remainingUnitNames.map((name, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Completed State */}
          {status === 'completed' && drawingState && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Drawing Complete!</h3>
              <p className="text-gray-400 mb-6">All {drawingState.totalUnits} units have been assigned</p>

              {/* Final Order */}
              <div className="text-left">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Final Draw Order</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(drawingState.finalOrder || drawingState.drawnUnits || []).map((unit, idx) => (
                    <div
                      key={unit.unitId}
                      className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
                    >
                      <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-white">#{unit.unitNumber}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{unit.unitName}</div>
                        {unit.memberNames && unit.memberNames.length > 0 && (
                          <div className="text-xs text-gray-400 truncate">
                            {unit.memberNames.join(' & ')}
                          </div>
                        )}
                      </div>
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-700 bg-gray-800/50">
          {status === 'active' && drawingState && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span>Drawing by {drawingState.startedByName || 'Organizer'}</span>
            </div>
          )}
          {status === 'completed' && (
            <button
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-colors"
            >
              Done
            </button>
          )}
          {(status === 'waiting' || status === 'connecting') && (
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
