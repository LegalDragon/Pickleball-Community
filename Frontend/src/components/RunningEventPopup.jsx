import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Calendar, MapPin, ChevronRight, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const RunningEventPopup = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [runningEvents, setRunningEvents] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkRunningEvents = async () => {
      if (!isAuthenticated || !user) return;

      // Check if popup was dismissed in this session
      const dismissedKey = `running_event_dismissed_${user.id}`;
      const dismissedTime = sessionStorage.getItem(dismissedKey);
      if (dismissedTime) {
        // If dismissed within last 30 minutes, don't show
        const dismissedAt = parseInt(dismissedTime);
        if (Date.now() - dismissedAt < 30 * 60 * 1000) {
          setDismissed(true);
          return;
        }
      }

      try {
        setLoading(true);
        const response = await api.get('/event-running/my-running-events');
        if (response.success && response.data?.length > 0) {
          setRunningEvents(response.data);
        }
      } catch (err) {
        console.error('Error checking running events:', err);
      } finally {
        setLoading(false);
      }
    };

    checkRunningEvents();
  }, [isAuthenticated, user]);

  const handleDismiss = () => {
    if (user) {
      const dismissedKey = `running_event_dismissed_${user.id}`;
      sessionStorage.setItem(dismissedKey, Date.now().toString());
    }
    setDismissed(true);
  };

  const handleGoToEvent = (eventId) => {
    setDismissed(true);
    navigate(`/event-dashboard/${eventId}`);
  };

  // Don't show if dismissed, loading, or no events
  if (dismissed || loading || runningEvents.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Event in Progress!</h2>
                <p className="text-sm text-white/80">You have an active event</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="space-y-3">
            {runningEvents.map((event) => (
              <button
                key={`${event.eventId}-${event.divisionId}`}
                onClick={() => handleGoToEvent(event.eventId)}
                className="w-full text-left p-4 bg-gray-50 hover:bg-blue-50 rounded-xl border border-gray-200 hover:border-blue-200 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{event.eventName}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                      {event.venueName && (
                        <>
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{event.venueName}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {event.divisionName}
                      </span>
                      {!event.isCheckedIn && (
                        <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                          Check-in Required
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 ml-2" />
                </div>
              </button>
            ))}
          </div>

          {/* Check-in reminder */}
          {runningEvents.some(e => !e.isCheckedIn) && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Don't forget to check in at the venue to confirm your participation!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-0">
          <button
            onClick={handleDismiss}
            className="w-full px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors text-sm"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunningEventPopup;
