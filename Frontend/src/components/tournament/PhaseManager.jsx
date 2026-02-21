import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, ChevronUp, ChevronDown, Play, Eye,
  Settings, Users, Award, Clock, Grid3X3, GitBranch, Loader2,
  FileText, Sparkles
} from 'lucide-react';
import { tournamentApi } from '../../services/api';
import TemplateSelector from './TemplateSelector';

const PHASE_TYPES = [
  { value: 'RoundRobin', label: 'Round Robin', icon: Grid3X3, description: 'All teams play each other' },
  { value: 'Pools', label: 'Pool Play', icon: Grid3X3, description: 'Multiple round-robin pools' },
  { value: 'BracketRound', label: 'Bracket Round', icon: GitBranch, description: 'Single bracket round (e.g., Semifinal, Final)' },
  { value: 'SingleElimination', label: 'Single Elimination (Full)', icon: GitBranch, description: 'Complete bracket in one phase' },
  { value: 'DoubleElimination', label: 'Double Elimination', icon: GitBranch, description: 'Lose twice and you\'re out' },
];

const SEEDING_STRATEGIES = [
  { value: 'Snake', label: 'Snake Draft', description: '1A, 1B, 2B, 2A, 3A, 3B... (standard)' },
  { value: 'Sequential', label: 'Sequential', description: '1A, 2A, 3A, 1B, 2B, 3B...' },
  { value: 'CrossPool', label: 'Cross Pool', description: '1A vs 2B, 1B vs 2A (2 pools only)' },
];

const PHASE_STATUS_COLORS = {
  Pending: 'bg-gray-100 text-gray-700',
  InProgress: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Locked: 'bg-purple-100 text-purple-700',
};

/**
 * PhaseManager - Manages division phases for multi-phase tournaments
 * Provides CRUD operations, schedule generation, and phase configuration
 */
export default function PhaseManager({ divisionId, eventId, unitCount = 8, readOnly = false, onPhasesUpdated }) {
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPhase, setEditingPhase] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generating, setGenerating] = useState(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  useEffect(() => {
    if (divisionId) {
      fetchPhases();
    }
  }, [divisionId]);

  const fetchPhases = async () => {
    try {
      setLoading(true);
      const response = await tournamentApi.getDivisionPhases(divisionId);
      if (response.success) {
        setPhases(response.data || []);
        onPhasesUpdated?.();
      }
    } catch (err) {
      setError('Failed to load phases');
      console.error('Error fetching phases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePhase = () => {
    setEditingPhase({
      divisionId,
      phaseType: 'RoundRobin',
      name: `Phase ${phases.length + 1}`,
      incomingSlotCount: 8,
      advancingSlotCount: 4,
      poolCount: 1,
      bestOf: 1,
      includeConsolation: false,
      seedingStrategy: 'Folded',
    });
    setIsModalOpen(true);
  };

  const handleEditPhase = (phase) => {
    setEditingPhase({ ...phase });
    setIsModalOpen(true);
  };

  const handleSavePhase = async () => {
    try {
      if (editingPhase.id) {
        await tournamentApi.updatePhase(editingPhase.id, editingPhase);
      } else {
        await tournamentApi.createPhase(editingPhase);
      }
      await fetchPhases();
      setIsModalOpen(false);
      setEditingPhase(null);
    } catch (err) {
      console.error('Error saving phase:', err);
      alert('Failed to save phase');
    }
  };

  const handleDeletePhase = async (phaseId) => {
    if (!confirm('Are you sure you want to delete this phase?')) return;
    try {
      await tournamentApi.deletePhase(phaseId);
      await fetchPhases();
    } catch (err) {
      console.error('Error deleting phase:', err);
      alert('Failed to delete phase');
    }
  };

  const handleGenerateSchedule = async (phaseId) => {
    try {
      setGenerating(phaseId);
      const response = await tournamentApi.generatePhaseSchedule(phaseId);
      if (response.success) {
        alert(`Generated ${response.data.encountersCreated} matches`);
        await fetchPhases();
      }
    } catch (err) {
      console.error('Error generating schedule:', err);
      alert('Failed to generate schedule');
    } finally {
      setGenerating(null);
    }
  };

  // Generate encounters for ALL phases in order (Draw → pools → brackets → final)
  const handleGenerateAllSchedules = async () => {
    if (!divisionId) return;
    
    try {
      setGeneratingAll(true);
      const response = await tournamentApi.generateAllPhaseSchedules(divisionId, true);
      if (response.success) {
        const { totalEncounters, totalMatches, phasesProcessed } = response.data;
        alert(`Generated ${totalEncounters} encounters and ${totalMatches} matches across ${phasesProcessed} phases`);
        await fetchPhases();
        if (onPhasesUpdated) onPhasesUpdated();
      } else {
        alert(response.message || 'Failed to generate schedules');
      }
    } catch (err) {
      console.error('Error generating all schedules:', err);
      alert('Failed to generate schedules');
    } finally {
      setGeneratingAll(false);
    }
  };

  const handleMovePhase = async (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === phases.length - 1) return;

    const newPhases = [...phases];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newPhases[index], newPhases[targetIndex]] = [newPhases[targetIndex], newPhases[index]];

    // Update phase orders
    try {
      await tournamentApi.updatePhase(newPhases[index].id, { phaseOrder: index + 1 });
      await tournamentApi.updatePhase(newPhases[targetIndex].id, { phaseOrder: targetIndex + 1 });
      await fetchPhases();
    } catch (err) {
      console.error('Error reordering phases:', err);
    }
  };

  const handleTemplateApplied = async (result) => {
    setShowTemplateSelector(false);
    if (result?.success) {
      await fetchPhases();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading phases...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tournament Phases</h3>
          <p className="text-sm text-gray-500">Configure multi-phase tournament structure</p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplateSelector(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Use Template
            </button>
            <button
              onClick={handleCreatePhase}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Phase
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Generate All Schedules Button */}
      {phases.length > 0 && !readOnly && (
        <div className="flex justify-end">
          <button
            onClick={handleGenerateAllSchedules}
            disabled={generatingAll}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
            title="Generate encounters for all phases in order (Draw → pools → brackets)"
          >
            {generatingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generate All Schedules
          </button>
        </div>
      )}

      {/* Phases List */}
      {phases.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-2">No phases configured yet</p>
          <p className="text-sm text-gray-500 mb-6">
            Use a template for quick setup, or create phases manually
          </p>
          {!readOnly && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowTemplateSelector(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Sparkles className="w-4 h-4" />
                Use Template
              </button>
              <span className="text-gray-400">or</span>
              <button
                onClick={handleCreatePhase}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Manual Phase
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase, index) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              index={index}
              totalPhases={phases.length}
              readOnly={readOnly}
              generating={generating === phase.id}
              onEdit={() => handleEditPhase(phase)}
              onDelete={() => handleDeletePhase(phase.id)}
              onGenerate={() => handleGenerateSchedule(phase.id)}
              onMoveUp={() => handleMovePhase(index, 'up')}
              onMoveDown={() => handleMovePhase(index, 'down')}
            />
          ))}
        </div>
      )}

      {/* Phase Modal */}
      {isModalOpen && editingPhase && (
        <PhaseModal
          phase={editingPhase}
          onChange={setEditingPhase}
          onSave={handleSavePhase}
          onClose={() => {
            setIsModalOpen(false);
            setEditingPhase(null);
          }}
        />
      )}

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <TemplateSelector
          divisionId={divisionId}
          unitCount={unitCount}
          onApply={handleTemplateApplied}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  );
}

function PhaseCard({
  phase,
  index,
  totalPhases,
  readOnly,
  generating,
  onEdit,
  onDelete,
  onGenerate,
  onMoveUp,
  onMoveDown
}) {
  const phaseType = PHASE_TYPES.find(t => t.value === phase.phaseType) || PHASE_TYPES[0];
  const Icon = phaseType.icon;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between">
          {/* Phase Info */}
          <div className="flex items-start gap-4">
            {/* Order Controls */}
            {!readOnly && totalPhases > 1 && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={onMoveUp}
                  disabled={index === 0}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={onMoveDown}
                  disabled={index === totalPhases - 1}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Phase Number Badge */}
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
              {phase.phaseOrder}
            </div>

            {/* Details */}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-gray-900">{phase.name}</h4>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PHASE_STATUS_COLORS[phase.status]}`}>
                  {phase.status}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Icon className="w-4 h-4" />
                  {phaseType.label}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {phase.incomingSlotCount} teams
                </span>
                {phase.poolCount > 1 && (
                  <span className="flex items-center gap-1">
                    <Grid3X3 className="w-4 h-4" />
                    {phase.poolCount} pools
                  </span>
                )}
                {phase.advancingSlotCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    {phase.advancingSlotCount} advance
                  </span>
                )}
                {phase.includeConsolation && (
                  <span className="text-amber-600 text-xs font-medium">+3rd Place</span>
                )}
              </div>
              {phase.startTime && (
                <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  {new Date(phase.startTime).toLocaleString()}
                </div>
              )}
              {phase.encounterCount > 0 && (
                <div className="mt-1 text-sm text-green-600">
                  {phase.encounterCount} matches scheduled
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {!readOnly && (
            <div className="flex items-center gap-2">
              <button
                onClick={onGenerate}
                disabled={generating}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                title="Generate Schedule"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Generate
              </button>
              <button
                onClick={onEdit}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                title="Edit Phase"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                disabled={phase.status !== 'Pending'}
                className="p-2 text-red-500 hover:bg-red-50 rounded disabled:opacity-30"
                title="Delete Phase"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseModal({ phase, onChange, onSave, onClose }) {
  const handleChange = (field, value) => {
    onChange({ ...phase, [field]: value });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">
            {phase.id ? 'Edit Phase' : 'Create Phase'}
          </h3>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phase Name</label>
            <input
              type="text"
              value={phase.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Pool Play, Quarterfinals"
            />
          </div>

          {/* Phase Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phase Type</label>
            <select
              value={phase.phaseType || 'RoundRobin'}
              onChange={(e) => handleChange('phaseType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {PHASE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {PHASE_TYPES.find(t => t.value === phase.phaseType)?.description}
            </p>
          </div>

          {/* Slot Counts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Incoming Teams</label>
              <input
                type="number"
                min="2"
                value={phase.incomingSlotCount || 8}
                onChange={(e) => handleChange('incomingSlotCount', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Advancing Teams</label>
              <input
                type="number"
                min="0"
                value={phase.advancingSlotCount || 4}
                onChange={(e) => handleChange('advancingSlotCount', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Pool Count (for round robin) */}
          {(phase.phaseType === 'RoundRobin' || phase.phaseType === 'Pools') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Pools</label>
              <input
                type="number"
                min="1"
                max="8"
                value={phase.poolCount || 1}
                onChange={(e) => handleChange('poolCount', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {phase.poolCount > 1
                  ? `${Math.ceil((phase.incomingSlotCount || 8) / phase.poolCount)} teams per pool`
                  : 'Single pool - all teams play each other'
                }
              </p>
            </div>
          )}

          {/* BracketRound specific options */}
          {phase.phaseType === 'BracketRound' && (
            <>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="includeConsolation"
                  checked={phase.includeConsolation || false}
                  onChange={(e) => handleChange('includeConsolation', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="includeConsolation" className="text-sm text-gray-700">
                  <span className="font-medium">Include 3rd Place Match</span>
                  <span className="block text-gray-500">Semifinal losers play for 3rd place</span>
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Creates {Math.floor((phase.incomingSlotCount || 4) / 2)} bracket match{Math.floor((phase.incomingSlotCount || 4) / 2) !== 1 ? 'es' : ''}
                {phase.includeConsolation ? ' + consolation match' : ''}
                {(phase.incomingSlotCount || 4) % 2 === 1 ? ' (top seed gets bye)' : ''}
              </p>
            </>
          )}

          {/* Seeding Strategy (for bracket phases receiving from pools) */}
          {(phase.phaseType === 'BracketRound' || phase.phaseType === 'SingleElimination') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seeding Strategy (from Pools)</label>
              <select
                value={phase.seedingStrategy || 'Folded'}
                onChange={(e) => handleChange('seedingStrategy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {SEEDING_STRATEGIES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {SEEDING_STRATEGIES.find(s => s.value === (phase.seedingStrategy || 'Folded'))?.description}
              </p>
            </div>
          )}

          {/* Best Of */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Games per Match</label>
            <select
              value={phase.bestOf || 1}
              onChange={(e) => handleChange('bestOf', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 Game</option>
              <option value={2}>Best of 3</option>
              <option value={3}>Best of 5</option>
            </select>
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input
              type="datetime-local"
              value={phase.startTime ? new Date(phase.startTime).toISOString().slice(0, 16) : ''}
              onChange={(e) => handleChange('startTime', e.target.value ? new Date(e.target.value).toISOString() : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Match Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Match Duration (minutes)</label>
            <input
              type="number"
              min="5"
              max="120"
              value={phase.estimatedMatchDurationMinutes || 20}
              onChange={(e) => handleChange('estimatedMatchDurationMinutes', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Detailed timing (per-game, changeover, buffer) can be set in the Court Scheduler.
            </p>
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {phase.id ? 'Save Changes' : 'Create Phase'}
          </button>
        </div>
      </div>
    </div>
  );
}
