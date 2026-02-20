import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Loader2, GripVertical, Clock, AlertTriangle, CheckCircle, Filter,
  ZoomIn, ZoomOut, Maximize2, ChevronDown, Info, Move, Layers
} from 'lucide-react';

// Division color palette
const DIVISION_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', dragBg: 'bg-blue-200', hex: '#3b82f6', light: '#dbeafe', ring: 'ring-blue-400' },
  { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800', dragBg: 'bg-emerald-200', hex: '#10b981', light: '#d1fae5', ring: 'ring-emerald-400' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', dragBg: 'bg-purple-200', hex: '#8b5cf6', light: '#ede9fe', ring: 'ring-purple-400' },
  { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', dragBg: 'bg-amber-200', hex: '#f59e0b', light: '#fef3c7', ring: 'ring-amber-400' },
  { bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-800', dragBg: 'bg-rose-200', hex: '#f43f5e', light: '#ffe4e6', ring: 'ring-rose-400' },
  { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-800', dragBg: 'bg-cyan-200', hex: '#06b6d4', light: '#cffafe', ring: 'ring-cyan-400' },
  { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800', dragBg: 'bg-orange-200', hex: '#f97316', light: '#ffedd5', ring: 'ring-orange-400' },
  { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-800', dragBg: 'bg-indigo-200', hex: '#6366f1', light: '#e0e7ff', ring: 'ring-indigo-400' },
];

function getDivisionColor(index) {
  return DIVISION_COLORS[index % DIVISION_COLORS.length];
}

function formatTimeShort(date) {
  if (!date) return '';
  const d = new Date(date);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'p' : 'a';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2, '0')}${ampm}`;
}

function formatTimeFull(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  return new Date(timeStr);
}

export default function ScheduleGridInline({
  gridData,
  loading,
  onMoveEncounter,
  onRefresh,
}) {
  const [timeIncrement, setTimeIncrement] = useState(30);
  const [filterDivisionId, setFilterDivisionId] = useState(null);
  const [selectedEncounterIds, setSelectedEncounterIds] = useState(new Set());
  const [draggingEncounterId, setDraggingEncounterId] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null); // { courtId, slotTime }
  const [movingIds, setMovingIds] = useState(new Set()); // encounters currently being moved (API in progress)
  const [tooltip, setTooltip] = useState(null); // { enc, x, y }
  const gridRef = useRef(null);
  const tooltipRef = useRef(null);

  // Division color map
  const divisionColorMap = useMemo(() => {
    const map = {};
    gridData?.divisions?.forEach((div, idx) => {
      map[div.id] = getDivisionColor(idx);
    });
    return map;
  }, [gridData?.divisions]);

  // Generate time slots
  const timeSlots = useMemo(() => {
    if (!gridData) return [];
    const slots = [];
    const start = new Date(gridData.gridStartTime);
    const end = new Date(gridData.gridEndTime);
    const current = new Date(start);
    while (current < end) {
      slots.push(new Date(current));
      current.setMinutes(current.getMinutes() + timeIncrement);
    }
    return slots;
  }, [gridData, timeIncrement]);

  // Row height in pixels per time increment
  const ROW_HEIGHT = 36; // Reduced from 48 to fit more matches
  const HEADER_HEIGHT = 44;
  const TIME_COL_WIDTH = 64;

  // Encounters mapped by court
  const encountersByCourt = useMemo(() => {
    if (!gridData) return {};
    const map = {};
    gridData.encounters
      .filter(e => e.courtId && e.startTime)
      .filter(e => !filterDivisionId || e.divisionId === filterDivisionId)
      .forEach(enc => {
        if (!map[enc.courtId]) map[enc.courtId] = [];
        map[enc.courtId].push(enc);
      });
    return map;
  }, [gridData, filterDivisionId]);

  // Unscheduled encounters
  const unscheduledEncounters = useMemo(() => {
    if (!gridData) return [];
    return gridData.encounters
      .filter(e => !e.courtId || !e.startTime)
      .filter(e => !filterDivisionId || e.divisionId === filterDivisionId);
  }, [gridData, filterDivisionId]);

  // Detect conflicts (overlapping encounters on same court)
  const conflictEncounterIds = useMemo(() => {
    if (!gridData) return new Set();
    const ids = new Set();
    const courts = gridData.courts || [];
    for (const court of courts) {
      const courtEncs = (encountersByCourt[court.id] || [])
        .filter(e => e.startTime && e.endTime)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      for (let i = 0; i < courtEncs.length - 1; i++) {
        const currentEnd = new Date(courtEncs[i].endTime);
        const nextStart = new Date(courtEncs[i + 1].startTime);
        if (currentEnd > nextStart) {
          ids.add(courtEncs[i].id);
          ids.add(courtEncs[i + 1].id);
        }
      }
    }
    return ids;
  }, [encountersByCourt, gridData]);

  // Calculate pixel position and height for an encounter
  const getEncounterPosition = useCallback((enc) => {
    if (!gridData || !enc.startTime || timeSlots.length === 0) return null;
    const gridStart = new Date(gridData.gridStartTime);
    const encStart = new Date(enc.startTime);
    const encEnd = enc.endTime ? new Date(enc.endTime) : new Date(encStart.getTime() + (enc.durationMinutes || 20) * 60000);

    const startMinutes = (encStart - gridStart) / 60000;
    const durationMinutes = (encEnd - encStart) / 60000;

    const top = (startMinutes / timeIncrement) * ROW_HEIGHT;
    const height = Math.max((durationMinutes / timeIncrement) * ROW_HEIGHT, 18); // min 18px (reduced from 24)

    return { top, height };
  }, [gridData, timeIncrement, timeSlots]);

  // Selection handlers
  const handleEncounterClick = (enc, e) => {
    e.stopPropagation();
    if (e.shiftKey) {
      // Multi-select
      setSelectedEncounterIds(prev => {
        const next = new Set(prev);
        if (next.has(enc.id)) {
          next.delete(enc.id);
        } else {
          next.add(enc.id);
        }
        return next;
      });
    } else {
      // Single select / deselect
      setSelectedEncounterIds(prev => {
        if (prev.has(enc.id) && prev.size === 1) return new Set();
        return new Set([enc.id]);
      });
    }
  };

  const selectDivisionBlock = (divisionId) => {
    if (!gridData) return;
    const ids = gridData.encounters
      .filter(e => e.divisionId === divisionId && e.courtId && e.startTime)
      .map(e => e.id);
    setSelectedEncounterIds(new Set(ids));
  };

  const clearSelection = () => setSelectedEncounterIds(new Set());

  // ======== DRAG AND DROP ========

  const dragDataRef = useRef(null);

  const handleDragStart = (enc, e) => {
    // If this encounter is part of selection, drag all selected; else drag just this one
    const idsToMove = selectedEncounterIds.has(enc.id) && selectedEncounterIds.size > 1
      ? [...selectedEncounterIds]
      : [enc.id];

    // Record all encounters' positions for offset calculation
    const encountersToMove = idsToMove.map(id =>
      gridData.encounters.find(e2 => e2.id === id)
    ).filter(Boolean);

    const primaryEnc = encountersToMove.find(e2 => e2.id === enc.id) || encountersToMove[0];
    const primaryStart = primaryEnc.startTime ? new Date(primaryEnc.startTime) : null;
    const primaryCourtId = primaryEnc.courtId;

    dragDataRef.current = {
      primaryEncId: enc.id,
      encounterIds: idsToMove,
      encounters: encountersToMove,
      primaryStartTime: primaryStart,
      primaryCourtId,
    };

    setDraggingEncounterId(enc.id);

    // Set drag image / data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ encounterIds: idsToMove }));

    // Create a custom drag image
    const dragEl = document.createElement('div');
    dragEl.className = 'px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-lg';
    dragEl.textContent = idsToMove.length > 1 ? `Moving ${idsToMove.length} matches` : `${enc.unit1Name || 'TBD'} vs ${enc.unit2Name || 'TBD'}`;
    dragEl.style.position = 'absolute';
    dragEl.style.top = '-1000px';
    document.body.appendChild(dragEl);
    e.dataTransfer.setDragImage(dragEl, 0, 0);
    setTimeout(() => document.body.removeChild(dragEl), 0);
  };

  const handleDragOver = (courtId, slotTime, e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot({ courtId, slotTime: slotTime.toISOString() });
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = async (courtId, slotTime, e) => {
    e.preventDefault();
    setDragOverSlot(null);
    setDraggingEncounterId(null);

    const dragData = dragDataRef.current;
    if (!dragData) return;

    const newSlotTime = new Date(slotTime);

    // Calculate delta from the primary encounter
    const primaryStart = dragData.primaryStartTime;
    const primaryCourtId = dragData.primaryCourtId;

    // For multi-select, calculate time offset
    const timeDeltaMs = primaryStart ? (newSlotTime - primaryStart) : 0;

    // Build move requests
    const moveRequests = dragData.encounters.map(enc => {
      let targetCourtId = courtId;
      let targetStartTime = newSlotTime;

      if (dragData.encounterIds.length > 1 && enc.id !== dragData.primaryEncId) {
        // Apply relative offset
        const encStart = enc.startTime ? new Date(enc.startTime) : newSlotTime;
        targetStartTime = new Date(encStart.getTime() + timeDeltaMs);

        // Keep same court offset if moving within the same court layout
        if (enc.courtId === primaryCourtId) {
          targetCourtId = courtId;
        } else {
          // Preserve relative court positions by finding the court index offset
          const courts = gridData.courts || [];
          const primaryCourtIdx = courts.findIndex(c => c.id === primaryCourtId);
          const encCourtIdx = courts.findIndex(c => c.id === enc.courtId);
          const newPrimaryCourtIdx = courts.findIndex(c => c.id === courtId);
          const courtOffset = encCourtIdx - primaryCourtIdx;
          const newCourtIdx = newPrimaryCourtIdx + courtOffset;
          targetCourtId = newCourtIdx >= 0 && newCourtIdx < courts.length
            ? courts[newCourtIdx].id
            : courtId;
        }
      }

      return {
        encounterId: enc.id,
        courtId: targetCourtId,
        startTime: targetStartTime.toISOString(),
      };
    });

    // Execute moves
    const movingSet = new Set(moveRequests.map(r => r.encounterId));
    setMovingIds(movingSet);

    try {
      for (const req of moveRequests) {
        if (onMoveEncounter) {
          await onMoveEncounter(req.encounterId, {
            courtId: req.courtId,
            startTime: req.startTime,
          });
        }
      }
    } finally {
      setMovingIds(new Set());
      setSelectedEncounterIds(new Set());
      dragDataRef.current = null;
      if (onRefresh) onRefresh();
    }
  };

  // Handle drop from unscheduled panel
  const handleUnscheduledDragStart = (enc, e) => {
    dragDataRef.current = {
      primaryEncId: enc.id,
      encounterIds: [enc.id],
      encounters: [enc],
      primaryStartTime: null,
      primaryCourtId: null,
    };
    setDraggingEncounterId(enc.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ encounterIds: [enc.id] }));

    const dragEl = document.createElement('div');
    dragEl.className = 'px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-lg';
    dragEl.textContent = `${enc.unit1Name || 'TBD'} vs ${enc.unit2Name || 'TBD'}`;
    dragEl.style.position = 'absolute';
    dragEl.style.top = '-1000px';
    document.body.appendChild(dragEl);
    e.dataTransfer.setDragImage(dragEl, 0, 0);
    setTimeout(() => document.body.removeChild(dragEl), 0);
  };

  const handleDragEnd = () => {
    setDraggingEncounterId(null);
    setDragOverSlot(null);
  };

  // Tooltip
  const showTooltip = (enc, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      enc,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const hideTooltip = () => setTooltip(null);

  // Ghost preview for multi-select drag
  const ghostPreview = useMemo(() => {
    if (!dragOverSlot || !dragDataRef.current || dragDataRef.current.encounterIds.length <= 1) return [];
    const dragData = dragDataRef.current;
    const newSlotTime = new Date(dragOverSlot.slotTime);
    const timeDeltaMs = dragData.primaryStartTime ? (newSlotTime - dragData.primaryStartTime) : 0;
    const courts = gridData?.courts || [];

    return dragData.encounters
      .filter(enc => enc.id !== dragData.primaryEncId)
      .map(enc => {
        const encStart = enc.startTime ? new Date(enc.startTime) : newSlotTime;
        const targetStartTime = new Date(encStart.getTime() + timeDeltaMs);

        let targetCourtId = dragOverSlot.courtId;
        if (enc.courtId !== dragData.primaryCourtId) {
          const primaryCourtIdx = courts.findIndex(c => c.id === dragData.primaryCourtId);
          const encCourtIdx = courts.findIndex(c => c.id === enc.courtId);
          const newPrimaryCourtIdx = courts.findIndex(c => c.id === dragOverSlot.courtId);
          const courtOffset = encCourtIdx - primaryCourtIdx;
          const newCourtIdx = newPrimaryCourtIdx + courtOffset;
          targetCourtId = newCourtIdx >= 0 && newCourtIdx < courts.length
            ? courts[newCourtIdx].id
            : dragOverSlot.courtId;
        }

        return { ...enc, ghostCourtId: targetCourtId, ghostStartTime: targetStartTime };
      });
  }, [dragOverSlot, gridData]);

  if (!gridData) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading schedule grid...
          </div>
        ) : (
          'No grid data loaded.'
        )}
      </div>
    );
  }

  const courts = gridData.courts || [];

  if (courts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No courts configured. Add courts in the Courts tab first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Grid Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Division filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterDivisionId || ''}
            onChange={(e) => setFilterDivisionId(e.target.value ? parseInt(e.target.value) : null)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Divisions</option>
            {(gridData.divisions || []).map(div => (
              <option key={div.id} value={div.id}>{div.name}</option>
            ))}
          </select>
        </div>

        {/* Time increment */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-gray-400" />
          <select
            value={timeIncrement}
            onChange={(e) => setTimeIncrement(parseInt(e.target.value))}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>

        {/* Selection info */}
        {selectedEncounterIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <span className="text-blue-700 font-medium">{selectedEncounterIds.size} selected</span>
            <button
              onClick={clearSelection}
              className="text-blue-500 hover:text-blue-700 underline text-xs"
            >
              Clear
            </button>
          </div>
        )}

        {/* Select division block buttons */}
        {(gridData.divisions || []).length > 1 && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-gray-400 mr-1">Select block:</span>
            {(gridData.divisions || []).map((div, idx) => {
              const color = getDivisionColor(idx);
              return (
                <button
                  key={div.id}
                  onClick={() => selectDivisionBlock(div.id)}
                  className={`px-2 py-1 text-xs rounded ${color.bg} ${color.text} ${color.border} border hover:opacity-80`}
                  title={`Select all ${div.name} encounters`}
                >
                  {div.name.split(' ').map(w => w[0]).join('')}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 ml-auto">
          {(gridData.divisions || []).map((div, idx) => {
            const color = getDivisionColor(idx);
            return (
              <div key={div.id} className="flex items-center gap-1 text-xs">
                <span className={`w-3 h-3 rounded ${color.bg} ${color.border} border`} />
                <span className="text-gray-600 hidden sm:inline">{div.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
          {gridData.scheduledEncounters || 0} scheduled
        </span>
        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
          {gridData.unscheduledEncounters || 0} unscheduled
        </span>
        {conflictEncounterIds.size > 0 && (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {conflictEncounterIds.size} conflicts
          </span>
        )}
      </div>

      {/* ===== SCHEDULE GRID ===== */}
      <div
        ref={gridRef}
        className="border rounded-lg overflow-auto bg-white relative"
        style={{ maxHeight: '70vh' }}
      >
        {/* Grid header (sticky) */}
        <div
          className="sticky top-0 z-20 bg-gray-50 border-b flex"
          style={{ minWidth: `${TIME_COL_WIDTH + courts.length * 140}px` }}
        >
          {/* Time column header */}
          <div
            className="sticky left-0 z-30 bg-gray-50 border-r flex items-center justify-center text-xs font-medium text-gray-500"
            style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH, height: HEADER_HEIGHT }}
          >
            Time
          </div>
          {/* Court headers */}
          {courts.map(court => (
            <div
              key={court.id}
              className="flex items-center justify-center text-xs font-medium text-gray-700 border-r"
              style={{ width: 140, minWidth: 140, height: HEADER_HEIGHT }}
            >
              {court.label || `Court ${court.id}`}
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div
          className="relative"
          style={{
            height: timeSlots.length * ROW_HEIGHT,
            minWidth: `${TIME_COL_WIDTH + courts.length * 140}px`,
          }}
        >
          {/* Time labels + row lines */}
          {timeSlots.map((slot, idx) => (
            <div
              key={idx}
              className="absolute left-0 flex border-b border-gray-100"
              style={{
                top: idx * ROW_HEIGHT,
                height: ROW_HEIGHT,
                width: '100%',
              }}
            >
              {/* Time label */}
              <div
                className="sticky left-0 z-10 bg-white border-r text-xs text-gray-500 flex items-start justify-end pr-2 pt-1"
                style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
              >
                {formatTimeShort(slot)}
              </div>

              {/* Court drop zones */}
              {courts.map(court => {
                const isDropTarget = dragOverSlot?.courtId === court.id &&
                  dragOverSlot?.slotTime === slot.toISOString();
                const isGhostTarget = ghostPreview.some(g =>
                  g.ghostCourtId === court.id &&
                  Math.abs(new Date(g.ghostStartTime) - slot) < timeIncrement * 60000 / 2
                );

                return (
                  <div
                    key={court.id}
                    className={`border-r border-gray-50 transition-colors ${
                      isDropTarget
                        ? 'bg-blue-50 border-blue-200'
                        : isGhostTarget
                          ? 'bg-blue-50/50'
                          : draggingEncounterId
                            ? 'hover:bg-gray-50'
                            : ''
                    }`}
                    style={{ width: 140, minWidth: 140, height: ROW_HEIGHT }}
                    onDragOver={(e) => handleDragOver(court.id, slot, e)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(court.id, slot, e)}
                  />
                );
              })}
            </div>
          ))}

          {/* Encounter blocks (positioned absolutely) */}
          {courts.map((court, courtIdx) => {
            const courtEncs = encountersByCourt[court.id] || [];
            return courtEncs.map(enc => {
              const pos = getEncounterPosition(enc);
              if (!pos) return null;

              const color = divisionColorMap[enc.divisionId] || DIVISION_COLORS[0];
              const isSelected = selectedEncounterIds.has(enc.id);
              const isConflict = conflictEncounterIds.has(enc.id);
              const isMoving = movingIds.has(enc.id);
              const isDragging = draggingEncounterId === enc.id;

              return (
                <div
                  key={enc.id}
                  draggable={!isMoving}
                  onDragStart={(e) => handleDragStart(enc, e)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => handleEncounterClick(enc, e)}
                  onMouseEnter={(e) => showTooltip(enc, e)}
                  onMouseLeave={hideTooltip}
                  className={`absolute rounded-md border cursor-grab active:cursor-grabbing transition-all overflow-hidden
                    ${color.bg} ${color.border} ${color.text}
                    ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''}
                    ${isConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''}
                    ${isDragging ? 'opacity-40' : ''}
                    ${isMoving ? 'opacity-60 animate-pulse' : ''}
                    hover:shadow-md hover:z-10
                  `}
                  style={{
                    top: pos.top,
                    height: pos.height,
                    left: TIME_COL_WIDTH + courtIdx * 140 + 4,
                    width: 132,
                  }}
                  title=""
                >
                  <div className="px-1 py-0.5 h-full flex flex-col justify-center text-[10px] leading-tight">
                    <div className="font-semibold truncate">
                      {enc.unit1Name?.split(' ').slice(0, 2).join(' ') || 'TBD'}
                    </div>
                    <div className="font-semibold truncate">
                      vs {enc.unit2Name?.split(' ').slice(0, 2).join(' ') || 'TBD'}
                    </div>
                    {pos.height > 30 && (
                      <div className="text-[9px] opacity-70 truncate">
                        {formatTimeShort(enc.startTime)}–{formatTimeShort(enc.endTime)}
                        {enc.phaseName && ` • ${enc.phaseName}`}
                      </div>
                    )}
                  </div>
                  {isMoving && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>
              );
            });
          })}

          {/* Ghost previews for multi-select drag */}
          {ghostPreview.map(ghost => {
            const courtIdx = courts.findIndex(c => c.id === ghost.ghostCourtId);
            if (courtIdx < 0 || !gridData) return null;
            const gridStart = new Date(gridData.gridStartTime);
            const ghostStart = new Date(ghost.ghostStartTime);
            const startMin = (ghostStart - gridStart) / 60000;
            const duration = ghost.durationMinutes || 20;
            const top = (startMin / timeIncrement) * ROW_HEIGHT;
            const height = Math.max((duration / timeIncrement) * ROW_HEIGHT, 18);

            return (
              <div
                key={`ghost-${ghost.id}`}
                className="absolute rounded-md border-2 border-dashed border-blue-400 bg-blue-100/50 pointer-events-none"
                style={{
                  top,
                  height,
                  left: TIME_COL_WIDTH + courtIdx * 140 + 4,
                  width: 132,
                }}
              >
                <div className="px-1.5 py-1 text-[10px] text-blue-600 truncate">
                  {ghost.unit1Name || 'TBD'} vs {ghost.unit2Name || 'TBD'}
                </div>
              </div>
            );
          })}

          {/* Drop indicator */}
          {dragOverSlot && (() => {
            const courtIdx = courts.findIndex(c => c.id === dragOverSlot.courtId);
            const slotIdx = timeSlots.findIndex(s => s.toISOString() === dragOverSlot.slotTime);
            if (courtIdx < 0 || slotIdx < 0) return null;

            const dragEnc = dragDataRef.current?.encounters?.find(e => e.id === dragDataRef.current.primaryEncId);
            const duration = dragEnc?.durationMinutes || 20;
            const height = Math.max((duration / timeIncrement) * ROW_HEIGHT, 18);

            return (
              <div
                className="absolute rounded-md border-2 border-dashed border-blue-500 bg-blue-100/40 pointer-events-none z-5"
                style={{
                  top: slotIdx * ROW_HEIGHT,
                  height,
                  left: TIME_COL_WIDTH + courtIdx * 140 + 4,
                  width: 132,
                }}
              />
            );
          })()}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          ref={tooltipRef}
          className="fixed z-50 bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs max-w-xs pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold">{tooltip.enc.unit1Name || 'TBD'} vs {tooltip.enc.unit2Name || 'TBD'}</div>
          <div className="text-gray-300 mt-1 space-y-0.5">
            {tooltip.enc.encounterLabel && <div>Match: {tooltip.enc.encounterLabel}</div>}
            {tooltip.enc.courtLabel && <div>Court: {tooltip.enc.courtLabel}</div>}
            {tooltip.enc.startTime && (
              <div>Time: {formatTimeFull(tooltip.enc.startTime)}–{formatTimeFull(tooltip.enc.endTime)}</div>
            )}
            {tooltip.enc.phaseName && <div>Phase: {tooltip.enc.phaseName}</div>}
            {tooltip.enc.divisionId && (
              <div>Division: {gridData?.divisions?.find(d => d.id === tooltip.enc.divisionId)?.name}</div>
            )}
            <div>Status: {tooltip.enc.status || 'Scheduled'}</div>
            {tooltip.enc.roundNumber && <div>Round: {tooltip.enc.roundNumber}</div>}
          </div>
        </div>
      )}

      {/* Unscheduled encounters panel */}
      {unscheduledEncounters.length > 0 && (
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-3 bg-yellow-50 border-b flex items-center justify-between">
            <h4 className="text-sm font-medium text-yellow-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Unscheduled Matches ({unscheduledEncounters.length})
            </h4>
            <span className="text-xs text-yellow-600">Drag onto the grid to schedule</span>
          </div>
          <div className="p-3 flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {unscheduledEncounters.map(enc => {
              const color = divisionColorMap[enc.divisionId] || DIVISION_COLORS[0];
              const isDragging = draggingEncounterId === enc.id;
              return (
                <div
                  key={enc.id}
                  draggable
                  onDragStart={(e) => handleUnscheduledDragStart(enc, e)}
                  onDragEnd={handleDragEnd}
                  className={`px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all
                    ${color.bg} ${color.border} ${color.text}
                    ${isDragging ? 'opacity-40' : 'hover:shadow-md'}
                  `}
                >
                  <div className="text-xs font-semibold">
                    {enc.unit1Name?.split(' ').slice(0, 2).join(' ') || 'TBD'} vs {enc.unit2Name?.split(' ').slice(0, 2).join(' ') || 'TBD'}
                  </div>
                  <div className="text-[10px] opacity-70 mt-0.5">
                    {gridData?.divisions?.find(d => d.id === enc.divisionId)?.name}
                    {enc.phaseName && ` • ${enc.phaseName}`}
                    {enc.roundNumber && ` • R${enc.roundNumber}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
