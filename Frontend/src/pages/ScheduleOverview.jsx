import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Loader2, ChevronDown, ChevronRight, Users,
  Trophy, Check, Settings, Clock, Target, Play, MapPin, BarChart3,
  List, Grid, Filter
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tournamentApi, gameDayApi } from '../services/api';
import SchedulePreview from '../components/tournament/SchedulePreview';
import GameSettingsModal from '../components/GameSettingsModal';

export default function ScheduleOverview() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState(null);
  const [gameSettingsModal, setGameSettingsModal] = useState({ isOpen: false, division: null });
  const [viewMode, setViewMode] = useState('divisions'); // divisions, timeline
  const [progressData, setProgressData] = useState(null);

  useEffect(() => {
    fetchDashboard();
    fetchProgress();
  }, [eventId]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await tournamentApi.getDashboard(eventId);
      if (response.success) {
        setDashboard(response.data);
        // Auto-select first division with a schedule
        const divisionsWithSchedules = response.data?.divisions?.filter(d => d.scheduleReady) || [];
        if (divisionsWithSchedules.length > 0 && !selectedDivisionId) {
          setSelectedDivisionId(divisionsWithSchedules[0].id);
        }
      } else {
        setError('Failed to load event data');
      }
    } catch (err) {
      setError('Failed to load event data');
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    try {
      const res = await gameDayApi.getEventProgress(eventId);
      if (res.success) {
        setProgressData(res.data);
      }
    } catch (err) {
      // Progress data is optional
      console.error('Error fetching progress:', err);
    }
  };

  const divisionsWithSchedules = dashboard?.divisions?.filter(d => d.scheduleReady) || [];
  const divisionsWithoutSchedules = dashboard?.divisions?.filter(d => !d.scheduleReady) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading schedules...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-6 max-w-md text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/tournament/${eventId}/manage`)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {dashboard?.eventName || 'Tournament'} - Schedules
                </h1>
                <p className="text-sm text-gray-500">
                  {divisionsWithSchedules.length} division{divisionsWithSchedules.length !== 1 ? 's' : ''} with schedules
                  {progressData && (
                    <span className="ml-2 text-orange-600 font-medium">
                      • {progressData.overallCompletionPercentage}% complete
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('divisions')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'divisions' ? 'bg-white shadow text-orange-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="w-4 h-4 inline mr-1" /> Divisions
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'timeline' ? 'bg-white shadow text-orange-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-1" /> Progress
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">

        {/* Progress/Timeline View */}
        {viewMode === 'timeline' && progressData && (
          <div className="space-y-4">
            {/* Overall Progress */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-500" />
                  Tournament Progress
                </h2>
                <span className="text-3xl font-bold text-orange-600">
                  {progressData.overallCompletionPercentage}%
                </span>
              </div>
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full transition-all duration-700 rounded-full ${
                    progressData.overallCompletionPercentage >= 100 ? 'bg-green-500' :
                    progressData.overallCompletionPercentage >= 50 ? 'bg-orange-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progressData.overallCompletionPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>{progressData.completedEncounters} completed</span>
                <span>{progressData.totalEncounters - progressData.completedEncounters} remaining</span>
              </div>
            </div>

            {/* Division Progress Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {progressData.divisions.map(div => {
                const pct = div.completionPercentage;
                return (
                  <div key={div.divisionId} className="bg-white rounded-lg shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{div.divisionName}</h3>
                      <div className="flex items-center gap-2">
                        {div.inProgressEncounters > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            <Play className="w-3 h-3" /> {div.inProgressEncounters} live
                          </span>
                        )}
                        <span className="text-lg font-bold text-gray-700">{Math.round(pct)}%</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full transition-all rounded-full ${
                          pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-orange-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-green-50 rounded-lg">
                        <div className="text-lg font-bold text-green-700">{div.completedEncounters}</div>
                        <div className="text-xs text-green-600">Done</div>
                      </div>
                      <div className="p-2 bg-yellow-50 rounded-lg">
                        <div className="text-lg font-bold text-yellow-700">{div.inProgressEncounters}</div>
                        <div className="text-xs text-yellow-600">Active</div>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <div className="text-lg font-bold text-gray-600">{div.pendingEncounters}</div>
                        <div className="text-xs text-gray-500">Pending</div>
                      </div>
                    </div>

                    {/* Phase breakdown - only show phases with encounters */}
                    {div.phases?.filter(p => p.totalEncounters > 0).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        {div.phases.filter(phase => phase.totalEncounters > 0).map(phase => {
                          const phasePct = (phase.completedEncounters / phase.totalEncounters) * 100;
                          return (
                            <div key={phase.phaseId} className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                phasePct >= 100 ? 'bg-green-500' :
                                phase.inProgressEncounters > 0 ? 'bg-green-400 animate-pulse' :
                                phasePct > 0 ? 'bg-orange-400' : 'bg-gray-300'
                              }`} />
                              <span className="text-sm text-gray-700 flex-1">{phase.phaseName}</span>
                              <span className="text-xs text-gray-500">{phase.completedEncounters}/{phase.totalEncounters}</span>
                              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full ${phasePct >= 100 ? 'bg-green-500' : 'bg-orange-400'}`}
                                     style={{ width: `${phasePct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Divisions View (original) */}
        {viewMode === 'divisions' && <>

        {/* No divisions at all */}
        {(!dashboard?.divisions || dashboard.divisions.length === 0) && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Divisions</h3>
            <p className="text-sm text-gray-500">
              This event doesn't have any divisions yet.
            </p>
          </div>
        )}

        {/* No schedules generated */}
        {dashboard?.divisions?.length > 0 && divisionsWithSchedules.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedules Generated</h3>
            <p className="text-sm text-gray-500">
              None of the divisions have generated schedules yet. Configure schedules from the Divisions tab.
            </p>
          </div>
        )}

        {/* Division Selector and Schedule */}
        {divisionsWithSchedules.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Division Selector Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <label className="text-sm font-medium text-gray-700">Division:</label>
                <select
                  value={selectedDivisionId || ''}
                  onChange={(e) => setSelectedDivisionId(Number(e.target.value))}
                  className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {divisionsWithSchedules.map(div => (
                    <option key={div.id} value={div.id}>
                      {div.name} ({div.registeredUnits} teams, {div.totalMatches} matches)
                    </option>
                  ))}
                </select>
                
                {/* Game Settings Button - next to dropdown */}
                {(() => {
                  const selectedDiv = divisionsWithSchedules.find(d => d.id === selectedDivisionId);
                  if (!selectedDiv) return null;
                  return (
                    <button
                      onClick={() => setGameSettingsModal({ isOpen: true, division: selectedDiv })}
                      className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-gray-200 hover:border-orange-300"
                      title="Game Settings for this division"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  );
                })()}
              </div>

              {/* Selected division progress */}
              {(() => {
                const selectedDiv = divisionsWithSchedules.find(d => d.id === selectedDivisionId);
                if (!selectedDiv) return null;
                return (
                  <div className="flex items-center gap-4">
                    {/* Progress bar */}
                    {selectedDiv.totalMatches > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${(selectedDiv.completedMatches / selectedDiv.totalMatches) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-500">
                          {Math.round((selectedDiv.completedMatches / selectedDiv.totalMatches) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Schedule Preview for Selected Division */}
            {selectedDivisionId && (
              <div className="px-6 py-4">
                <SchedulePreview
                  key={selectedDivisionId}
                  divisionId={selectedDivisionId}
                  showFilters={true}
                />
              </div>
            )}
          </div>
        )}

        {/* Note about divisions without schedules */}
        {divisionsWithoutSchedules.length > 0 && (
          <div className="text-sm text-gray-500 text-center mt-4">
            {divisionsWithoutSchedules.length} division{divisionsWithoutSchedules.length !== 1 ? 's' : ''} without schedules: {divisionsWithoutSchedules.map(d => d.name).join(', ')}
          </div>
        )}
        </>}
      </div>

      {/* Game Settings Modal */}
      <GameSettingsModal
        isOpen={gameSettingsModal.isOpen}
        onClose={() => setGameSettingsModal({ isOpen: false, division: null })}
        division={gameSettingsModal.division}
        eventId={eventId}
        onSave={() => fetchDashboard()}
      />
    </div>
  );
}
