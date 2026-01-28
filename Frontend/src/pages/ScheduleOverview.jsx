import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Loader2, ChevronDown, ChevronRight, Users, Trophy, Check, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tournamentApi } from '../services/api';
import SchedulePreview from '../components/tournament/SchedulePreview';
import GameSettingsModal from '../components/GameSettingsModal';

export default function ScheduleOverview() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [expandedDivisions, setExpandedDivisions] = useState({});
  const [gameSettingsModal, setGameSettingsModal] = useState({ isOpen: false, division: null });

  useEffect(() => {
    fetchDashboard();
  }, [eventId]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await tournamentApi.getDashboard(eventId);
      if (response.success) {
        setDashboard(response.data);
        // Auto-expand all divisions that have schedules
        const expanded = {};
        response.data?.divisions?.forEach(div => {
          if (div.scheduleReady) {
            expanded[div.id] = true;
          }
        });
        setExpandedDivisions(expanded);
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

  const toggleDivision = (divId) => {
    setExpandedDivisions(prev => ({
      ...prev,
      [divId]: !prev[divId]
    }));
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
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
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

        {/* Divisions with schedules */}
        {divisionsWithSchedules.map(div => (
          <div key={div.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Division Header */}
            <button
              onClick={() => toggleDivision(div.id)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {expandedDivisions[div.id] ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-gray-900">{div.name}</h2>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {div.registeredUnits} teams
                    </span>
                    {div.totalMatches > 0 && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {div.totalMatches} matches
                      </span>
                    )}
                    {div.completedMatches > 0 && (
                      <span className="flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        {div.completedMatches} completed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Game Settings Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setGameSettingsModal({ isOpen: true, division: div });
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Game Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Progress bar */}
                {div.totalMatches > 0 && (
                  <>
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all"
                        style={{ width: `${(div.completedMatches / div.totalMatches) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-16 text-right">
                      {div.totalMatches > 0 ? Math.round((div.completedMatches / div.totalMatches) * 100) : 0}%
                    </span>
                  </>
                )}
              </div>
            </button>

            {/* Schedule Preview */}
            {expandedDivisions[div.id] && (
              <div className="border-t border-gray-200 px-6 py-4">
                <SchedulePreview
                  divisionId={div.id}
                  showFilters={true}
                />
              </div>
            )}
          </div>
        ))}

        {/* Divisions without schedules */}
        {divisionsWithoutSchedules.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
              Divisions Without Schedules
            </h3>
            <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-100">
              {divisionsWithoutSchedules.map(div => (
                <div key={div.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700">{div.name}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {div.registeredUnits} teams
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">No schedule</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
