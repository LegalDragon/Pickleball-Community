import { useState, useEffect } from 'react';
import {
  ChevronRight, Trophy, Users, CheckCircle2, AlertTriangle,
  Play, Loader2, RefreshCw, Settings, ArrowRight, Lock, Unlock
} from 'lucide-react';
import { tournamentApi } from '../../services/api';

/**
 * GameDayAdvancement - Manage automatic advancement between phases
 * Includes manual override capabilities
 */
export default function GameDayAdvancement({ eventId, event, permissions, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [divisions, setDivisions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [phases, setPhases] = useState([]);
  const [advancementStatus, setAdvancementStatus] = useState({});
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (event?.divisions) {
      setDivisions(event.divisions);
      if (event.divisions.length > 0) {
        setSelectedDivision(event.divisions[0]);
      }
    }
  }, [event]);

  useEffect(() => {
    if (selectedDivision) {
      loadDivisionPhases();
    }
  }, [selectedDivision]);

  const loadDivisionPhases = async () => {
    try {
      setLoading(true);
      setError(null);

      const phasesRes = await tournamentApi.getDivisionPhases(selectedDivision.id);
      if (phasesRes.success) {
        setPhases(phasesRes.data || []);

        // Calculate advancement status for each phase
        const status = {};
        for (const phase of (phasesRes.data || [])) {
          const scheduleRes = await tournamentApi.getPhaseSchedule(phase.id);
          if (scheduleRes.success) {
            const encounters = scheduleRes.data?.encounters || [];
            const completed = encounters.filter(e => e.status === 'Completed').length;
            const total = encounters.length;

            status[phase.id] = {
              totalEncounters: total,
              completedEncounters: completed,
              isComplete: completed === total && total > 0,
              pendingAdvancements: encounters.filter(e =>
                e.status === 'Completed' && !e.advancementProcessed
              ).length,
              advancementLocked: phase.advancementLocked || false
            };
          }
        }
        setAdvancementStatus(status);
      }
    } catch (err) {
      console.error('Error loading phases:', err);
      setError('Failed to load division phases');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessAdvancements = async (phaseId) => {
    try {
      setProcessing(true);
      setError(null);

      // Call API to process advancements
      const response = await tournamentApi.processPhaseAdvancements(phaseId);

      if (response.success) {
        await loadDivisionPhases();
        onRefresh?.();
      } else {
        setError(response.message || 'Failed to process advancements');
      }
    } catch (err) {
      console.error('Error processing advancements:', err);
      setError('Failed to process advancements');
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleAdvancementLock = async (phaseId, lock) => {
    try {
      setProcessing(true);
      // This would call an API to lock/unlock advancement
      console.log(`[DEBUG] Would ${lock ? 'lock' : 'unlock'} advancement for phase ${phaseId}`);

      // Simulate update
      setAdvancementStatus(prev => ({
        ...prev,
        [phaseId]: {
          ...prev[phaseId],
          advancementLocked: lock
        }
      }));
    } catch (err) {
      console.error('Error toggling lock:', err);
    } finally {
      setProcessing(false);
    }
  };

  const getPhaseProgress = (phaseId) => {
    const status = advancementStatus[phaseId];
    if (!status) return 0;
    if (status.totalEncounters === 0) return 0;
    return Math.round((status.completedEncounters / status.totalEncounters) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Division Selector */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Trophy className="w-6 h-6 text-orange-500" />
            <select
              value={selectedDivision?.id || ''}
              onChange={(e) => {
                const div = divisions.find(d => d.id === parseInt(e.target.value));
                setSelectedDivision(div);
              }}
              className="text-lg font-semibold border-none bg-transparent focus:ring-0 cursor-pointer"
            >
              {divisions.map(div => (
                <option key={div.id} value={div.id}>{div.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadDivisionPhases}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Phase Flow */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ChevronRight className="w-5 h-5 text-orange-500" />
          Phase Advancement Flow
        </h3>

        <div className="space-y-4">
          {phases.map((phase, index) => {
            const status = advancementStatus[phase.id] || {};
            const progress = getPhaseProgress(phase.id);
            const isNextPhase = index > 0 && phases[index - 1] && advancementStatus[phases[index - 1].id]?.isComplete;

            return (
              <div key={phase.id} className="relative">
                {/* Connection Arrow */}
                {index > 0 && (
                  <div className="absolute -top-4 left-8 flex flex-col items-center">
                    <div className="w-px h-4 bg-gray-300" />
                    <ArrowRight className="w-4 h-4 text-gray-400 rotate-90" />
                  </div>
                )}

                <div className={`border rounded-lg overflow-hidden ${
                  status.isComplete ? 'border-green-300 bg-green-50' :
                  progress > 0 ? 'border-orange-300 bg-orange-50' :
                  'border-gray-200'
                }`}>
                  {/* Phase Header */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        status.isComplete ? 'bg-green-500' :
                        progress > 0 ? 'bg-orange-500' :
                        'bg-gray-300'
                      }`}>
                        {status.isComplete ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <span className="text-white font-bold">{index + 1}</span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900">{phase.name}</h4>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>{phase.phaseType}</span>
                          <span>•</span>
                          <span>{status.completedEncounters || 0}/{status.totalEncounters || 0} matches</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Progress */}
                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              status.isComplete ? 'bg-green-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Lock Toggle */}
                      <button
                        onClick={() => handleToggleAdvancementLock(phase.id, !status.advancementLocked)}
                        disabled={processing}
                        className={`p-2 rounded-lg ${
                          status.advancementLocked
                            ? 'bg-red-100 text-red-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                        title={status.advancementLocked ? 'Unlock advancement' : 'Lock advancement'}
                      >
                        {status.advancementLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Advancement Actions */}
                  {status.isComplete && !status.advancementLocked && index < phases.length - 1 && (
                    <div className="px-4 pb-4">
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Ready to advance to {phases[index + 1]?.name}
                            </p>
                            {status.pendingAdvancements > 0 && (
                              <p className="text-xs text-orange-600 mt-1">
                                {status.pendingAdvancements} pending advancement(s)
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleProcessAdvancements(phase.id)}
                            disabled={processing}
                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Process Advancements
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Locked Message */}
                  {status.advancementLocked && (
                    <div className="px-4 pb-4">
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-center gap-2 text-red-700">
                          <Lock className="w-4 h-4" />
                          <span className="text-sm font-medium">Advancement locked - manual override required</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {phases.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p>No phases configured for this division</p>
            <p className="text-sm mt-1">Configure phases in the tournament settings</p>
          </div>
        )}
      </div>

      {/* Manual Override Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" />
          Manual Override
        </h3>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">Manual Advancement Controls</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Use manual override when automatic advancement cannot determine the correct result,
                such as ties, disqualifications, or other special circumstances.
              </p>
              <div className="mt-3 flex gap-3">
                <button className="px-4 py-2 bg-white border border-yellow-300 text-yellow-800 text-sm rounded-lg hover:bg-yellow-100">
                  Manual Slot Assignment
                </button>
                <button className="px-4 py-2 bg-white border border-yellow-300 text-yellow-800 text-sm rounded-lg hover:bg-yellow-100">
                  Override Match Result
                </button>
                <button className="px-4 py-2 bg-white border border-yellow-300 text-yellow-800 text-sm rounded-lg hover:bg-yellow-100">
                  Recalculate Standings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
