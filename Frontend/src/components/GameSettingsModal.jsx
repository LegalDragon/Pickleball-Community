import { useState, useEffect } from 'react';
import { X, Loader2, HelpCircle, Plus } from 'lucide-react';
import { tournamentApi, scoreFormatsApi } from '../services/api';

/**
 * GameSettingsModal - Configure games per match and score format for a division/phase
 */
export default function GameSettingsModal({ isOpen, onClose, division, onSave }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scoreFormats, setScoreFormats] = useState([]);
  const [settings, setSettings] = useState({
    gamesPerMatch: 1,
    defaultScoreFormatId: null
  });
  const [error, setError] = useState(null);

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

      // Set initial values from division
      setSettings({
        gamesPerMatch: division.gamesPerMatch || 1,
        defaultScoreFormatId: division.defaultScoreFormatId || null
      });
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

      const response = await tournamentApi.updateDivisionGameSettings(division.id, {
        gamesPerMatch: settings.gamesPerMatch,
        defaultScoreFormatId: settings.defaultScoreFormatId
      });

      if (response.success) {
        onSave?.();
        onClose();
      } else {
        setError(response.message || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving game settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
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
        <div className="p-4 overflow-y-auto">
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
                  <button
                    onClick={() => setSettings({ ...settings, gamesPerMatch: 1 })}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      settings.gamesPerMatch === 1
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`text-lg font-bold ${settings.gamesPerMatch === 1 ? 'text-orange-600' : 'text-gray-900'}`}>
                      1 Game
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Single game decides match
                    </div>
                  </button>

                  <button
                    onClick={() => setSettings({ ...settings, gamesPerMatch: 3 })}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      settings.gamesPerMatch === 3
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`text-lg font-bold ${settings.gamesPerMatch === 3 ? 'text-orange-600' : 'text-gray-900'}`}>
                      Best of 3
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      First to win 2 games
                    </div>
                  </button>

                  <button
                    onClick={() => setSettings({ ...settings, gamesPerMatch: 5 })}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      settings.gamesPerMatch === 5
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`text-lg font-bold ${settings.gamesPerMatch === 5 ? 'text-orange-600' : 'text-gray-900'}`}>
                      Best of 5
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      First to win 3 games
                    </div>
                  </button>
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
                  value={settings.defaultScoreFormatId || ''}
                  onChange={(e) => setSettings({ ...settings, defaultScoreFormatId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm"
                >
                  <option value="">Select score format...</option>
                  {scoreFormats.map(format => (
                    <option key={format.id} value={format.id}>
                      {format.name} ({format.pointsToWin} pts{format.winByTwo ? ', win by 2' : ''})
                    </option>
                  ))}
                </select>

                {/* Format preview */}
                {settings.defaultScoreFormatId && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    {(() => {
                      const format = scoreFormats.find(f => f.id === settings.defaultScoreFormatId);
                      if (!format) return null;
                      return (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">{format.name}</span>
                          <span className="text-gray-400 ml-2">
                            Play to {format.pointsToWin}
                            {format.winByTwo && ', must win by 2'}
                            {format.cappedAt && `, cap at ${format.cappedAt}`}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="text-sm text-blue-800">
                  <strong>Match format:</strong>{' '}
                  {settings.gamesPerMatch === 1 ? 'Single game' : `Best of ${settings.gamesPerMatch}`}
                  {settings.defaultScoreFormatId && (
                    <span>
                      {' • '}
                      {scoreFormats.find(f => f.id === settings.defaultScoreFormatId)?.name || 'Selected format'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
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
