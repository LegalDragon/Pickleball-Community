import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Settings, Users, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { encounterApi } from '../services/api';

/**
 * MatchFormatEditor - Configure matches per encounter and match format definitions
 * Used for team scrimmage formats where each encounter has multiple matches
 * (e.g., Men's Doubles, Women's Doubles, Mixed Doubles)
 */
export default function MatchFormatEditor({ divisionId, onConfigChange }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState({
    matchesPerEncounter: 1,
    allowPlayerReuseInEncounter: true,
    allowLineupChangePerEncounter: true,
    matchFormats: []
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (divisionId) {
      loadConfig();
    }
  }, [divisionId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await encounterApi.getDivisionConfig(divisionId);
      if (response.success) {
        setConfig({
          matchesPerEncounter: response.data.matchesPerEncounter || 1,
          allowPlayerReuseInEncounter: response.data.allowPlayerReuseInEncounter ?? true,
          allowLineupChangePerEncounter: response.data.allowLineupChangePerEncounter ?? true,
          matchFormats: response.data.matchFormats || []
        });
        // Auto-expand if configured for multi-match
        if (response.data.matchesPerEncounter > 1) {
          setExpanded(true);
        }
      }
    } catch (err) {
      console.error('Error loading encounter config:', err);
      setError('Failed to load match format configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const payload = {
        matchesPerEncounter: config.matchesPerEncounter,
        allowPlayerReuseInEncounter: config.allowPlayerReuseInEncounter,
        allowLineupChangePerEncounter: config.allowLineupChangePerEncounter,
        matchFormats: config.matchFormats.map((f, idx) => ({
          name: f.name,
          code: f.code || '',
          matchNumber: idx + 1,
          maleCount: f.maleCount || 0,
          femaleCount: f.femaleCount || 0,
          unisexCount: f.unisexCount || 0,
          bestOf: f.bestOf || 1,
          scoreFormatId: f.scoreFormatId || null,
          sortOrder: idx
        }))
      };

      const response = await encounterApi.updateDivisionConfig(divisionId, payload);
      if (response.success) {
        onConfigChange?.();
      } else {
        setError(response.message || 'Failed to save configuration');
      }
    } catch (err) {
      console.error('Error saving encounter config:', err);
      setError('Failed to save match format configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleMatchCountChange = (count) => {
    const newCount = Math.max(1, Math.min(10, count));
    const currentFormats = [...config.matchFormats];

    // Adjust match formats array
    if (newCount > currentFormats.length) {
      // Add new formats
      for (let i = currentFormats.length; i < newCount; i++) {
        currentFormats.push({
          name: `Match ${i + 1}`,
          code: `M${i + 1}`,
          matchNumber: i + 1,
          maleCount: 0,
          femaleCount: 0,
          unisexCount: 2,
          bestOf: 1,
          sortOrder: i
        });
      }
    } else if (newCount < currentFormats.length) {
      // Remove excess formats
      currentFormats.length = newCount;
    }

    setConfig({
      ...config,
      matchesPerEncounter: newCount,
      matchFormats: currentFormats
    });
  };

  const handleFormatChange = (index, field, value) => {
    const newFormats = [...config.matchFormats];
    newFormats[index] = { ...newFormats[index], [field]: value };
    setConfig({ ...config, matchFormats: newFormats });
  };

  const applyPreset = (preset) => {
    let formats = [];
    switch (preset) {
      case 'team-scrimmage-3':
        formats = [
          { name: "Men's Doubles", code: "MD", maleCount: 2, femaleCount: 0, unisexCount: 0, bestOf: 1 },
          { name: "Women's Doubles", code: "WD", maleCount: 0, femaleCount: 2, unisexCount: 0, bestOf: 1 },
          { name: "Mixed Doubles", code: "XD", maleCount: 1, femaleCount: 1, unisexCount: 0, bestOf: 1 }
        ];
        break;
      case 'team-scrimmage-5':
        formats = [
          { name: "Men's Doubles 1", code: "MD1", maleCount: 2, femaleCount: 0, unisexCount: 0, bestOf: 1 },
          { name: "Women's Doubles 1", code: "WD1", maleCount: 0, femaleCount: 2, unisexCount: 0, bestOf: 1 },
          { name: "Mixed Doubles 1", code: "XD1", maleCount: 1, femaleCount: 1, unisexCount: 0, bestOf: 1 },
          { name: "Men's Doubles 2", code: "MD2", maleCount: 2, femaleCount: 0, unisexCount: 0, bestOf: 1 },
          { name: "Women's Doubles 2", code: "WD2", maleCount: 0, femaleCount: 2, unisexCount: 0, bestOf: 1 }
        ];
        break;
      case 'doubles-only':
        formats = [
          { name: "Doubles", code: "D", maleCount: 0, femaleCount: 0, unisexCount: 2, bestOf: 1 }
        ];
        break;
      default:
        return;
    }

    setConfig({
      ...config,
      matchesPerEncounter: formats.length,
      matchFormats: formats.map((f, idx) => ({
        ...f,
        code: f.code || `M${idx + 1}`,
        matchNumber: idx + 1,
        sortOrder: idx
      }))
    });
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading match configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-900">Match Format Configuration</span>
          {config.matchesPerEncounter > 1 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
              {config.matchesPerEncounter} matches per encounter
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Info Banner */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">Team Scrimmage Format</p>
              <p className="mt-1">
                Configure multiple matches per encounter for team league formats.
                For standard doubles/singles tournaments, keep this at 1.
              </p>
            </div>
          </div>

          {/* Matches Per Encounter */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 w-48">
              Matches per Encounter
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.matchesPerEncounter}
              onChange={(e) => handleMatchCountChange(parseInt(e.target.value) || 1)}
              className="w-20 border border-gray-300 rounded-lg p-2 text-center"
            />
            <span className="text-sm text-gray-500">
              (1 = standard tournament, 3+ = team scrimmage)
            </span>
          </div>

          {/* Quick Presets */}
          {config.matchesPerEncounter <= 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Quick presets:</span>
              <button
                onClick={() => applyPreset('team-scrimmage-3')}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                3-Match Team Scrimmage
              </button>
              <button
                onClick={() => applyPreset('team-scrimmage-5')}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                5-Match Team Scrimmage
              </button>
            </div>
          )}

          {/* Match Format Definitions */}
          {config.matchesPerEncounter > 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Match Definitions
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => applyPreset('team-scrimmage-3')}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    3-Match Preset
                  </button>
                  <button
                    onClick={() => applyPreset('team-scrimmage-5')}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    5-Match Preset
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {config.matchFormats.map((format, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-lg bg-white">
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-sm font-medium text-gray-600">
                        {index + 1}
                      </span>

                      <input
                        type="text"
                        value={format.name}
                        onChange={(e) => handleFormatChange(index, 'name', e.target.value)}
                        placeholder="Match name"
                        className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
                      />

                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Code:</label>
                        <input
                          type="text"
                          value={format.code || ''}
                          onChange={(e) => handleFormatChange(index, 'code', e.target.value.toUpperCase())}
                          placeholder="MD"
                          maxLength={10}
                          className="w-16 border border-gray-300 rounded p-1 text-sm text-center uppercase"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">M:</label>
                        <input
                          type="number"
                          min="0"
                          max="4"
                          value={format.maleCount}
                          onChange={(e) => handleFormatChange(index, 'maleCount', parseInt(e.target.value) || 0)}
                          className="w-14 border border-gray-300 rounded p-1 text-sm text-center"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">F:</label>
                        <input
                          type="number"
                          min="0"
                          max="4"
                          value={format.femaleCount}
                          onChange={(e) => handleFormatChange(index, 'femaleCount', parseInt(e.target.value) || 0)}
                          className="w-14 border border-gray-300 rounded p-1 text-sm text-center"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Any:</label>
                        <input
                          type="number"
                          min="0"
                          max="4"
                          value={format.unisexCount}
                          onChange={(e) => handleFormatChange(index, 'unisexCount', parseInt(e.target.value) || 0)}
                          className="w-14 border border-gray-300 rounded p-1 text-sm text-center"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Best of:</label>
                        <select
                          value={format.bestOf}
                          onChange={(e) => handleFormatChange(index, 'bestOf', parseInt(e.target.value))}
                          className="border border-gray-300 rounded p-1 text-sm"
                        >
                          <option value={1}>1</option>
                          <option value={3}>3</option>
                          <option value={5}>5</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-500 ml-12">
                      {format.code && <span className="font-medium mr-2">[{format.code}]</span>}
                      Players per side: {(format.maleCount || 0) + (format.femaleCount || 0) + (format.unisexCount || 0)}
                      {format.maleCount > 0 && ` (${format.maleCount} male)`}
                      {format.femaleCount > 0 && ` (${format.femaleCount} female)`}
                      {format.unisexCount > 0 && ` (${format.unisexCount} any gender)`}
                    </div>
                  </div>
                ))}
              </div>

              {/* Player Options */}
              <div className="pt-4 border-t space-y-3">
                <h4 className="font-medium text-gray-900 text-sm">Player Options</h4>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.allowPlayerReuseInEncounter}
                    onChange={(e) => setConfig({ ...config, allowPlayerReuseInEncounter: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <div>
                    <span className="text-sm text-gray-700">Allow player reuse within encounter</span>
                    <p className="text-xs text-gray-500">Same player can play in multiple matches</p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.allowLineupChangePerEncounter}
                    onChange={(e) => setConfig({ ...config, allowLineupChangePerEncounter: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <div>
                    <span className="text-sm text-gray-700">Allow lineup changes per encounter</span>
                    <p className="text-xs text-gray-500">Captain can adjust lineup for each encounter</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="pt-4 border-t flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Match Configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
