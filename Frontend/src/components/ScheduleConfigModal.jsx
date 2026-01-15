import { useState, useEffect } from 'react';
import { X, Calendar, Users, Grid, AlertCircle, Loader2, ChevronDown, ChevronUp, Plus, Settings, Trophy } from 'lucide-react';
import { tournamentApi } from '../services/api';
import HelpIcon from './ui/HelpIcon';

const SCHEDULE_TYPES = [
  { value: 'RoundRobin', label: 'Round Robin', description: 'Every unit plays every other unit', hasPoolPhase: true, hasPlayoffPhase: false },
  { value: 'SingleElimination', label: 'Single Elimination', description: 'Knockout format - lose once and out', hasPoolPhase: false, hasPlayoffPhase: true },
  { value: 'DoubleElimination', label: 'Double Elimination', description: 'Must lose twice to be eliminated', hasPoolPhase: false, hasPlayoffPhase: true },
  { value: 'RoundRobinPlayoff', label: 'Round Robin + Playoff', description: 'Pool play followed by bracket', hasPoolPhase: true, hasPlayoffPhase: true }
];

const GAMES_PER_MATCH_OPTIONS = [
  { value: 1, label: '1 Game', description: 'Single game decides match' },
  { value: 3, label: 'Best of 3', description: 'First to win 2 games' },
  { value: 5, label: 'Best of 5', description: 'First to win 3 games' }
];

export default function ScheduleConfigModal({
  isOpen,
  onClose,
  division,
  onGenerate,
  isGenerating = false
}) {
  // Basic config
  const [scheduleType, setScheduleType] = useState('RoundRobin');
  const [targetUnits, setTargetUnits] = useState(division?.registeredUnits || 4);

  // Pool phase config
  const [poolCount, setPoolCount] = useState(1);
  const [poolGamesPerMatch, setPoolGamesPerMatch] = useState(1);
  const [poolScoreFormatId, setPoolScoreFormatId] = useState(null);
  const [poolGameFormats, setPoolGameFormats] = useState([null, null, null, null, null]); // For Best of 3/5

  // Playoff phase config
  const [playoffFromPools, setPlayoffFromPools] = useState(2);
  const [playoffGamesPerMatch, setPlayoffGamesPerMatch] = useState(1);
  const [playoffScoreFormatId, setPlayoffScoreFormatId] = useState(null);
  const [playoffGameFormats, setPlayoffGameFormats] = useState([null, null, null, null, null]); // For Best of 3/5

  // Score formats
  const [scoreFormats, setScoreFormats] = useState([]);
  const [loadingFormats, setLoadingFormats] = useState(false);
  const [showNewFormatForm, setShowNewFormatForm] = useState(false);
  const [scoreMethods, setScoreMethods] = useState([]);

  // New format form
  const [newFormat, setNewFormat] = useState({
    name: '',
    scoreMethodId: null,
    maxPoints: 11,
    winByMargin: 2,
    capAfter: 0
  });
  const [savingFormat, setSavingFormat] = useState(false);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewStats, setPreviewStats] = useState(null);
  const [activePhaseTab, setActivePhaseTab] = useState('pool'); // 'pool' or 'playoff'

  // Load score formats on mount
  useEffect(() => {
    if (isOpen) {
      loadScoreFormats();
      loadScoreMethods();
    }
  }, [isOpen]);

  useEffect(() => {
    if (division) {
      setTargetUnits(Math.max(division.registeredUnits || 0, 4));
    }
  }, [division]);

  useEffect(() => {
    calculatePreviewStats();
  }, [scheduleType, targetUnits, poolCount, playoffFromPools, poolGamesPerMatch, playoffGamesPerMatch]);

  const loadScoreFormats = async () => {
    setLoadingFormats(true);
    try {
      const response = await tournamentApi.getScoreFormats();
      if (response.success) {
        setScoreFormats(response.data || []);
        // Set default format if none selected
        const defaultFormat = response.data?.find(f => f.isDefault);
        if (defaultFormat && !poolScoreFormatId) {
          setPoolScoreFormatId(defaultFormat.id);
          setPlayoffScoreFormatId(defaultFormat.id);
          // Initialize all game formats with default
          setPoolGameFormats([defaultFormat.id, defaultFormat.id, defaultFormat.id, defaultFormat.id, defaultFormat.id]);
          setPlayoffGameFormats([defaultFormat.id, defaultFormat.id, defaultFormat.id, defaultFormat.id, defaultFormat.id]);
        }
      }
    } catch (err) {
      console.error('Error loading score formats:', err);
    } finally {
      setLoadingFormats(false);
    }
  };

  const loadScoreMethods = async () => {
    try {
      const response = await tournamentApi.getScoreMethods();
      if (response.success) {
        setScoreMethods(response.data || []);
      }
    } catch (err) {
      console.error('Error loading score methods:', err);
    }
  };

  const handleCreateFormat = async () => {
    if (!newFormat.name.trim()) return;

    setSavingFormat(true);
    try {
      const response = await tournamentApi.createScoreFormat({
        name: newFormat.name,
        scoreMethodId: newFormat.scoreMethodId,
        maxPoints: newFormat.maxPoints,
        winByMargin: newFormat.winByMargin,
        capAfter: newFormat.capAfter
      });

      if (response.success) {
        await loadScoreFormats();
        setShowNewFormatForm(false);
        setNewFormat({ name: '', scoreMethodId: null, maxPoints: 11, winByMargin: 2, capAfter: 0 });
        // Auto-select the new format
        if (response.data?.id) {
          if (activePhaseTab === 'pool') {
            setPoolScoreFormatId(response.data.id);
          } else {
            setPlayoffScoreFormatId(response.data.id);
          }
        }
      }
    } catch (err) {
      console.error('Error creating score format:', err);
      alert('Failed to create score format');
    } finally {
      setSavingFormat(false);
    }
  };

  const calculatePreviewStats = () => {
    if (targetUnits < 2) {
      setPreviewStats(null);
      return;
    }

    let poolMatches = 0;
    let playoffMatches = 0;
    let poolRounds = 0;
    let playoffRounds = 0;
    let byes = 0;
    let matchesPerUnit = 0;

    const selectedType = SCHEDULE_TYPES.find(t => t.value === scheduleType);

    if (selectedType?.hasPoolPhase) {
      const unitsPerPool = Math.ceil(targetUnits / poolCount);
      const matchesPerPool = (unitsPerPool * (unitsPerPool - 1)) / 2;
      poolMatches = matchesPerPool * poolCount;
      poolRounds = unitsPerPool - 1;
      matchesPerUnit = unitsPerPool - 1;
    }

    if (selectedType?.hasPlayoffPhase) {
      let playoffUnits = targetUnits;
      if (scheduleType === 'RoundRobinPlayoff') {
        playoffUnits = playoffFromPools * poolCount;
      }

      let bracketSize = 1;
      while (bracketSize < playoffUnits) bracketSize *= 2;
      byes = bracketSize - playoffUnits;

      if (scheduleType === 'DoubleElimination') {
        playoffMatches = (bracketSize - 1) + (bracketSize - 1) + 1;
        playoffRounds = Math.log2(bracketSize) * 2;
      } else {
        playoffMatches = bracketSize - 1;
        playoffRounds = Math.log2(bracketSize);
      }
    }

    const totalGames = (poolMatches * poolGamesPerMatch) + (playoffMatches * playoffGamesPerMatch);

    setPreviewStats({
      poolMatches: Math.round(poolMatches),
      playoffMatches: Math.round(playoffMatches),
      totalMatches: Math.round(poolMatches + playoffMatches),
      totalGames: Math.round(totalGames),
      poolRounds: Math.round(poolRounds),
      playoffRounds: Math.round(playoffRounds),
      byes,
      matchesPerUnit: Math.round(matchesPerUnit),
      poolSize: poolCount > 1 ? Math.ceil(targetUnits / poolCount) : targetUnits
    });
  };

  const handleGenerate = () => {
    const selectedType = SCHEDULE_TYPES.find(t => t.value === scheduleType);

    // Get relevant game formats based on gamesPerMatch
    const getGameFormatsArray = (gamesPerMatch, gameFormats, defaultFormatId) => {
      if (gamesPerMatch === 1) return [defaultFormatId];
      return gameFormats.slice(0, gamesPerMatch).map(f => f || defaultFormatId);
    };

    onGenerate({
      scheduleType,
      targetUnits,
      // Pool config
      poolCount: selectedType?.hasPoolPhase ? poolCount : null,
      poolGamesPerMatch: selectedType?.hasPoolPhase ? poolGamesPerMatch : null,
      poolScoreFormatId: selectedType?.hasPoolPhase ? poolScoreFormatId : null,
      poolGameFormats: selectedType?.hasPoolPhase ? getGameFormatsArray(poolGamesPerMatch, poolGameFormats, poolScoreFormatId) : null,
      // Playoff config
      playoffFromPools: scheduleType === 'RoundRobinPlayoff' ? playoffFromPools : null,
      playoffGamesPerMatch: selectedType?.hasPlayoffPhase ? playoffGamesPerMatch : null,
      playoffScoreFormatId: selectedType?.hasPlayoffPhase ? playoffScoreFormatId : null,
      playoffGameFormats: selectedType?.hasPlayoffPhase ? getGameFormatsArray(playoffGamesPerMatch, playoffGameFormats, playoffScoreFormatId) : null,
      // Legacy field for backward compatibility
      bestOf: selectedType?.hasPoolPhase ? poolGamesPerMatch : playoffGamesPerMatch,
      scoreFormatId: selectedType?.hasPoolPhase ? poolScoreFormatId : playoffScoreFormatId
    });
  };

  if (!isOpen) return null;

  const registeredUnits = division?.registeredUnits || 0;
  const placeholderCount = targetUnits - registeredUnits;
  const selectedType = SCHEDULE_TYPES.find(t => t.value === scheduleType);

  const renderPhaseConfig = (phase) => {
    const isPool = phase === 'pool';
    const gamesPerMatch = isPool ? poolGamesPerMatch : playoffGamesPerMatch;
    const setGamesPerMatch = isPool ? setPoolGamesPerMatch : setPlayoffGamesPerMatch;
    const scoreFormatId = isPool ? poolScoreFormatId : playoffScoreFormatId;
    const setScoreFormatId = isPool ? setPoolScoreFormatId : setPlayoffScoreFormatId;
    const gameFormats = isPool ? poolGameFormats : playoffGameFormats;
    const setGameFormats = isPool ? setPoolGameFormats : setPlayoffGameFormats;

    // Update a specific game's format
    const updateGameFormat = (gameIndex, formatId) => {
      const newFormats = [...gameFormats];
      newFormats[gameIndex] = formatId;
      setGameFormats(newFormats);
    };

    // Apply same format to all games
    const applyToAll = (formatId) => {
      setGameFormats([formatId, formatId, formatId, formatId, formatId]);
    };

    // When gamesPerMatch changes, update default format for new selection
    const handleGamesPerMatchChange = (value) => {
      setGamesPerMatch(value);
      // Initialize game formats with current default if not set
      if (scoreFormatId) {
        const newFormats = gameFormats.map(f => f || scoreFormatId);
        setGameFormats(newFormats);
      }
    };

    const gameLabels = ['Game 1', 'Game 2', 'Game 3 (Decider)', 'Game 4', 'Game 5 (Decider)'];

    return (
      <div className="space-y-4">
        {/* Games per Match */}
        <div>
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-2">
            Games per Match
            <HelpIcon topicCode="division.gamesPerMatch" size="sm" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {GAMES_PER_MATCH_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleGamesPerMatchChange(option.value)}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  gamesPerMatch === option.value
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-500 mt-1">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Score Format Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
              Score Format
              <HelpIcon topicCode="division.defaultScoreFormat" size="sm" />
            </label>
            <button
              type="button"
              onClick={() => {
                setActivePhaseTab(phase);
                setShowNewFormatForm(true);
              }}
              className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Format
            </button>
          </div>

          {loadingFormats ? (
            <div className="text-sm text-gray-500">Loading formats...</div>
          ) : gamesPerMatch === 1 ? (
            // Single game - single format selector
            <select
              value={scoreFormatId || ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value) : null;
                setScoreFormatId(val);
                if (val) applyToAll(val);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Select format...</option>
              {scoreFormats.map(format => (
                <option key={format.id} value={format.id}>
                  {format.name} ({format.maxPoints} pts, win by {format.winByMargin})
                </option>
              ))}
            </select>
          ) : (
            // Multiple games - show format for each game
            <div className="space-y-2">
              {/* Quick apply dropdown */}
              <div className="flex items-center gap-2 mb-3">
                <select
                  value={scoreFormatId || ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : null;
                    setScoreFormatId(val);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm"
                >
                  <option value="">Select default format...</option>
                  {scoreFormats.map(format => (
                    <option key={format.id} value={format.id}>
                      {format.name} ({format.maxPoints} pts, win by {format.winByMargin})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => scoreFormatId && applyToAll(scoreFormatId)}
                  disabled={!scoreFormatId}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Apply to All
                </button>
              </div>

              {/* Individual game formats */}
              <div className="border rounded-lg divide-y bg-gray-50">
                {Array.from({ length: gamesPerMatch }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <span className={`text-sm font-medium w-28 ${
                      (gamesPerMatch === 3 && i === 2) || (gamesPerMatch === 5 && i === 4)
                        ? 'text-orange-600'
                        : 'text-gray-600'
                    }`}>
                      {gameLabels[i]}
                    </span>
                    <select
                      value={gameFormats[i] || ''}
                      onChange={(e) => updateGameFormat(i, e.target.value ? parseInt(e.target.value) : null)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Select...</option>
                      {scoreFormats.map(format => (
                        <option key={format.id} value={format.id}>
                          {format.name} ({format.maxPoints} pts)
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Tip: Decider games are often played to 15 points instead of 11
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold">Configure Schedule</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Division Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-medium text-gray-900">{division?.name}</div>
            <div className="text-sm text-gray-500 mt-1">
              {registeredUnits} registered unit{registeredUnits !== 1 ? 's' : ''}
              {division?.teamUnitName && ` • ${division.teamUnitName}`}
            </div>
          </div>

          {/* Schedule Type */}
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-2">
              Schedule Type
              <HelpIcon topicCode="division.scheduleType" size="sm" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SCHEDULE_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setScheduleType(type.value)}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    scheduleType === type.value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{type.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Units */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Number of Units
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={Math.max(registeredUnits, 2)}
                max={64}
                value={targetUnits}
                onChange={(e) => setTargetUnits(Math.max(2, parseInt(e.target.value) || 2))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
              />
              <div className="flex gap-2 flex-wrap">
                {[4, 8, 16, 32].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTargetUnits(n)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      targetUnits === n
                        ? 'bg-orange-100 border-orange-300 text-orange-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {placeholderCount > 0 && (
              <div className="mt-2 text-sm text-blue-600 flex items-center gap-1">
                <Users className="w-4 h-4" />
                {placeholderCount} placeholder slot{placeholderCount !== 1 ? 's' : ''} (byes)
              </div>
            )}
          </div>

          {/* Pool Configuration */}
          {selectedType?.hasPoolPhase && (
            <div>
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-2">
                Number of Pools
                <HelpIcon topicCode="division.pools" size="sm" />
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={poolCount}
                  onChange={(e) => setPoolCount(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                >
                  {[1, 2, 3, 4, 6, 8].map(n => (
                    <option key={n} value={n}>
                      {n} pool{n !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
                {poolCount > 1 && previewStats && (
                  <span className="text-sm text-gray-500">
                    (~{previewStats.poolSize} units per pool)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Playoff Advancement */}
          {scheduleType === 'RoundRobinPlayoff' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teams Advancing per Pool
              </label>
              <select
                value={playoffFromPools}
                onChange={(e) => setPlayoffFromPools(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
              >
                {[1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>
                    Top {n} from each pool
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Phase Configuration Tabs */}
          {(selectedType?.hasPoolPhase || selectedType?.hasPlayoffPhase) && (
            <div className="border rounded-lg overflow-hidden">
              {/* Tab Headers */}
              {selectedType?.hasPoolPhase && selectedType?.hasPlayoffPhase && (
                <div className="flex border-b bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setActivePhaseTab('pool')}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      activePhaseTab === 'pool'
                        ? 'bg-white text-orange-600 border-b-2 border-orange-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Settings className="w-4 h-4 inline mr-1" />
                    Pool Play
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePhaseTab('playoff')}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      activePhaseTab === 'playoff'
                        ? 'bg-white text-orange-600 border-b-2 border-orange-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Trophy className="w-4 h-4 inline mr-1" />
                    Playoff
                  </button>
                </div>
              )}

              {/* Tab Content */}
              <div className="p-4">
                {selectedType?.hasPoolPhase && selectedType?.hasPlayoffPhase ? (
                  activePhaseTab === 'pool' ? renderPhaseConfig('pool') : renderPhaseConfig('playoff')
                ) : selectedType?.hasPoolPhase ? (
                  renderPhaseConfig('pool')
                ) : (
                  renderPhaseConfig('playoff')
                )}
              </div>
            </div>
          )}

          {/* New Format Form */}
          {showNewFormatForm && (
            <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Score Format
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Name</label>
                  <input
                    type="text"
                    value={newFormat.name}
                    onChange={(e) => setNewFormat({ ...newFormat, name: e.target.value })}
                    placeholder="e.g., Rally to 15"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Score Method</label>
                    <select
                      value={newFormat.scoreMethodId || ''}
                      onChange={(e) => setNewFormat({ ...newFormat, scoreMethodId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Select method...</option>
                      {scoreMethods.map(method => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Play To</label>
                    <select
                      value={newFormat.maxPoints}
                      onChange={(e) => setNewFormat({ ...newFormat, maxPoints: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    >
                      {[7, 9, 11, 15, 21, 25].map(n => (
                        <option key={n} value={n}>{n} points</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Win By</label>
                    <select
                      value={newFormat.winByMargin}
                      onChange={(e) => setNewFormat({ ...newFormat, winByMargin: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value={1}>1 point</option>
                      <option value={2}>2 points</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Cap After</label>
                    <select
                      value={newFormat.capAfter}
                      onChange={(e) => setNewFormat({ ...newFormat, capAfter: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value={0}>No cap</option>
                      {[2, 4, 6, 8].map(n => (
                        <option key={n} value={n}>+{n} points</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCreateFormat}
                    disabled={savingFormat || !newFormat.name.trim()}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {savingFormat && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Format
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewFormatForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preview Stats */}
          {previewStats && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Grid className="w-4 h-4" />
                Schedule Preview
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {previewStats.poolMatches > 0 && (
                  <div>
                    <span className="text-blue-700">Pool Matches:</span>
                    <span className="ml-2 font-semibold text-blue-900">{previewStats.poolMatches}</span>
                  </div>
                )}
                {previewStats.playoffMatches > 0 && (
                  <div>
                    <span className="text-blue-700">Playoff Matches:</span>
                    <span className="ml-2 font-semibold text-blue-900">{previewStats.playoffMatches}</span>
                  </div>
                )}
                <div>
                  <span className="text-blue-700">Total Matches:</span>
                  <span className="ml-2 font-semibold text-blue-900">{previewStats.totalMatches}</span>
                </div>
                <div>
                  <span className="text-blue-700">Total Games:</span>
                  <span className="ml-2 font-semibold text-blue-900">{previewStats.totalGames}</span>
                </div>
                {previewStats.byes > 0 && (
                  <div>
                    <span className="text-blue-700">First Round Byes:</span>
                    <span className="ml-2 font-semibold text-blue-900">{previewStats.byes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warning for placeholder units */}
          {placeholderCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">Placeholder Units</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Schedule will have {targetUnits} slots. Use <strong>Drawing</strong> to assign
                    {registeredUnits} registered units. Empty slots = byes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || targetUnits < 2}
            className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                Generate Schedule
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
