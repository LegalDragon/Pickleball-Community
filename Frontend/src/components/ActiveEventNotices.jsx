import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Play, Eye, ClipboardCheck, Loader2, Trophy, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { eventsApi } from '../services/api';

/**
 * Shows notices about active events the user is registered for:
 * - Drawing status: Watch live drawing
 * - Started/Running status: Complete check-in
 */
export default function ActiveEventNotices() {
  const { isAuthenticated, user } = useAuth();
  const [activeEvents, setActiveEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    // Load dismissed notices from sessionStorage
    const saved = sessionStorage.getItem('dismissedEventNotices');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchActiveEvents = async () => {
      try {
        const response = await eventsApi.getMyActiveEvents();
        if (response.success && response.data) {
          setActiveEvents(response.data);
        }
      } catch (err) {
        console.error('Error fetching active events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveEvents();
  }, [isAuthenticated]);

  const handleDismiss = (eventId) => {
    const newDismissed = [...dismissed, eventId];
    setDismissed(newDismissed);
    sessionStorage.setItem('dismissedEventNotices', JSON.stringify(newDismissed));
  };

  if (!isAuthenticated || loading) {
    return null;
  }

  // Filter out dismissed notices
  const visibleEvents = activeEvents.filter(e => !dismissed.includes(e.eventId));

  if (visibleEvents.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 space-y-2 max-w-sm">
      {visibleEvents.map(event => {
        const isDrawing = event.tournamentStatus === 'Drawing';
        const isStarted = event.tournamentStatus === 'Started' || event.tournamentStatus === 'Running';
        const needsCheckIn = isStarted && !event.isCheckedIn && event.checkInStatus !== 'Requested';
        const checkInRequested = event.checkInStatus === 'Requested';

        return (
          <div
            key={event.eventId}
            className={`rounded-xl shadow-lg border p-4 animate-slide-up ${
              isDrawing
                ? 'bg-purple-50 border-purple-200'
                : needsCheckIn
                ? 'bg-orange-50 border-orange-200'
                : checkInRequested
                ? 'bg-blue-50 border-blue-200'
                : 'bg-green-50 border-green-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {isDrawing ? (
                    <Play className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  ) : needsCheckIn ? (
                    <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                  ) : checkInRequested ? (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                  ) : (
                    <Trophy className="w-4 h-4 text-green-600 flex-shrink-0" />
                  )}
                  <span className="font-medium text-gray-900 truncate">
                    {event.eventName}
                  </span>
                </div>

                <p className={`text-sm mb-3 ${
                  isDrawing ? 'text-purple-700' : needsCheckIn ? 'text-orange-700' : checkInRequested ? 'text-blue-700' : 'text-green-700'
                }`}>
                  {isDrawing && 'Live drawing in progress!'}
                  {needsCheckIn && 'Check-in is now open'}
                  {checkInRequested && 'Check-in requested - awaiting approval'}
                  {event.isCheckedIn && 'You are checked in'}
                </p>

                {isDrawing && (
                  <Link
                    to={`/tournament/${event.eventId}/live-drawing`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Watch Live Drawing
                  </Link>
                )}

                {needsCheckIn && (
                  <Link
                    to={`/event/${event.eventId}/check-in`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Complete Check-In
                  </Link>
                )}

                {(checkInRequested || event.isCheckedIn) && (
                  <Link
                    to={`/event/${event.eventId}/game-day`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Trophy className="w-4 h-4" />
                    Go to Player Dashboard
                  </Link>
                )}
              </div>

              <button
                onClick={() => handleDismiss(event.eventId)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
