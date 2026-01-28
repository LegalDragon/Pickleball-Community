import { useState, useEffect } from 'react';
import { X, Loader2, HelpCircle, Plus, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { tournamentApi, scoreFormatsApi, encounterApi } from '../services/api';

/**
 * GameSettingsModal - Configure games per match and score format for a division/phase
 * Supports phase-specific settings (e.g., Pool = 1 game, Semifinals = Best of 3, Finals = Best of 5)
 */
export default function GameSettingsModal({ isOpen, onClose, division, eventId, onSave }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scoreFormats, setScoreFormats] = useState([]);
  const [gameSettings, setGameSettings] = useState(null);
  const [expandedPhases, setExpandedPhases] = useState({});
  const [error, setError] = useState(null);

  // Simple mode settings (for divisions without phases)
  const [simpleSettings, setSimpleSettings] = useState({
    gamesPerMatch: 1,
    defaultScoreFormatId: null
  });

  // Phase-specific settings: { phaseId: { matchFormatId: { bestOf, scoreFormatId } } }
  const [phaseSettings, setPhaseSettings] = useState({});

  useEffect(() => {
    if (isOpen && division) {
      loadData();
    }
  }, [isOpen, division]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load score formats
      const formatsResponse = await scoreFormatsApi.getAll();
      if (formatsResponse.success) {
        setScoreFormats(formatsResponse.data || []);
      }

      // Load division game settings (includes phases and match formats)
      const settingsResponse = await encounterApi.getDivisionGameSettings(division.id);
      if (settingsResponse.success) {
        const data = settingsResponse.data;
        setGameSettings(data);

        // Initialize simple settings from division defaults
        setSimpleSettings({
          gamesPerMatch: data.defaultBestOf || 1,
          defaultScoreFormatId: data.defaultScoreFormatId || null
        });

        // Initialize phase settings from loaded data
        const initialPhaseSettings = {};
        data.phases?.forEach(phase => {
          initialPhaseSettings[phase.phaseId] = {};

          // If there are match formats, create settings per format
          if (data.matchFormats?.length > 0) {
            data.matchFormats.forEach(format => {
              const existingSetting = phase.matchSettings?.find(s => s.matchFormatId === format.id);
              initialPhaseSettings[phase.phaseId][format.id] = {
                bestOf: existingSetting?.bestOf || format.bestOf || 1,
                scoreFormatId: existingSetting?.scoreFormatId || null
              };
            });
          }

          // Also include null key for divisions with single match per encounter
          const defaultSetting = phase.matchSettings?.find(s => !s.matchFormatId);
          initialPhaseSettings[phase.phaseId][null] = {
            bestOf: defaultSetting?.bestOf || 1,
            scoreFormatId: defaultSetting?.scoreFormatId || null
          };
        });
        setPhaseSettings(initialPhaseSettings);

        // Auto-expand first phase
        if (data.phases?.length > 0) {
          setExpandedPhases({ [data.phases[0].phaseId]: true });
        }
      } else {
        // Fallback to simple settings if no phases
        setSimpleSettings({
          gamesPerMatch: division.gamesPerMatch || 1,
          defaultScoreFormatId: division.defaultScoreFormatId || null
        });
      }
    } catch (err) {
      console.error('Error loading game settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (gameSettings?.phases?.length > 0) {
        // Save phase-specific settings
        const settings = [];

        Object.entries(phaseSettings).forEach(([phaseId, formatSettings]) => {
          Object.entries(formatSettings).forEach(([matchFormatId, config]) => {
            settings.push({
              phaseId: parseInt(phaseId),
              matchFormatId: matchFormatId === 'null' ? null : parseInt(matchFormatId),
              bestOf: config.bestOf,
              scoreFormatId: config.scoreFormatId
            });
          });
        });

        const response = await encounterApi.updateDivisionGameSettings(division.id, { settings });
        if (!response.success) {
          setError(response.message || 'Failed to save settings');
          return;
        }
      } else {
        // Save simple settings to division
        const response = await tournamentApi.updateDivisionGameSettings(eventId, division.id, {
          gamesPerMatch: simpleSettings.gamesPerMatch,
          defaultScoreFormatId: simpleSettings.defaultScoreFormatId
        });
        if (!response.success) {
          setError(response.message || 'Failed to save settings');
          return;
        }
      }

      onSave?.();
      onClose();
    } catch (err) {
      console.error('Error saving game settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const togglePhase = (phaseId) => {
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  const updatePhaseFormatSetting = (phaseId, matchFormatId, field, value) => {
    setPhaseSettings(prev => ({
      ...prev,
      [phaseId]: {
        ...prev[phaseId],
        [matchFormatId]: {
          ...prev[phaseId]?.[matchFormatId],
          [field]: value
        }
      }
    }));
  };

  const applyToAllPhases = (matchFormatId, bestOf) => {
    const updated = { ...phaseSettings };
    Object.keys(updated).forEach(phaseId => {
      if (updated[phaseId][matchFormatId]) {
        updated[phaseId][matchFormatId].bestOf = bestOf;
      }
    });
    setPhaseSettings(updated);
  };

  if (!isOpen) return null;

  const hasPhases = gameSettings?.phases?.length > 0;
  const hasMatchFormats = gameSettings?.matchFormats?.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Game Settings</h2>
            <p className="text-sm text-gray-500">{division?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Phase-specific settings */}
              {hasPhases ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Settings className="w-4 h-4" />
                    <span>Configure game settings for each phase</span>
                  </div>

                  {gameSettings.phases.map((phase) => (
                    <div key={phase.phaseId} className="border rounded-lg overflow-hidden">
                      {/* Phase Header */}
                      <button
                        onClick={() => togglePhase(phase.phaseId)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {expandedPhases[phase.phaseId] ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="font-medium text-gray-900">{phase.phaseName}</span>
                          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                            {phase.phaseType}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {hasMatchFormats
                            ? `${gameSettings.matchFormats.length} match format${gameSettings.matchFormats.length !== 1 ? 's' : ''}`
                            : 'Single match'
                          }
                        </div>
                      </button>

                      {/* Phase Content */}
                      {expandedPhases[phase.phaseId] && (
                        <div className="p-4 space-y-4">
                          {hasMatchFormats ? (
                            // Show settings per match format
                            gameSettings.matchFormats.map((format) => (
                              <div key={format.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-gray-900">
                                      {format.code && <span className="text-orange-600 mr-1">[{format.code}]</span>}
                                      {format.name}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {format.maleCount > 0 && `${format.maleCount}M `}
                                    {format.femaleCount > 0 && `${format.femaleCount}F `}
                                    {format.unisexCount > 0 && `${format.unisexCount} Any`}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-gray-500">Games:</label>
                                  <select
                                    value={phaseSettings[phase.phaseId]?.[format.id]?.bestOf || 1}
                                    onChange={(e) => updatePhaseFormatSetting(phase.phaseId, format.id, 'bestOf', parseInt(e.target.value))}
                                    className="border border-gray-300 rounded p-1.5 text-sm w-24"
                                  >
                                    <option value={1}>1 Game</option>
                                    <option value={3}>Best of 3</option>
                                    <option value={5}>Best of 5</option>
                                  </select>
                                </div>

                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-gray-500">Score:</label>
                                  <select
                                    value={phaseSettings[phase.phaseId]?.[format.id]?.scoreFormatId || ''}
                                    onChange={(e) => updatePhaseFormatSetting(phase.phaseId, format.id, 'scoreFormatId', e.target.value ? parseInt(e.target.value) : null)}
                                    className="border border-gray-300 rounded p-1.5 text-sm w-32"
                                  >
                                    <option value="">Default</option>
                                    {scoreFormats.map(sf => (
                                      <option key={sf.id} value={sf.id}>{sf.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ))
                          ) : (
                            // Single match format - simpler UI
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-700">Games per Match:</label>
                                <div className="flex gap-2">
                                  {[1, 3, 5].map(num => (
                                    <button
                                      key={num}
                                      onClick={() => updatePhaseFormatSetting(phase.phaseId, null, 'bestOf', num)}
                                      className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                                        (phaseSettings[phase.phaseId]?.[null]?.bestOf || 1) === num
                                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                                          : 'border-gray-200 hover:border-gray-300'
                                      }`}
                                    >
                                      {num === 1 ? '1 Game' : `Best of ${num}`}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 ml-auto">
                                <label className="text-sm text-gray-500">Score Format:</label>
                                <select
                                  value={phaseSettings[phase.phaseId]?.[null]?.scoreFormatId || ''}
                                  onChange={(e) => updatePhaseFormatSetting(phase.phaseId, null, 'scoreFormatId', e.target.value ? parseInt(e.target.value) : null)}
                                  className="border border-gray-300 rounded-lg p-2 text-sm"
                                >
                                  <option value="">Default</option>
                                  {scoreFormats.map(sf => (
                                    <option key={sf.id} value={sf.id}>{sf.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Quick apply buttons */}
                  {hasMatchFormats && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <div className="text-sm font-medium text-blue-800 mb-2">Quick Apply</div>
                      <div className="flex flex-wrap gap-2">
                        {gameSettings.matchFormats.map(format => (
                          <div key={format.id} className="flex items-center gap-1">
                            <span className="text-xs text-blue-700">{format.code || format.name}:</span>
                            <button
                              onClick={() => applyToAllPhases(format.id, 1)}
                              className="px-2 py-0.5 text-xs bg-white rounded border border-blue-200 hover:bg-blue-100"
                            >
                              1G
                            </button>
                            <button
                              onClick={() => applyToAllPhases(format.id, 3)}
                              className="px-2 py-0.5 text-xs bg-white rounded border border-blue-200 hover:bg-blue-100"
                            >
                              Bo3
                            </button>
                            <button
                              onClick={() => applyToAllPhases(format.id, 5)}
                              className="px-2 py-0.5 text-xs bg-white rounded border border-blue-200 hover:bg-blue-100"
                            >
                              Bo5
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Simple mode - no phases configured
                <div className="space-y-6">
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    No phases configured for this division. Configure phases first to set per-phase game settings.
                  </div>

                  {/* Games per Match */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-sm font-medium text-gray-700">Games per Match</label>
                      <div className="group relative">
                        <HelpCircle className="w-4 h-4 text-gray-400" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          How many games decide a match winner
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[1, 3, 5].map(num => (
                        <button
                          key={num}
                          onClick={() => setSimpleSettings({ ...simpleSettings, gamesPerMatch: num })}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${
                            simpleSettings.gamesPerMatch === num
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`text-lg font-bold ${simpleSettings.gamesPerMatch === num ? 'text-orange-600' : 'text-gray-900'}`}>
                            {num === 1 ? '1 Game' : `Best of ${num}`}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {num === 1 ? 'Single game decides match' : `First to win ${Math.ceil(num / 2)} games`}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Score Format */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Score Format</label>
                        <div className="group relative">
                          <HelpCircle className="w-4 h-4 text-gray-400" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Scoring rules for each game
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => window.open('/admin/score-formats', '_blank')}
                        className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Format
                      </button>
                    </div>

                    <select
                      value={simpleSettings.defaultScoreFormatId || ''}
                      onChange={(e) => setSimpleSettings({ ...simpleSettings, defaultScoreFormatId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm"
                    >
                      <option value="">Select score format...</option>
                      {scoreFormats.map(format => (
                        <option key={format.id} value={format.id}>
                          {format.name} ({format.pointsToWin} pts{format.winByTwo ? ', win by 2' : ''})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
