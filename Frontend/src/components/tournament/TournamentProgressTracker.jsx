import { useState, useEffect } from 'react';
import {
  Trophy, Loader2, CheckCircle2, Play, Clock, ChevronDown,
  ChevronRight, AlertCircle, Target
} from 'lucide-react';
import { gameDayApi } from '../../services/api';

/**
 * TournamentProgressTracker - Cross-division tournament progress visualization
 * Shows overall progress, division breakdown, and phase status
 */
export default function TournamentProgressTracker({ eventId, onDivisionClick, compact = false }) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [expandedDivisions, setExpandedDivisions] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProgress();
  }, [eventId]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const res = await gameDayApi.getEventProgress(eventId);
      if (res.success) {
        setProgress(res.data);
      }
    } catch (err) {
      console.error('Error loading progress:', err);
      setError('Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  const toggleDivision = (divId) => {
    setExpandedDivisions(prev => ({ ...prev, [divId]: !prev[divId] }));
  };

  const getProgressColor = (pct) => {
    if (pct >= 100) return 'bg-green-500';
    if (pct >= 75) return 'bg-blue-500';
    if (pct >= 50) return 'bg-orange-500';
    if (pct > 0) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  const getStatusIcon = (div) => {
    if (div.completionPercentage >= 100)
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (div.inProgressEncounters > 0)
      return <Play className="w-5 h-5 text-green-500 animate-pulse" />;
    if (div.completedEncounters > 0)
      return <Target className="w-5 h-5 text-orange-500" />;
    return <Clock className="w-5 h-5 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
        <AlertCircle className="w-5 h-5" />
        {error || 'No progress data available'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-orange-500" />
            Tournament Progress
          </h3>
          <span className="text-2xl font-bold text-gray-900">
            {progress.overallCompletionPercentage}%
          </span>
        </div>

        {/* Overall progress bar */}
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full transition-all duration-500 ${getProgressColor(progress.overallCompletionPercentage)}`}
            style={{ width: `${progress.overallCompletionPercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{progress.completedEncounters} completed</span>
          <span>{progress.totalEncounters} total matches</span>
        </div>
      </div>

      {/* Division Breakdown */}
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {progress.divisions.map(div => (
          <div key={div.divisionId} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Division Row */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleDivision(div.divisionId)}
            >
              {getStatusIcon(div)}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDivisionClick?.(div.divisionId);
                    }}
                    className="font-medium text-gray-900 hover:text-orange-600 truncate text-left"
                  >
                    {div.divisionName}
                  </button>
                  <div className="flex items-center gap-2 ml-2">
                    {div.inProgressEncounters > 0 && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full whitespace-nowrap">
                        {div.inProgressEncounters} live
                      </span>
                    )}
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      {Math.round(div.completionPercentage)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full transition-all duration-500 ${getProgressColor(div.completionPercentage)}`}
                    style={{ width: `${div.completionPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{div.completedEncounters}/{div.totalEncounters}</span>
                  {div.pendingEncounters > 0 && (
                    <span>{div.pendingEncounters} pending</span>
                  )}
                </div>
              </div>

              {div.phases?.length > 0 && (
                expandedDivisions[div.divisionId]
                  ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </div>

            {/* Phase Details */}
            {expandedDivisions[div.divisionId] && div.phases?.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 space-y-2">
                {div.phases.map(phase => {
                  const phasePct = phase.totalEncounters > 0
                    ? (phase.completedEncounters / phase.totalEncounters) * 100
                    : 0;
                  return (
                    <div key={phase.phaseId} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        phasePct >= 100 ? 'bg-green-500' :
                        phase.inProgressEncounters > 0 ? 'bg-green-400 animate-pulse' :
                        phasePct > 0 ? 'bg-orange-400' : 'bg-gray-300'
                      }`} />
                      <div className="flex-1 flex items-center justify-between">
                        <div>
                          <span className="text-sm text-gray-700">{phase.phaseName}</span>
                          <span className="text-xs text-gray-400 ml-2">{phase.phaseType}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {phase.completedEncounters}/{phase.totalEncounters}
                        </span>
                      </div>
                      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getProgressColor(phasePct)}`}
                          style={{ width: `${phasePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
