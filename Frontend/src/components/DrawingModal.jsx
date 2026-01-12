import { useState, useEffect } from 'react';
import { X, Shuffle, Users, Check, Play, AlertCircle, Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function DrawingModal({
  isOpen,
  onClose,
  division,
  units = [],
  schedule = null,
  onDraw,
  isDrawing = false
}) {
  const [drawingComplete, setDrawingComplete] = useState(false);
  const [drawnAssignments, setDrawnAssignments] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [animatingIndex, setAnimatingIndex] = useState(-1);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDrawingComplete(false);
      setDrawnAssignments([]);
      setShowPreview(false);
      setAnimatingIndex(-1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Get registered units that need to be assigned
  const registeredUnits = units.filter(u => u.status !== 'Cancelled' && u.status !== 'Waitlisted');

  // Get total slots from schedule (target units)
  const totalSlots = schedule?.rounds?.reduce((max, round) => {
    const matchNumbers = round.matches?.flatMap(m => [m.unit1Number, m.unit2Number]).filter(Boolean) || [];
    return Math.max(max, ...matchNumbers, 0);
  }, 0) || 0;

  const emptySlots = totalSlots - registeredUnits.length;

  // Check if units are already assigned
  const alreadyAssigned = registeredUnits.some(u => u.unitNumber != null);

  const handleStartDraw = async () => {
    // Animate the draw
    setAnimatingIndex(0);

    // Create shuffled assignments
    const slots = Array.from({ length: totalSlots }, (_, i) => i + 1);
    const shuffledSlots = [...slots].sort(() => Math.random() - 0.5);

    // Assign registered units to random slots
    const assignments = registeredUnits.map((unit, idx) => ({
      unit,
      assignedNumber: shuffledSlots[idx]
    }));

    // Sort by assigned number for display
    assignments.sort((a, b) => a.assignedNumber - b.assignedNumber);

    // Animate each assignment
    for (let i = 0; i < assignments.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setAnimatingIndex(i);
      setDrawnAssignments(assignments.slice(0, i + 1));
    }

    setAnimatingIndex(-1);
    setDrawingComplete(true);
  };

  const handleConfirmDraw = async () => {
    // Call the backend to save assignments
    const assignments = drawnAssignments.map(a => ({
      unitId: a.unit.id,
      unitNumber: a.assignedNumber
    }));

    await onDraw(assignments);
  };

  // Get matches that would be byes (opponent slot is empty)
  const getByeMatches = () => {
    if (!schedule?.rounds) return [];
    const assignedSlots = new Set(drawnAssignments.map(a => a.assignedNumber));
    const byes = [];

    schedule.rounds.forEach(round => {
      round.matches?.forEach(match => {
        const slot1Assigned = assignedSlots.has(match.unit1Number);
        const slot2Assigned = assignedSlots.has(match.unit2Number);

        if (slot1Assigned && !slot2Assigned) {
          const unit = drawnAssignments.find(a => a.assignedNumber === match.unit1Number)?.unit;
          if (unit) byes.push({ unit, byeSlot: match.unit2Number, round: round.roundName || `Round ${round.roundNumber}` });
        } else if (!slot1Assigned && slot2Assigned) {
          const unit = drawnAssignments.find(a => a.assignedNumber === match.unit2Number)?.unit;
          if (unit) byes.push({ unit, byeSlot: match.unit1Number, round: round.roundName || `Round ${round.roundNumber}` });
        }
      });
    });

    return byes;
  };

  const byeMatches = drawingComplete ? getByeMatches() : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold">Unit Drawing</h2>
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
            <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
              <span>{registeredUnits.length} registered units</span>
              <span>•</span>
              <span>{totalSlots} total slots</span>
              {emptySlots > 0 && (
                <>
                  <span>•</span>
                  <span className="text-yellow-600">{emptySlots} byes</span>
                </>
              )}
            </div>
          </div>

          {/* Already assigned warning */}
          {alreadyAssigned && !drawingComplete && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">Units Already Assigned</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Some units already have assigned numbers. Running a new draw will
                    reassign all units to new random positions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pre-draw state */}
          {!drawingComplete && drawnAssignments.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shuffle className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Draw</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Click the button below to randomly assign {registeredUnits.length} registered
                units to {totalSlots} slots in the schedule.
                {emptySlots > 0 && ` ${emptySlots} slot${emptySlots !== 1 ? 's' : ''} will remain empty (byes).`}
              </p>
              <button
                onClick={handleStartDraw}
                disabled={isDrawing || registeredUnits.length === 0}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Start Drawing
              </button>
            </div>
          )}

          {/* Drawing in progress */}
          {drawnAssignments.length > 0 && !drawingComplete && (
            <div className="text-center py-4">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-2" />
              <p className="text-gray-600">Drawing in progress...</p>
            </div>
          )}

          {/* Drawing results */}
          {drawnAssignments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">
                  {drawingComplete ? 'Drawing Results' : 'Assigning...'}
                </h3>
                {drawingComplete && (
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showPreview ? 'Hide' : 'Show'} Schedule Preview
                  </button>
                )}
              </div>

              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {/* Show all slots, including empty ones */}
                {Array.from({ length: totalSlots }, (_, i) => i + 1).map(slotNum => {
                  const assignment = drawnAssignments.find(a => a.assignedNumber === slotNum);
                  const isAnimating = animatingIndex >= 0 && assignment &&
                    drawnAssignments.findIndex(a => a.assignedNumber === slotNum) === animatingIndex;

                  return (
                    <div
                      key={slotNum}
                      className={`flex items-center justify-between p-3 transition-all ${
                        isAnimating ? 'bg-orange-100' :
                        assignment ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          assignment ? 'bg-orange-600 text-white' : 'bg-gray-300 text-gray-500'
                        }`}>
                          {slotNum}
                        </div>
                        {assignment ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {assignment.unit.name || `Unit ${assignment.unit.id}`}
                            </div>
                            <div className="text-sm text-gray-500">
                              {assignment.unit.members?.map(m =>
                                m.lastName && m.firstName ? `${m.lastName}, ${m.firstName}` : (m.lastName || m.firstName || 'Player')
                              ).join(' & ') || 'No members'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-400 italic">Empty slot (bye)</div>
                        )}
                      </div>
                      {isAnimating && (
                        <div className="text-orange-600">
                          <Check className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bye information */}
          {drawingComplete && byeMatches.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                First Round Byes ({byeMatches.length})
              </h4>
              <div className="space-y-1 text-sm text-yellow-700">
                {byeMatches.slice(0, 5).map((bye, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-medium">{bye.unit.name}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span>advances automatically in {bye.round}</span>
                  </div>
                ))}
                {byeMatches.length > 5 && (
                  <div className="text-yellow-600 mt-1">
                    ... and {byeMatches.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Schedule preview */}
          {showPreview && drawingComplete && schedule?.rounds && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700 border-b">
                Schedule Preview (After Drawing)
              </div>
              <div className="divide-y max-h-64 overflow-y-auto">
                {schedule.rounds.slice(0, 2).map((round, roundIdx) => (
                  <div key={roundIdx} className="p-3">
                    <div className="text-sm font-medium text-gray-600 mb-2">
                      {round.roundName || `Round ${round.roundNumber}`}
                    </div>
                    <div className="space-y-2">
                      {round.matches?.slice(0, 4).map((match, matchIdx) => {
                        const unit1 = drawnAssignments.find(a => a.assignedNumber === match.unit1Number)?.unit;
                        const unit2 = drawnAssignments.find(a => a.assignedNumber === match.unit2Number)?.unit;

                        return (
                          <div key={matchIdx} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                            <span className={unit1 ? 'font-medium' : 'text-gray-400 italic'}>
                              {unit1 ? (unit1.name || `Unit ${unit1.id}`) : 'BYE'}
                            </span>
                            <span className="text-gray-400">vs</span>
                            <span className={unit2 ? 'font-medium' : 'text-gray-400 italic'}>
                              {unit2 ? (unit2.name || `Unit ${unit2.id}`) : 'BYE'}
                            </span>
                          </div>
                        );
                      })}
                      {(round.matches?.length || 0) > 4 && (
                        <div className="text-center text-sm text-gray-500">
                          ... and {round.matches.length - 4} more matches
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t bg-gray-50">
          {drawingComplete ? (
            <>
              <button
                onClick={handleConfirmDraw}
                disabled={isDrawing}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isDrawing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm & Save
                  </>
                )}
              </button>
              <button
                onClick={handleStartDraw}
                disabled={isDrawing}
                className="px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Shuffle className="w-4 h-4" />
                Re-Draw
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
