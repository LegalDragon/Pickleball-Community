import { useState, useEffect, useCallback } from 'react';
import {
  Shuffle, Users, Hash, Loader2, RefreshCw, Trash2, Save,
  CheckCircle, AlertCircle, ChevronDown, Grid3X3, X, ArrowRight
} from 'lucide-react';
import { tournamentApi } from '../../services/api';

/**
 * TeamDrawing - Phase slot assignment / team drawing panel
 *
 * Shows incoming slots for a phase and allows:
 * - Manual assignment (click slot → select team)
 * - Random draw (shuffle unassigned teams into empty slots)
 * - Clear all assignments
 *
 * Props:
 * - phaseId: The phase to manage slots for
 * - divisionId: Division ID (for loading available units/teams)
 * - eventId: Event ID (optional)
 * - onAssignmentChange: Callback after slots are updated
 * - readOnly: Whether editing is disabled
 */
export default function TeamDrawing({
  phaseId,
  divisionId,
  eventId,
  onAssignmentChange,
  readOnly = false
}) {
  const [phase, setPhase] = useState(null);
  const [slots, setSlots] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [pendingAssignments, setPendingAssignments] = useState({}); // slotId → unitId

  useEffect(() => {
    if (phaseId && divisionId) {
      loadData();
    }
  }, [phaseId, divisionId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [phaseRes, unitsRes] = await Promise.all([
        tournamentApi.getPhase(phaseId),
        tournamentApi.getDivisionUnits(divisionId)
      ]);

      const phaseData = phaseRes?.data || phaseRes;
      setPhase(phaseData);

      // Extract incoming slots
      const incomingSlots = (phaseData?.slots || [])
        .filter(s => s.slotType === 'Incoming' || s.slotType === 'incoming')
        .sort((a, b) => a.slotNumber - b.slotNumber);
      setSlots(incomingSlots);

      const unitsData = unitsRes?.data || unitsRes || [];
      setUnits(Array.isArray(unitsData) ? unitsData : []);

      // Initialize pending assignments from current slot data
      const initial = {};
      incomingSlots.forEach(s => {
        if (s.unitId) initial[s.id] = s.unitId;
      });
      setPendingAssignments(initial);
    } catch (err) {
      console.error('Error loading drawing data:', err);
      setError('Failed to load phase/team data');
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 3000);
  };

  // Get units that are already assigned to a slot
  const assignedUnitIds = new Set(
    Object.values(pendingAssignments).filter(Boolean)
  );

  // Units available to assign (not yet assigned to any slot)
  const availableUnits = units.filter(u => !assignedUnitIds.has(u.id));

  // Assign a single unit to a slot
  const assignUnit = (slotId, unitId) => {
    setPendingAssignments(prev => ({
      ...prev,
      [slotId]: unitId || null
    }));
    setEditingSlotId(null);
  };

  // Random draw: shuffle available units into empty slots
  const handleRandomDraw = () => {
    const emptySlotIds = slots
      .filter(s => !pendingAssignments[s.id])
      .map(s => s.id);

    if (emptySlotIds.length === 0) {
      showMsg('No empty slots to fill');
      return;
    }

    // Get available unassigned units
    const available = [...availableUnits];
    if (available.length === 0) {
      showMsg('No available teams to assign');
      return;
    }

    // Fisher-Yates shuffle
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const newAssignments = { ...pendingAssignments };
    const slotsToFill = emptySlotIds.slice(0, available.length);
    slotsToFill.forEach((slotId, idx) => {
      newAssignments[slotId] = available[idx].id;
    });

    setPendingAssignments(newAssignments);
    showMsg(`Randomly assigned ${slotsToFill.length} team(s)`);
  };

  // Clear all assignments
  const handleClearAll = () => {
    const cleared = {};
    slots.forEach(s => { cleared[s.id] = null; });
    setPendingAssignments(cleared);
    showMsg('All assignments cleared');
  };

  // Save all assignments via API
  const handleSave = async () => {
    try {
      setSaving(true);

      // Build assignment list from pending
      const assignments = slots.map(s => ({
        slotNumber: s.slotNumber,
        unitId: pendingAssignments[s.id] || null
      }));

      // TODO: Check for a proper bulk slot assignment endpoint.
      // Currently using assignUnitNumbersWithDrawing as a workaround if available,
      // or falling back to manual exit slot assignment one at a time.
      // The ideal API: PUT /api/divisionphases/{phaseId}/slots/assign-units
      let savedCount = 0;
      for (const assignment of assignments) {
        try {
          await tournamentApi.manualExitSlotAssignment(
            phaseId,
            assignment.slotNumber,
            assignment.unitId,
            'Assigned via Team Drawing'
          );
          savedCount++;
        } catch (err) {
          console.warn(`Failed to save slot ${assignment.slotNumber}:`, err);
        }
      }

      showMsg(`Saved ${savedCount}/${assignments.length} slot assignments`);
      onAssignmentChange?.();
      await loadData(); // Refresh from server
    } catch (err) {
      showMsg('Failed to save assignments', true);
    } finally {
      setSaving(false);
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = slots.some(s => {
    const current = s.unitId || null;
    const pending = pendingAssignments[s.id] || null;
    return current !== pending;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-400">Loading team drawing...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
        {error}
        <button onClick={loadData} className="ml-2 text-red-200 underline">Retry</button>
      </div>
    );
  }

  if (!phase || slots.length === 0) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg text-gray-500 text-center border border-gray-700">
        <Grid3X3 className="w-8 h-8 mx-auto mb-2 text-gray-600" />
        <p>No incoming slots found for this phase</p>
        <p className="text-sm text-gray-600 mt-1">Generate a schedule first or check phase configuration</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-blue-400" />
            Team Drawing
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {phase.name} · {slots.length} slots · {units.length} teams available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-blue-400 rounded-lg hover:bg-gray-700"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
          message.isError ? 'bg-red-900/50 text-red-300 border border-red-700' : 'bg-green-900/50 text-green-300 border border-green-700'
        }`}>
          {message.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Action Bar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 bg-gray-800/50 p-3 rounded-lg border border-gray-700">
          <button
            onClick={handleRandomDraw}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
          >
            <Shuffle className="w-4 h-4" /> Random Draw
          </button>

          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg flex items-center gap-2 border border-gray-600"
          >
            <Trash2 className="w-4 h-4" /> Clear All
          </button>

          {hasUnsavedChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Assignments
            </button>
          )}

          <div className="ml-auto text-xs text-gray-500">
            {assignedUnitIds.size} of {slots.length} slots filled
            {availableUnits.length > 0 && ` · ${availableUnits.length} teams unassigned`}
          </div>
        </div>
      )}

      {/* Slot Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {slots.map(slot => {
          const assignedUnitId = pendingAssignments[slot.id] || null;
          const assignedUnit = assignedUnitId ? units.find(u => u.id === assignedUnitId) : null;
          const isEditing = editingSlotId === slot.id;
          const isChanged = (slot.unitId || null) !== (assignedUnitId || null);

          return (
            <div
              key={slot.id}
              className={`rounded-lg border p-3 transition-colors ${
                assignedUnit
                  ? isChanged
                    ? 'bg-yellow-900/20 border-yellow-700'
                    : 'bg-green-900/20 border-green-800'
                  : 'bg-gray-800 border-gray-700 border-dashed'
              }`}
            >
              {/* Slot Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 flex items-center justify-center bg-gray-700 text-gray-300 text-sm font-bold rounded">
                    {slot.slotNumber}
                  </span>
                  <span className="text-xs text-gray-500">
                    {slot.placeholderLabel || `Slot ${slot.slotNumber}`}
                  </span>
                </div>
                {isChanged && (
                  <span className="text-xs text-yellow-400">unsaved</span>
                )}
              </div>

              {/* Assignment Display / Editor */}
              {isEditing && !readOnly ? (
                <div className="space-y-2">
                  <select
                    value={assignedUnitId || ''}
                    onChange={e => assignUnit(slot.id, e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
                    autoFocus
                  >
                    <option value="">-- Empty --</option>
                    {/* Show currently assigned unit at the top */}
                    {assignedUnit && (
                      <option value={assignedUnit.id}>
                        ✓ {assignedUnit.name || `Team #${assignedUnit.unitNumber}`}
                      </option>
                    )}
                    {availableUnits
                      .filter(u => u.id !== assignedUnitId) // Don't duplicate
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name || `Team #${u.unitNumber}`}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => setEditingSlotId(null)}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-2 p-2 rounded ${
                    assignedUnit ? 'bg-gray-700/30' : 'bg-gray-700/10'
                  } ${!readOnly ? 'cursor-pointer hover:bg-gray-700/50' : ''}`}
                  onClick={() => { if (!readOnly) setEditingSlotId(slot.id); }}
                >
                  {assignedUnit ? (
                    <>
                      <Users className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-200 truncate">
                          {assignedUnit.name || `Team #${assignedUnit.unitNumber}`}
                        </div>
                        {assignedUnit.unitNumber && (
                          <div className="text-xs text-gray-500">#{assignedUnit.unitNumber}</div>
                        )}
                      </div>
                      {!readOnly && (
                        <button
                          onClick={(e) => { e.stopPropagation(); assignUnit(slot.id, null); }}
                          className="p-1 text-gray-600 hover:text-red-400 rounded"
                          title="Remove assignment"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-gray-500 italic flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {!readOnly ? 'Click to assign team...' : 'Empty'}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Available Teams Summary */}
      {availableUnits.length > 0 && !readOnly && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Unassigned Teams ({availableUnits.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {availableUnits.map(u => (
              <span
                key={u.id}
                className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded border border-gray-600"
              >
                {u.name || `Team #${u.unitNumber}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* All assigned message */}
      {availableUnits.length === 0 && assignedUnitIds.size === slots.length && (
        <div className="text-center py-3 text-sm text-green-400 flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" />
          All slots are filled!
        </div>
      )}
    </div>
  );
}
