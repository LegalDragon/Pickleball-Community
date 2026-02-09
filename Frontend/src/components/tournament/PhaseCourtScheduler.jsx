import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Clock, Loader2, ChevronDown, ChevronRight, Check, X,
  GripVertical, MapPin, Calendar, AlertTriangle, Zap,
  Play, Square, Users, Filter, RotateCcw
} from 'lucide-react'
import { tournamentApi } from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

// ─── Color palette for divisions/phases ──────────────────────────────────
const COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', hex: '#3b82f6' },
  { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800', hex: '#10b981' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', hex: '#8b5cf6' },
  { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', hex: '#f59e0b' },
  { bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-800', hex: '#f43f5e' },
  { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-800', hex: '#06b6d4' },
]

// Time slot size in minutes
const SLOT_SIZE = 15
const PIXELS_PER_SLOT = 30

function formatTime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function parseTime(timeStr, baseDate) {
  // Parse "9:00 AM" format into a Date
  const [time, meridiem] = timeStr.split(' ')
  const [hours, minutes] = time.split(':').map(Number)
  let hour24 = hours
  if (meridiem === 'PM' && hours !== 12) hour24 += 12
  if (meridiem === 'AM' && hours === 12) hour24 = 0
  
  const result = new Date(baseDate)
  result.setHours(hour24, minutes, 0, 0)
  return result
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000)
}

function getSlotIndex(time, dayStart) {
  const diff = (time.getTime() - dayStart.getTime()) / 60000
  return Math.floor(diff / SLOT_SIZE)
}

// ═════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════
export default function PhaseCourtScheduler({ eventId, data, onUpdate }) {
  const toast = useToast()
  
  // Selection state
  const [selectedDivision, setSelectedDivision] = useState(null)
  const [selectedPhase, setSelectedPhase] = useState(null)
  const [selectedMatches, setSelectedMatches] = useState(new Set())
  const [expandedDivisions, setExpandedDivisions] = useState(new Set())
  
  // Scheduling state
  const [assignments, setAssignments] = useState({}) // encounterId -> { courtId, startTime }
  const [saving, setSaving] = useState(false)
  const [dayStart, setDayStart] = useState(() => {
    const d = new Date(data?.eventStartDate || new Date())
    d.setHours(8, 0, 0, 0)
    return d
  })
  const [dayEnd, setDayEnd] = useState(() => {
    const d = new Date(data?.eventStartDate || new Date())
    d.setHours(20, 0, 0, 0)
    return d
  })
  
  // Drag state
  const [dragging, setDragging] = useState(null) // { encounterId, offsetX, offsetY }
  const timelineRef = useRef(null)

  // ─── Computed Values ──────────────────────────────────
  
  // Group encounters by division and phase
  const encountersByDivPhase = useMemo(() => {
    if (!data?.encounters) return {}
    const grouped = {}
    data.encounters.forEach(enc => {
      if (enc.isBye) return
      const divKey = enc.divisionId
      const phaseKey = enc.phaseId || 'no-phase'
      if (!grouped[divKey]) grouped[divKey] = {}
      if (!grouped[divKey][phaseKey]) grouped[divKey][phaseKey] = []
      grouped[divKey][phaseKey].push(enc)
    })
    return grouped
  }, [data?.encounters])

  // Get all courts (from groups + unassigned)
  const allCourts = useMemo(() => {
    if (!data) return []
    const courts = []
    data.courtGroups?.forEach(g => {
      g.courts?.forEach(c => courts.push({ ...c, groupName: g.groupName }))
    })
    data.unassignedCourts?.forEach(c => courts.push({ ...c, groupName: 'Unassigned' }))
    return courts
  }, [data])

  // Time slots for the timeline
  const timeSlots = useMemo(() => {
    const slots = []
    let current = new Date(dayStart)
    while (current < dayEnd) {
      slots.push(new Date(current))
      current = addMinutes(current, SLOT_SIZE)
    }
    return slots
  }, [dayStart, dayEnd])

  // Division colors
  const divColors = useMemo(() => {
    const m = {}
    data?.divisions?.forEach((d, i) => { m[d.id] = COLORS[i % COLORS.length] })
    return m
  }, [data?.divisions])

  // Currently scheduled encounters (existing + pending assignments)
  const scheduledEncounters = useMemo(() => {
    if (!data?.encounters) return []
    return data.encounters
      .filter(e => !e.isBye)
      .map(e => {
        const assignment = assignments[e.id]
        return {
          ...e,
          courtId: assignment?.courtId ?? e.courtId,
          startTime: assignment?.startTime ?? e.scheduledTime ?? e.estimatedStartTime,
          duration: e.estimatedDurationMinutes || 30
        }
      })
      .filter(e => e.courtId && e.startTime)
  }, [data?.encounters, assignments])

  // Get team IDs for an encounter (for stagger logic)
  const getTeamIds = (enc) => {
    return [enc.unit1Id, enc.unit2Id].filter(Boolean)
  }

  // Check if scheduling a match at a time would violate back-to-back rule
  const wouldViolateStagger = useCallback((enc, courtId, startTime, proposedAssignments) => {
    const teams = getTeamIds(enc)
    if (teams.length === 0) return false
    
    const endTime = addMinutes(new Date(startTime), enc.estimatedDurationMinutes || 30)
    
    // Check against all scheduled encounters
    for (const other of scheduledEncounters) {
      if (other.id === enc.id) continue
      const otherTeams = getTeamIds(other)
      const hasOverlappingTeam = teams.some(t => otherTeams.includes(t))
      if (!hasOverlappingTeam) continue
      
      // Check for time overlap or back-to-back (within 5 minutes)
      const otherStart = new Date(other.startTime)
      const otherEnd = addMinutes(otherStart, other.duration)
      
      const bufferMs = 5 * 60000 // 5 minute buffer
      if (startTime < otherEnd.getTime() + bufferMs && endTime.getTime() > otherStart.getTime() - bufferMs) {
        return true
      }
    }
    
    // Also check proposed assignments
    for (const [otherId, assignment] of Object.entries(proposedAssignments)) {
      if (parseInt(otherId) === enc.id) continue
      const other = data.encounters.find(e => e.id === parseInt(otherId))
      if (!other) continue
      
      const otherTeams = getTeamIds(other)
      const hasOverlappingTeam = teams.some(t => otherTeams.includes(t))
      if (!hasOverlappingTeam) continue
      
      const otherStart = new Date(assignment.startTime)
      const otherEnd = addMinutes(otherStart, other.estimatedDurationMinutes || 30)
      
      const bufferMs = 5 * 60000
      if (startTime < otherEnd.getTime() + bufferMs && endTime.getTime() > otherStart.getTime() - bufferMs) {
        return true
      }
    }
    
    return false
  }, [scheduledEncounters, data?.encounters])

  // ─── Auto-schedule selected matches ──────────────────────────────────
  const autoScheduleSelected = useCallback((courtIds, startTime) => {
    if (selectedMatches.size === 0) {
      toast.warn('No matches selected')
      return
    }
    if (courtIds.length === 0) {
      toast.warn('No courts selected')
      return
    }

    const matchList = data.encounters.filter(e => selectedMatches.has(e.id))
    const newAssignments = { ...assignments }
    let currentTime = new Date(startTime)
    let courtIndex = 0
    
    // Sort matches to respect round-robin stagger (same pool/phase together)
    const sortedMatches = [...matchList].sort((a, b) => {
      if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber
      return a.encounterNumber - b.encounterNumber
    })

    for (const match of sortedMatches) {
      const duration = match.estimatedDurationMinutes || 30
      let scheduled = false
      let attempts = 0
      
      // Try each court, advancing time if needed
      while (!scheduled && attempts < courtIds.length * 10) {
        const courtId = courtIds[courtIndex % courtIds.length]
        
        // Check for conflicts on this court at this time
        const hasCourtConflict = scheduledEncounters.some(e => {
          if (e.courtId !== courtId) return false
          const eStart = new Date(e.startTime)
          const eEnd = addMinutes(eStart, e.duration)
          return currentTime < eEnd && addMinutes(currentTime, duration) > eStart
        }) || Object.entries(newAssignments).some(([id, a]) => {
          if (parseInt(id) === match.id) return false
          if (a.courtId !== courtId) return false
          const aStart = new Date(a.startTime)
          const other = data.encounters.find(e => e.id === parseInt(id))
          const aEnd = addMinutes(aStart, other?.estimatedDurationMinutes || 30)
          return currentTime < aEnd && addMinutes(currentTime, duration) > aStart
        })

        // Check stagger rule
        const violatesStagger = wouldViolateStagger(match, courtId, currentTime.getTime(), newAssignments)
        
        if (!hasCourtConflict && !violatesStagger) {
          newAssignments[match.id] = {
            courtId,
            startTime: currentTime.toISOString()
          }
          scheduled = true
        } else {
          // Try next court or advance time
          courtIndex++
          if (courtIndex % courtIds.length === 0) {
            currentTime = addMinutes(currentTime, SLOT_SIZE)
          }
        }
        attempts++
      }
      
      if (!scheduled) {
        toast.warn(`Could not schedule match ${match.encounterLabel || match.id}`)
      }
    }

    setAssignments(newAssignments)
    toast.success(`Scheduled ${sortedMatches.length} matches`)
  }, [selectedMatches, data?.encounters, assignments, scheduledEncounters, wouldViolateStagger, toast])

  // ─── Save assignments ──────────────────────────────────
  const saveAssignments = async () => {
    if (Object.keys(assignments).length === 0) {
      toast.warn('No changes to save')
      return
    }

    setSaving(true)
    try {
      const updates = Object.entries(assignments).map(([encounterId, { courtId, startTime }]) => ({
        encounterId: parseInt(encounterId),
        courtId,
        scheduledTime: startTime
      }))

      const response = await tournamentApi.bulkAssignCourtsAndTimes(eventId, updates)
      if (response.success) {
        toast.success('Schedule saved!')
        setAssignments({})
        onUpdate?.()
      } else {
        toast.error(response.message || 'Failed to save')
      }
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  // ─── Selection handlers ──────────────────────────────────
  const toggleDivision = (divId) => {
    setExpandedDivisions(prev => {
      const next = new Set(prev)
      if (next.has(divId)) next.delete(divId)
      else next.add(divId)
      return next
    })
  }

  const selectPhase = (divId, phaseId) => {
    setSelectedDivision(divId)
    setSelectedPhase(phaseId)
    // Auto-select all matches in this phase
    const matches = encountersByDivPhase[divId]?.[phaseId] || []
    setSelectedMatches(new Set(matches.map(m => m.id)))
  }

  const toggleMatch = (matchId) => {
    setSelectedMatches(prev => {
      const next = new Set(prev)
      if (next.has(matchId)) next.delete(matchId)
      else next.add(matchId)
      return next
    })
  }

  const clearSelection = () => {
    setSelectedMatches(new Set())
    setSelectedDivision(null)
    setSelectedPhase(null)
  }

  // ─── Render ──────────────────────────────────
  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const selectedMatchList = data.encounters?.filter(e => selectedMatches.has(e.id)) || []
  const totalDuration = selectedMatchList.reduce((sum, m) => sum + (m.estimatedDurationMinutes || 30), 0)

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[600px]">
      {/* ─── Left Panel: Phase/Match Selector ─── */}
      <div className="w-80 flex-shrink-0 bg-white rounded-xl border overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Select Matches
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Click a phase to select all its matches, or pick individually
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {data.divisions?.map(div => {
            const divEncs = encountersByDivPhase[div.id] || {}
            const phases = div.phases || []
            const noPhaseMatches = divEncs['no-phase'] || []
            const color = divColors[div.id]
            const isExpanded = expandedDivisions.has(div.id)
            
            return (
              <div key={div.id} className="mb-2">
                {/* Division header */}
                <button
                  onClick={() => toggleDivision(div.id)}
                  className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 ${color?.bg} ${color?.border} border`}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className={`font-medium ${color?.text}`}>{div.name}</span>
                  <span className="ml-auto text-xs text-gray-500">{div.encounterCount} matches</span>
                </button>
                
                {/* Phases */}
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {phases.map(phase => {
                      const phaseMatches = divEncs[phase.id] || []
                      const isSelected = selectedDivision === div.id && selectedPhase === phase.id
                      
                      return (
                        <div key={phase.id}>
                          <button
                            onClick={() => selectPhase(div.id, phase.id)}
                            className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 ${
                              isSelected ? 'bg-orange-100 border-orange-400 border' : 'hover:bg-gray-100'
                            }`}
                          >
                            <Play className="w-3 h-3 text-gray-400" />
                            <span>{phase.name}</span>
                            <span className="ml-auto text-xs text-gray-500">{phaseMatches.length}</span>
                          </button>
                          
                          {/* Individual matches when phase is selected */}
                          {isSelected && (
                            <div className="ml-4 mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                              {phaseMatches.map(match => (
                                <label
                                  key={match.id}
                                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedMatches.has(match.id)}
                                    onChange={() => toggleMatch(match.id)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="truncate">
                                    {match.unit1Name || 'TBD'} vs {match.unit2Name || 'TBD'}
                                  </span>
                                  {match.courtLabel && (
                                    <span className="ml-auto text-gray-400">Ct {match.courtLabel}</span>
                                  )}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    
                    {/* No-phase matches */}
                    {noPhaseMatches.length > 0 && (
                      <button
                        onClick={() => selectPhase(div.id, 'no-phase')}
                        className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 ${
                          selectedDivision === div.id && selectedPhase === 'no-phase' 
                            ? 'bg-orange-100 border-orange-400 border' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Square className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600">Other Matches</span>
                        <span className="ml-auto text-xs text-gray-500">{noPhaseMatches.length}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Selection summary */}
        {selectedMatches.size > 0 && (
          <div className="p-3 border-t bg-orange-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-orange-800">
                {selectedMatches.size} matches selected
              </span>
              <button onClick={clearSelection} className="text-xs text-orange-600 hover:underline">
                Clear
              </button>
            </div>
            <div className="text-xs text-orange-700">
              Est. duration: {Math.floor(totalDuration / 60)}h {totalDuration % 60}m
            </div>
          </div>
        )}
      </div>

      {/* ─── Right Panel: Court Timeline ─── */}
      <div className="flex-1 bg-white rounded-xl border overflow-hidden flex flex-col">
        {/* Header with controls */}
        <div className="p-4 border-b bg-gray-50 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Start:</label>
            <input
              type="time"
              value={`${String(dayStart.getHours()).padStart(2, '0')}:${String(dayStart.getMinutes()).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number)
                const d = new Date(dayStart)
                d.setHours(h, m, 0, 0)
                setDayStart(d)
              }}
              className="px-2 py-1 border rounded text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">End:</label>
            <input
              type="time"
              value={`${String(dayEnd.getHours()).padStart(2, '0')}:${String(dayEnd.getMinutes()).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number)
                const d = new Date(dayEnd)
                d.setHours(h, m, 0, 0)
                setDayEnd(d)
              }}
              className="px-2 py-1 border rounded text-sm"
            />
          </div>
          
          <div className="flex-1" />
          
          {Object.keys(assignments).length > 0 && (
            <>
              <button
                onClick={() => setAssignments({})}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={saveAssignments}
                disabled={saving}
                className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-1 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Changes
              </button>
            </>
          )}
        </div>

        {/* Quick schedule controls */}
        {selectedMatches.size > 0 && (
          <QuickScheduleBar
            courts={allCourts}
            selectedCount={selectedMatches.size}
            totalDuration={totalDuration}
            dayStart={dayStart}
            onSchedule={autoScheduleSelected}
          />
        )}

        {/* Timeline grid */}
        <div className="flex-1 overflow-auto" ref={timelineRef}>
          <div className="min-w-max">
            {/* Time header */}
            <div className="sticky top-0 z-10 flex bg-gray-100 border-b">
              <div className="w-24 flex-shrink-0 px-2 py-2 font-medium text-xs text-gray-500 border-r">
                Court
              </div>
              <div className="flex">
                {timeSlots.map((slot, i) => (
                  <div
                    key={i}
                    className={`flex-shrink-0 text-center text-xs py-2 border-r ${
                      slot.getMinutes() === 0 ? 'font-medium text-gray-700 bg-gray-50' : 'text-gray-400'
                    }`}
                    style={{ width: PIXELS_PER_SLOT }}
                  >
                    {slot.getMinutes() === 0 ? formatTime(slot) : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Court rows */}
            {allCourts.map(court => (
              <CourtRow
                key={court.id}
                court={court}
                timeSlots={timeSlots}
                dayStart={dayStart}
                scheduledEncounters={scheduledEncounters.filter(e => e.courtId === court.id)}
                pendingAssignments={Object.entries(assignments)
                  .filter(([_, a]) => a.courtId === court.id)
                  .map(([id, a]) => ({
                    ...data.encounters.find(e => e.id === parseInt(id)),
                    ...a
                  }))}
                divColors={divColors}
                onDropMatch={(encId, time) => {
                  const enc = data.encounters.find(e => e.id === encId)
                  if (enc && !wouldViolateStagger(enc, court.id, time.getTime(), assignments)) {
                    setAssignments(prev => ({
                      ...prev,
                      [encId]: { courtId: court.id, startTime: time.toISOString() }
                    }))
                  } else {
                    toast.warn('Would cause back-to-back conflict')
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════
// Quick Schedule Bar
// ═════════════════════════════════════════════════════
function QuickScheduleBar({ courts, selectedCount, totalDuration, dayStart, onSchedule }) {
  const [selectedCourts, setSelectedCourts] = useState(new Set())
  const [startTime, setStartTime] = useState(
    `${String(dayStart.getHours()).padStart(2, '0')}:${String(dayStart.getMinutes()).padStart(2, '0')}`
  )

  const toggleCourt = (courtId) => {
    setSelectedCourts(prev => {
      const next = new Set(prev)
      if (next.has(courtId)) next.delete(courtId)
      else next.add(courtId)
      return next
    })
  }

  const handleSchedule = () => {
    const [h, m] = startTime.split(':').map(Number)
    const time = new Date(dayStart)
    time.setHours(h, m, 0, 0)
    onSchedule(Array.from(selectedCourts), time)
  }

  return (
    <div className="px-4 py-3 border-b bg-orange-50 flex items-center gap-4 flex-wrap">
      <div className="text-sm font-medium text-orange-800">
        Schedule {selectedCount} matches ({Math.floor(totalDuration / 60)}h {totalDuration % 60}m)
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600">on courts:</span>
        <div className="flex flex-wrap gap-1">
          {courts.slice(0, 8).map(court => (
            <button
              key={court.id}
              onClick={() => toggleCourt(court.id)}
              className={`px-2 py-1 text-xs rounded ${
                selectedCourts.has(court.id)
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border text-gray-700 hover:bg-gray-50'
              }`}
            >
              {court.courtLabel}
            </button>
          ))}
          {courts.length > 8 && (
            <span className="text-xs text-gray-500">+{courts.length - 8} more</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600">starting at:</span>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="px-2 py-1 border rounded text-sm"
        />
      </div>

      <button
        onClick={handleSchedule}
        disabled={selectedCourts.size === 0}
        className="px-4 py-1.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg flex items-center gap-1 disabled:opacity-50"
      >
        <Zap className="w-4 h-4" />
        Auto-Schedule
      </button>
    </div>
  )
}

// ═════════════════════════════════════════════════════
// Court Row
// ═════════════════════════════════════════════════════
function CourtRow({ court, timeSlots, dayStart, scheduledEncounters, pendingAssignments, divColors, onDropMatch }) {
  const rowRef = useRef(null)

  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault()
    const encId = parseInt(e.dataTransfer.getData('encounterId'))
    if (!encId || !rowRef.current) return

    const rect = rowRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - 96 // account for label width
    const slotIndex = Math.floor(x / PIXELS_PER_SLOT)
    const dropTime = addMinutes(dayStart, slotIndex * SLOT_SIZE)
    
    onDropMatch(encId, dropTime)
  }

  return (
    <div
      ref={rowRef}
      className="flex border-b hover:bg-gray-50/50"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Court label */}
      <div className="w-24 flex-shrink-0 px-2 py-3 font-medium text-sm text-gray-700 border-r flex items-center gap-1">
        <MapPin className="w-3 h-3 text-gray-400" />
        {court.courtLabel}
      </div>

      {/* Timeline slots */}
      <div className="relative flex-1" style={{ minHeight: 48 }}>
        {/* Grid lines */}
        <div className="absolute inset-0 flex">
          {timeSlots.map((slot, i) => (
            <div
              key={i}
              className={`flex-shrink-0 border-r ${slot.getMinutes() === 0 ? 'bg-gray-50/30' : ''}`}
              style={{ width: PIXELS_PER_SLOT }}
            />
          ))}
        </div>

        {/* Scheduled encounters */}
        {scheduledEncounters.map(enc => {
          const slotIndex = getSlotIndex(new Date(enc.startTime), dayStart)
          const width = Math.ceil(enc.duration / SLOT_SIZE) * PIXELS_PER_SLOT
          const color = divColors[enc.divisionId] || COLORS[0]
          
          return (
            <div
              key={enc.id}
              className={`absolute top-1 bottom-1 rounded ${color.bg} ${color.border} border flex items-center px-2 text-xs overflow-hidden cursor-move`}
              style={{
                left: slotIndex * PIXELS_PER_SLOT,
                width: Math.max(width - 2, 20)
              }}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('encounterId', enc.id.toString())}
            >
              <span className={`truncate ${color.text}`}>
                {enc.unit1Name || 'TBD'} v {enc.unit2Name || 'TBD'}
              </span>
            </div>
          )
        })}

        {/* Pending assignments (show with dashed border) */}
        {pendingAssignments.map(enc => {
          if (!enc?.startTime) return null
          const slotIndex = getSlotIndex(new Date(enc.startTime), dayStart)
          const duration = enc.estimatedDurationMinutes || 30
          const width = Math.ceil(duration / SLOT_SIZE) * PIXELS_PER_SLOT
          const color = divColors[enc.divisionId] || COLORS[0]
          
          return (
            <div
              key={`pending-${enc.id}`}
              className={`absolute top-1 bottom-1 rounded ${color.bg} border-2 border-dashed ${color.border} flex items-center px-2 text-xs overflow-hidden cursor-move opacity-80`}
              style={{
                left: slotIndex * PIXELS_PER_SLOT,
                width: Math.max(width - 2, 20)
              }}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('encounterId', enc.id.toString())}
            >
              <span className={`truncate ${color.text}`}>
                {enc.unit1Name || 'TBD'} v {enc.unit2Name || 'TBD'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
