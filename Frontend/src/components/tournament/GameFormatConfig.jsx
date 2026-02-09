import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Save, Loader2, AlertCircle, ChevronDown, ChevronRight,
  Hash, Trophy, Target, Info, Check, Plus, Trash2
} from 'lucide-react';
import { tournamentApi, encounterApi } from '../../services/api';

/**
 * GameFormatConfig - Configure game formats per phase/match combination
 * 
 * For each phase and match format (if multiple matches per encounter),
 * allows TD to configure:
 * - Number of games (best of 1, 3, 5)
 * - Score format (11-point, 15-point, 21-point, rally scoring, etc.)
 * - Per-game overrides if needed
 */
export default function GameFormatConfig({ 
  divisionId, 
  phases = [], 
  matchesPerEncounter = 1,
  onUpdated 
}) {
  const [gameSettings, setGameSettings] = useState(null);
  const [scoreFormats, setScoreFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [expandedPhases, setExpandedPhases] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  
  // Local edits before saving
  const [localSettings, setLocalSettings] = useState({});

  useEffect(() => {
    loadData();
  }, [divisionId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [settingsRes, formatsRes] = await Promise.all([
        encounterApi.getDivisionGameSettings(divisionId),
        tournamentApi.getScoreFormats()
      ]);

      if (settingsRes.success) {
        setGameSettings(settingsRes.data);
        initializeLocalSettings(settingsRes.data);
      }

      if (formatsRes.success) {
        setScoreFormats(formatsRes.data || []);
      }

      // Auto-expand first phase
      if (phases.length > 0) {
        setExpandedPhases({ [phases[0].id]: true });
      }
    } catch (err) {
      console.error('Error loading game settings:', err);
      setError('Failed to load game settings');
    } finally {
      setLoading(false);
    }
  }, [divisionId, phases]);

  const initializeLocalSettings = (data) => {
    const settings = {};
    
    if (data?.phases) {
      data.phases.forEach(phase => {
        settings[phase.phaseId] = {};
        
        if (phase.matchSettings?.length > 0) {
          phase.matchSettings.forEach(ms => {
            settings[phase.phaseId][ms.matchFormatId || 'default'] = {
              bestOf: ms.bestOf || 1,
              scoreFormatId: ms.scoreFormatId,
              gameFormats: ms.gameFormats || []
            };
          });
        }
      });
    }
    
    setLocalSettings(settings);
    setHasChanges(false);
  };

  const togglePhase = (phaseId) => {
    setExpandedPhases(prev => ({
      ...prev,
      [phaseId]: !prev[phaseId]
    }));
  };

  const updatePhaseSetting = (phaseId, matchFormatId, field, value) => {
    setLocalSettings(prev => {
      const key = matchFormatId || 'default';
      return {
        ...prev,
        [phaseId]: {
          ...prev[phaseId],
          [key]: {
            ...prev[phaseId]?.[key],
            [field]: value
          }
        }
      };
    });
    setHasChanges(true);
  };

  const getLocalSetting = (phaseId, matchFormatId) => {
    const key = matchFormatId || 'default';
    return localSettings[phaseId]?.[key] || { bestOf: 1, scoreFormatId: null, gameFormats: [] };
  };

  const handleSave = async (phaseId) => {
    try {
      setSaving(true);
      
      const phaseSettings = localSettings[phaseId] || {};
      const settingsArray = Object.entries(phaseSettings).map(([key, value]) => ({
        matchFormatId: key === 'default' ? null : parseInt(key),
        bestOf: value.bestOf || 1,
        scoreFormatId: value.scoreFormatId,
        gameFormats: value.gameFormats || []
      }));

      const response = await encounterApi.updatePhaseGameSettings(phaseId, settingsArray);
      
      if (response.success) {
        setHasChanges(false);
        onUpdated?.();
      } else {
        throw new Error(response.message || 'Failed to save');
      }
    } catch (err) {
      console.error('Error saving game settings:', err);
      setError('Failed to save game settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      
      for (const phase of phases) {
        const phaseSettings = localSettings[phase.id] || {};
        const settingsArray = Object.entries(phaseSettings).map(([key, value]) => ({
          matchFormatId: key === 'default' ? null : parseInt(key),
          bestOf: value.bestOf || 1,
          scoreFormatId: value.scoreFormatId,
          gameFormats: value.gameFormats || []
        }));

        if (settingsArray.length > 0) {
          await encounterApi.updatePhaseGameSettings(phase.id, settingsArray);
        }
      }
      
      setHasChanges(false);
      onUpdated?.();
    } catch (err) {
      console.error('Error saving all game settings:', err);
      setError('Failed to save game settings');
    } finally {
      setSaving(false);
    }
  };

  // Apply same settings to all phases
  const applyToAllPhases = (sourcePhaseId) => {
    const sourceSettings = localSettings[sourcePhaseId];
    if (!sourceSettings) return;

    setLocalSettings(prev => {
      const updated = { ...prev };
      phases.forEach(phase => {
        if (phase.id !== sourcePhaseId) {
          updated[phase.id] = JSON.parse(JSON.stringify(sourceSettings));
        }
      });
      return updated;
    });
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
          <p className="text-gray-500">Loading game settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={loadData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <Info className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
        <p className="text-yellow-800 font-medium">No phases configured</p>
        <p className="text-yellow-700 text-sm mt-1">
          Complete Step 1 to create phases first.
        </p>
      </div>
    );
  }

  const matchFormats = gameSettings?.matchFormats || [];
  const isMultiMatch = matchesPerEncounter > 1 && matchFormats.length > 0;

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            {isMultiMatch ? (
              <>
                <p className="font-medium mb-1">
                  Multiple Matches per Encounter ({matchFormats.length} match types)
                </p>
                <p>
                  Configure game settings for each match type (e.g., Men's Doubles, Women's Doubles, Mixed).
                  Users will reference matches as <code className="bg-blue-100 px-1 rounded">MD #3</code>, <code className="bg-blue-100 px-1 rounded">WD #3</code>, <code className="bg-blue-100 px-1 rounded">XD #3</code>.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium mb-1">Single Match per Encounter</p>
                <p>
                  Configure the number of games and scoring format for each phase.
                  Users will reference encounters simply as <code className="bg-blue-100 px-1 rounded">#1</code>, <code className="bg-blue-100 px-1 rounded">#2</code>, etc.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save All Button */}
      {hasChanges && (
        <div className="flex justify-end">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save All Changes
          </button>
        </div>
      )}

      {/* Phase Cards */}
      {phases.map((phase, idx) => (
        <div key={phase.id} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Phase Header */}
          <button
            onClick={() => togglePhase(phase.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedPhases[phase.id] ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500" />
              )}
              <div className="text-left">
                <h4 className="font-medium text-gray-900">{phase.name}</h4>
                <p className="text-sm text-gray-500">
                  {phase.phaseType} • {phase.encounterCount || 0} encounters
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {localSettings[phase.id] && Object.keys(localSettings[phase.id]).length > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  Configured
                </span>
              )}
            </div>
          </button>

          {/* Phase Content */}
          {expandedPhases[phase.id] && (
            <div className="p-4 border-t border-gray-200">
              {isMultiMatch ? (
                // Multi-match configuration (per match format)
                <div className="space-y-4">
                  {matchFormats.map(format => (
                    <MatchFormatSettings
                      key={format.id}
                      format={format}
                      settings={getLocalSetting(phase.id, format.id)}
                      scoreFormats={scoreFormats}
                      onChange={(field, value) => updatePhaseSetting(phase.id, format.id, field, value)}
                    />
                  ))}
                </div>
              ) : (
                // Single match configuration
                <SingleMatchSettings
                  settings={getLocalSetting(phase.id, null)}
                  scoreFormats={scoreFormats}
                  onChange={(field, value) => updatePhaseSetting(phase.id, null, field, value)}
                />
              )}

              {/* Phase Actions */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                {idx === 0 && phases.length > 1 && (
                  <button
                    onClick={() => applyToAllPhases(phase.id)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Apply to all phases
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => handleSave(phase.id)}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Phase
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Settings for a single match format (used in multi-match encounters)
 */
function MatchFormatSettings({ format, settings, scoreFormats, onChange }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 flex items-center justify-center bg-orange-100 text-orange-700 font-bold rounded-lg text-sm">
          {format.code || format.matchNumber}
        </div>
        <div>
          <h5 className="font-medium text-gray-900">{format.name}</h5>
          <p className="text-xs text-gray-500">
            {format.maleCount > 0 && `${format.maleCount}M`}
            {format.femaleCount > 0 && `${format.femaleCount}F`}
            {format.unisexCount > 0 && `${format.unisexCount} any`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Best Of */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Games per Match
          </label>
          <select
            value={settings.bestOf || 1}
            onChange={(e) => onChange('bestOf', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value={1}>1 Game</option>
            <option value={3}>Best of 3</option>
            <option value={5}>Best of 5</option>
          </select>
        </div>

        {/* Score Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Score Format
          </label>
          <select
            value={settings.scoreFormatId || ''}
            onChange={(e) => onChange('scoreFormatId', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="">Use Default</option>
            {scoreFormats.map(sf => (
              <option key={sf.id} value={sf.id}>
                {sf.name} ({sf.shortCode})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/**
 * Settings for single match per encounter
 */
function SingleMatchSettings({ settings, scoreFormats, onChange }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Best Of */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <Hash className="w-4 h-4 inline mr-1" />
          Games per Match
        </label>
        <select
          value={settings.bestOf || 1}
          onChange={(e) => onChange('bestOf', parseInt(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value={1}>1 Game</option>
          <option value={3}>Best of 3</option>
          <option value={5}>Best of 5</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {settings.bestOf === 1 && 'Single game decides the match'}
          {settings.bestOf === 3 && 'First to win 2 games'}
          {settings.bestOf === 5 && 'First to win 3 games'}
        </p>
      </div>

      {/* Score Format */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <Target className="w-4 h-4 inline mr-1" />
          Score Format
        </label>
        <select
          value={settings.scoreFormatId || ''}
          onChange={(e) => onChange('scoreFormatId', e.target.value ? parseInt(e.target.value) : null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="">Use Division Default</option>
          {scoreFormats.map(sf => (
            <option key={sf.id} value={sf.id}>
              {sf.name} {sf.shortCode && `(${sf.shortCode})`}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Scoring rules for each game
        </p>
      </div>
    </div>
  );
}
