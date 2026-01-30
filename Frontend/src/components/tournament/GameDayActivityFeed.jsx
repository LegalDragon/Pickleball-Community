import { useState, useEffect, useRef } from 'react';
import {
  Activity, Loader2, Trophy, Play, CheckCircle2,
  MapPin, UserCheck, Clock, RefreshCw, ChevronDown
} from 'lucide-react';
import { gameDayApi } from '../../services/api';

const ACTIVITY_ICONS = {
  GameCompleted: { icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-100' },
  MatchCompleted: { icon: Trophy, color: 'text-green-600', bg: 'bg-green-100' },
  GameStarted: { icon: Play, color: 'text-orange-600', bg: 'bg-orange-100' },
  PlayerCheckedIn: { icon: UserCheck, color: 'text-purple-600', bg: 'bg-purple-100' }
};

function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(date).toLocaleDateString();
}

/**
 * GameDayActivityFeed - Real-time activity feed showing recent game events
 */
export default function GameDayActivityFeed({ eventId, maxItems = 20, autoRefresh = true, compact = false }) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const refreshTimer = useRef(null);

  useEffect(() => {
    loadActivities();

    if (autoRefresh) {
      refreshTimer.current = setInterval(loadActivities, 15000); // 15 second refresh
      return () => clearInterval(refreshTimer.current);
    }
  }, [eventId, autoRefresh]);

  const loadActivities = async () => {
    try {
      const res = await gameDayApi.getActivityFeed(eventId, maxItems + 10);
      if (res.success) {
        setActivities(res.data || []);
        setHasMore((res.data || []).length > maxItems);
      }
    } catch (err) {
      console.error('Error loading activity feed:', err);
    } finally {
      setLoading(false);
    }
  };

  const displayedActivities = expanded ? activities.slice(0, maxItems) : activities.slice(0, 5);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-gray-900">Activity Feed</h3>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-500" />
          Activity Feed
        </h3>
        <div className="flex items-center gap-2">
          {autoRefresh && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Live
            </span>
          )}
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="px-4 py-8 text-center text-gray-500">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">No activity yet</p>
          <p className="text-xs text-gray-400 mt-1">Events will appear here as games start and finish</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {displayedActivities.map((item, idx) => {
              const config = ACTIVITY_ICONS[item.activityType] || ACTIVITY_ICONS.GameStarted;
              const Icon = config.icon;

              return (
                <div key={`${item.activityType}-${item.referenceId}-${idx}`}
                     className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${config.bg} flex-shrink-0 mt-0.5`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{item.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400">
                          {getRelativeTime(item.activityTime)}
                        </span>
                        {item.divisionName && (
                          <span className="text-xs text-gray-400">
                            {item.divisionName}
                          </span>
                        )}
                        {item.courtLabel && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {item.courtLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {compact && activities.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 flex items-center justify-center gap-1 border-t border-gray-100"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Show less' : `Show ${activities.length - 5} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
