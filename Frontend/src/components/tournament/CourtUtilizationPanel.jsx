import { useState, useEffect } from 'react';
import {
  BarChart3, Loader2, MapPin, Play, CheckCircle2, Clock,
  Wrench, AlertTriangle, Timer
} from 'lucide-react';
import { gameDayApi } from '../../services/api';

const STATUS_CONFIG = {
  Available: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', label: 'Available' },
  InUse: { icon: Play, color: 'text-blue-600', bg: 'bg-blue-100', label: 'In Use' },
  Maintenance: { icon: Wrench, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Maintenance' },
  Reserved: { icon: Clock, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Reserved' },
  Closed: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', label: 'Closed' }
};

/**
 * CourtUtilizationPanel - Shows court usage statistics and allows status management
 */
export default function CourtUtilizationPanel({ eventId, onCourtStatusChange, showControls = true }) {
  const [loading, setLoading] = useState(true);
  const [courts, setCourts] = useState([]);
  const [updatingCourt, setUpdatingCourt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCourtStats();
  }, [eventId]);

  const loadCourtStats = async () => {
    try {
      setLoading(true);
      const res = await gameDayApi.getCourtUtilization(eventId);
      if (res.success) {
        setCourts(res.data || []);
      }
    } catch (err) {
      console.error('Error loading court stats:', err);
      setError('Failed to load court data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (courtId, newStatus) => {
    try {
      setUpdatingCourt(courtId);
      const res = await gameDayApi.updateCourtStatus(courtId, newStatus);
      if (res.success) {
        await loadCourtStats();
        onCourtStatusChange?.();
      }
    } catch (err) {
      console.error('Error updating court status:', err);
    } finally {
      setUpdatingCourt(null);
    }
  };

  // Calculate summary stats
  const totalCourts = courts.length;
  const availableCourts = courts.filter(c => c.status === 'Available').length;
  const inUseCourts = courts.filter(c => c.status === 'InUse').length;
  const totalGamesCompleted = courts.reduce((sum, c) => sum + (c.completedGames || 0), 0);
  const avgDuration = courts.filter(c => c.avgGameDurationMinutes).length > 0
    ? (courts.reduce((sum, c) => sum + (c.avgGameDurationMinutes || 0), 0) /
       courts.filter(c => c.avgGameDurationMinutes).length).toFixed(0)
    : null;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-gray-900">Court Utilization</h3>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          Court Utilization
        </h3>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">{availableCourts}</div>
          <div className="text-xs text-gray-500">Available</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{inUseCourts}</div>
          <div className="text-xs text-gray-500">In Use</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-700">{totalGamesCompleted}</div>
          <div className="text-xs text-gray-500">Completed</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-orange-600">{avgDuration || '-'}</div>
          <div className="text-xs text-gray-500">Avg Min</div>
        </div>
      </div>

      {/* Court List */}
      <div className="divide-y divide-gray-100">
        {courts.map(court => {
          const config = STATUS_CONFIG[court.status] || STATUS_CONFIG.Available;
          const Icon = config.icon;

          return (
            <div key={court.courtId} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${config.bg}`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{court.courtLabel}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>{court.completedGames} games</span>
                      {court.avgGameDurationMinutes && (
                        <span className="flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          ~{Math.round(court.avgGameDurationMinutes)}m avg
                        </span>
                      )}
                      {court.totalPlayingMinutes > 0 && (
                        <span>{Math.round(court.totalPlayingMinutes / 60 * 10) / 10}h total</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Change Controls */}
                {showControls && (
                  <div className="flex items-center gap-1">
                    {court.status !== 'Available' && court.status !== 'InUse' && (
                      <button
                        onClick={() => handleStatusChange(court.courtId, 'Available')}
                        disabled={updatingCourt === court.courtId}
                        className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                      >
                        Open
                      </button>
                    )}
                    {court.status === 'Available' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(court.courtId, 'Maintenance')}
                          disabled={updatingCourt === court.courtId}
                          className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50"
                        >
                          Maint.
                        </button>
                        <button
                          onClick={() => handleStatusChange(court.courtId, 'Closed')}
                          disabled={updatingCourt === court.courtId}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                          Close
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Utilization bar */}
              {court.completedGames > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400"
                      style={{ width: `${Math.min(100, (court.totalPlayingMinutes / 480) * 100)}%` }}
                      title={`${court.totalPlayingMinutes} minutes of playing time`}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {courts.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">No courts configured</p>
        </div>
      )}
    </div>
  );
}
