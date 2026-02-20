import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Clock, Loader2, ChevronDown, ChevronRight, Check, X,
  GripVertical, MapPin, Calendar, AlertTriangle, Zap,
  Play, Square, Users, Filter, RotateCcw, Hash, Layers, Eye, EyeOff
} from 'lucide-react'
import { tournamentApi } from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import { CanvasPhaseEditor } from '../../pages/PhaseTemplatesAdmin'
import { parseStructureToVisual } from './structureEditorConstants'

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
const DEFAULT_GAME_DURATION = 15 // minutes per game

function formatTime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000)
}

function getSlotIndex(time, dayStart) {
  const diff = (time.getTime() - dayStart.getTime()) / 60000
  return Math.floor(diff / SLOT_SIZE)
}

// ═════════════════════════════════════════════════════
// Main Component - Now works at MATCH level
// ═════════════════════════════════════════════════════
export default function PhaseCourtScheduler({ eventId, data, onUpdate }) {
  const toast = useToast()
  
  // Selection state (at encounter/match level)
  const [selectedDivision, setSelectedDivision] = useState(null)
  const [selectedPhase, setSelectedPhase] = useState(null)
  const [selectedMatches, setSelectedMatches] = useState(new Set()) // encounterId set
  const [expandedDivisions, setExpandedDivisions] = useState(new Set())
  
  // Scheduling state (at match level)
  const [assignments, setAssignments] = useState({}) // matchId -> { courtId, startTime }
  const [saving, setSaving] = useState(false)
  
  // Phase timing overrides (edited inline)
  const [phaseTiming, setPhaseTiming] = useState({}) // phaseId -> { gameDurationMinutes, changeoverMinutes, matchBufferMinutes }
  const [savingTiming, setSavingTiming] = useState(false)
  
  // Phase diagram view
  const [showPhaseDiagram, setShowPhaseDiagram] = useState(false)
  const [divisionStructure, setDivisionStructure] = useState(null) // { divisionId, visualState }
  const [loadingStructure, setLoadingStructure] = useState(false)
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
  
  const timelineRef = useRef(null)

  // ─── Derive matches from encounters (no games needed for scheduling) ──────────────────────────────────
  const matches = useMemo(() => {
    if (!data?.encounters) return []
    
    // Filter out byes
    const validEncounters = data.encounters.filter(e => !e.isBye)
    
    return validEncounters.map(enc => {
      // Use phase timing overrides if set
      const timing = phaseTiming[enc.phaseId] || {}
      const gameDur = timing.gameDurationMinutes ?? DEFAULT_GAME_DURATION
      const changeover = timing.changeoverMinutes ?? 2
      const buffer = timing.matchBufferMinutes ?? 5
      
      // Get BestOf from encounter (defaults to 1 if not set)
      const bestOf = enc.bestOf || 1
      
      // Calculate duration: bestOf × gameDuration + changeovers + buffer
      // For BO3: 3 games + 2 changeovers + buffer
      // For BO1: 1 game + buffer
      const playTime = bestOf * gameDur + (bestOf > 1 ? (bestOf - 1) * changeover : 0)
      const duration = playTime + buffer
      
      return {
        id: enc.id, // Use encounter ID as match ID for scheduling
        encounterId: enc.id,
        divisionId: enc.divisionId,
        divisionName: enc.divisionName,
        phaseId: enc.phaseId,
        phaseName: enc.phaseName,
        matchLabel: enc.encounterLabel,
        roundNumber: enc.roundNumber,
        roundName: enc.roundName,
        encounterNumber: enc.encounterNumber,
        unit1Name: enc.unit1Name,
        unit2Name: enc.unit2Name,
        unit1Id: enc.unit1Id,
        unit2Id: enc.unit2Id,
        totalGames: bestOf,
        courtId: enc.courtId,
        courtLabel: enc.courtLabel,
        scheduledStartTime: enc.scheduledTime || enc.estimatedStartTime,
        scheduledEndTime: enc.estimatedEndTime,
        // Timing
        effectiveGameDuration: gameDur,
        effectiveChangeover: changeover,
        effectiveBuffer: buffer,
        duration,
        // Original encounter data for reference
        status: enc.status
      }
    })
  }, [data?.encounters, phaseTiming])

  // ─── Group matches by division and phase ──────────────────────────────────
  const matchesByDivPhase = useMemo(() => {
    const grouped = {}
    matches.forEach(match => {
      const divKey = match.divisionId
      const phaseKey = match.phaseId || 'no-phase'
      if (!grouped[divKey]) grouped[divKey] = {}
      if (!grouped[divKey][phaseKey]) grouped[divKey][phaseKey] = []
      grouped[divKey][phaseKey].push(match)
    })
    return grouped
  }, [matches])

  // Get unique divisions - include all from data.divisions plus any from matches
  const divisions = useMemo(() => {
    const divMap = {}
    // First, add all divisions from the data prop (court-planning data)
    data?.divisions?.forEach(d => {
      divMap[d.id] = {
        id: d.id,
        name: d.name,
        phases: {}
      }
      // Add phases from data if available
      d.phases?.forEach(p => {
        divMap[d.id].phases[p.id] = {
          id: p.id,
          name: p.name,
          phaseOrder: p.sortOrder || 0
        }
      })
    })
    // Then merge in any division/phase info from matches (games)
    matches.forEach(m => {
      if (!divMap[m.divisionId]) {
        divMap[m.divisionId] = {
          id: m.divisionId,
          name: m.divisionName,
          phases: {}
        }
      }
      if (m.phaseId && !divMap[m.divisionId].phases[m.phaseId]) {
        divMap[m.divisionId].phases[m.phaseId] = {
          id: m.phaseId,
          name: m.phaseName,
          phaseOrder: m.phaseOrder || m.phaseSortOrder || 0
        }
      }
    })
    return Object.values(divMap).map(d => ({
      ...d,
      // Sort phases by phaseOrder
      phases: Object.values(d.phases).sort((a, b) => (a.phaseOrder || 0) - (b.phaseOrder || 0))
    }))
  }, [matches, data])

  // Get all courts (from data prop)
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
    divisions.forEach((d, i) => { m[d.id] = COLORS[i % COLORS.length] })
    return m
  }, [divisions])

  // Currently scheduled matches (existing + pending assignments)
  const scheduledMatches = useMemo(() => {
    return matches
      .map(m => {
        const assignment = assignments[m.id]
        return {
          ...m,
          courtId: assignment?.courtId ?? m.courtId,
          startTime: assignment?.startTime ?? m.scheduledStartTime,
        }
      })
      .filter(m => m.courtId && m.startTime)
  }, [matches, assignments])

  // Get team IDs for a match (for stagger logic)
  const getTeamIds = (match) => {
    return [match.unit1Id, match.unit2Id].filter(Boolean)
  }

  // Check if scheduling a match at a time would violate back-to-back rule
  const wouldViolateStagger = useCallback((match, courtId, startTime, proposedAssignments) => {
    const teams = getTeamIds(match)
    if (teams.length === 0) return false
    
    // Duration now includes buffer, so end time accounts for buffer
    const endTime = addMinutes(new Date(startTime), match.duration)
    
    // Check against all scheduled matches
    for (const other of scheduledMatches) {
      if (other.id === match.id) continue
      const otherTeams = getTeamIds(other)
      const hasOverlappingTeam = teams.some(t => otherTeams.includes(t))
      if (!hasOverlappingTeam) continue
      
      // Check for time overlap (buffer is already in duration)
      const otherStart = new Date(other.startTime)
      const otherEnd = addMinutes(otherStart, other.duration)
      
      if (startTime < otherEnd.getTime() && endTime.getTime() > otherStart.getTime()) {
        return true
      }
    }
    
    // Also check proposed assignments
    for (const [otherId, assignment] of Object.entries(proposedAssignments)) {
      if (otherId === match.id) continue
      const other = matches.find(m => m.id === otherId)
      if (!other) continue
      
      const otherTeams = getTeamIds(other)
      const hasOverlappingTeam = teams.some(t => otherTeams.includes(t))
      if (!hasOverlappingTeam) continue
      
      const otherStart = new Date(assignment.startTime)
      const otherEnd = addMinutes(otherStart, other.duration)
      
      if (startTime < otherEnd.getTime() && endTime.getTime() > otherStart.getTime()) {
        return true
      }
    }
    
    return false
  }, [scheduledMatches, matches])

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

    const matchList = matches.filter(m => selectedMatches.has(m.id))
    const newAssignments = { ...assignments }
    let currentTime = new Date(startTime)
    let courtIndex = 0
    
    // Sort matches by division, phase, then match order
    const sortedMatches = [...matchList].sort((a, b) => {
      if (a.divisionId !== b.divisionId) return a.divisionId - b.divisionId
      if (a.phaseId !== b.phaseId) return (a.phaseId || 0) - (b.phaseId || 0)
      return a.encounterId - b.encounterId
    })

    for (const match of sortedMatches) {
      let scheduled = false
      let attempts = 0
      
      // Try each court, advancing time if needed
      while (!scheduled && attempts < courtIds.length * 20) {
        const courtId = courtIds[courtIndex % courtIds.length]
        
        // Check for conflicts on this court at this time
        const hasCourtConflict = scheduledMatches.some(m => {
          if (m.courtId !== courtId) return false
          const mStart = new Date(m.startTime)
          const mEnd = addMinutes(mStart, m.duration)
          return currentTime < mEnd && addMinutes(currentTime, match.duration) > mStart
        }) || Object.entries(newAssignments).some(([id, a]) => {
          if (id === match.id) return false
          if (a.courtId !== courtId) return false
          const aStart = new Date(a.startTime)
          const other = matches.find(m => m.id === id)
          const aEnd = addMinutes(aStart, other?.duration || 30)
          return currentTime < aEnd && addMinutes(currentTime, match.duration) > aStart
        })

        // Check stagger rule
        const violatesStagger = wouldViolateStagger(match, courtId, currentTime.getTime(), newAssignments)
        
        if (!hasCourtConflict && !violatesStagger) {
          const endTime = addMinutes(currentTime, match.duration)
          newAssignments[match.id] = {
            courtId,
            startTime: currentTime.toISOString(),
            endTime: endTime.toISOString()
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
        toast.warn(`Could not schedule ${match.unit1Name} vs ${match.unit2Name}`)
      }
    }

    setAssignments(newAssignments)
    toast.success(`Scheduled ${sortedMatches.length} matches`)
  }, [selectedMatches, matches, assignments, scheduledMatches, wouldViolateStagger, toast])

  // ─── Save assignments (update encounter scheduling) ──────────────────────────────────
  const saveAssignments = async () => {
    if (Object.keys(assignments).length === 0) {
      toast.warn('No changes to save')
      return
    }

    setSaving(true)
    try {
      // Build encounter-level updates
      const updates = []
      
      for (const [encounterId, { courtId, startTime, endTime }] of Object.entries(assignments)) {
        const match = matches.find(m => m.id === encounterId || m.id === parseInt(encounterId))
        if (!match) continue
        
        updates.push({
          encounterId: match.encounterId,
          courtId,
          scheduledTime: startTime,
          estimatedStartTime: startTime // Also set estimatedStartTime
        })
      }

      const response = await tournamentApi.bulkAssignCourtsAndTimes(eventId, updates)
      if (response.success) {
        toast.success('Schedule saved!')
        setAssignments({})
        onUpdate?.() // Reload parent data which includes encounters
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

  // ─── Save phase timing to backend ──────────────────────────────────
  const savePhaseTimimg = async (phaseId) => {
    const timing = phaseTiming[phaseId]
    if (!timing) return
    
    setSavingTiming(true)
    try {
      const response = await tournamentApi.updatePhase(phaseId, {
        gameDurationMinutes: timing.gameDurationMinutes,
        changeoverMinutes: timing.changeoverMinutes,
        matchBufferMinutes: timing.matchBufferMinutes
      })
      if (response.success) {
        toast.success('Timing saved')
      } else {
        toast.error(response.message || 'Failed to save timing')
      }
    } catch (err) {
      console.error('Save timing error:', err)
      toast.error('Failed to save timing')
    } finally {
      setSavingTiming(false)
    }
  }

  // Update local phase timing
  const updatePhaseTiming = (phaseId, field, value) => {
    setPhaseTiming(prev => ({
      ...prev,
      [phaseId]: {
        ...(prev[phaseId] || {}),
        [field]: value
      }
    }))
  }

  // Get effective timing for a phase (local overrides + defaults from API)
  const getEffectiveTiming = (phaseId) => {
    const phaseMatches = matchesByDivPhase[selectedDivision]?.[phaseId] || []
    const firstMatch = phaseMatches[0]
    const local = phaseTiming[phaseId] || {}
    return {
      gameDurationMinutes: local.gameDurationMinutes ?? firstMatch?.gameDurationMinutes ?? 15,
      changeoverMinutes: local.changeoverMinutes ?? firstMatch?.changeoverMinutes ?? 2,
      matchBufferMinutes: local.matchBufferMinutes ?? firstMatch?.matchBufferMinutes ?? 5,
      bestOf: firstMatch?.totalGames ?? 1
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

  // Load division structure for phase diagram
  const loadDivisionStructure = async (divId) => {
    if (!divId) return
    setLoadingStructure(true)
    try {
      // Get division details which should include the phase template structure
      const response = await tournamentApi.getDivision(divId)
      if (response.success && response.data) {
        const div = response.data
        // Try to parse the structure from phaseTemplateJson or structureJson
        const structureJson = div.phaseTemplateJson || div.structureJson
        if (structureJson) {
          const parsed = typeof structureJson === 'string' ? JSON.parse(structureJson) : structureJson
          const visualState = parseStructureToVisual(JSON.stringify(parsed))
          setDivisionStructure({ divisionId: divId, visualState })
        } else {
          // Fallback: build from phases in data
          const divData = data?.divisions?.find(d => d.id === divId)
          if (divData?.phases?.length) {
            const visualState = {
              isFlexible: false,
              generateBracket: {},
              phases: divData.phases.map((p, i) => ({
                name: p.name,
                phaseType: p.phaseType || 'SingleElimination',
                sortOrder: i + 1,
                incomingSlotCount: p.incomingSlotCount || 8,
                advancingSlotCount: p.advancingSlotCount || 1,
                poolCount: p.poolCount || 0,
                bestOf: p.bestOf || 1,
                matchDurationMinutes: p.matchDurationMinutes || 15,
              })),
              advancementRules: [],
              exitPositions: []
            }
            setDivisionStructure({ divisionId: divId, visualState })
          }
        }
      }
    } catch (err) {
      console.error('Error loading division structure:', err)
    } finally {
      setLoadingStructure(false)
    }
  }

  const selectPhase = (divId, phaseId) => {
    setSelectedDivision(divId)
    setSelectedPhase(phaseId)
    // Auto-select all matches in this phase
    const phaseMatches = matchesByDivPhase[divId]?.[phaseId] || []
    setSelectedMatches(new Set(phaseMatches.map(m => m.id)))
    // Load structure if diagram is shown and division changed
    if (showPhaseDiagram && divisionStructure?.divisionId !== divId) {
      loadDivisionStructure(divId)
    }
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
        <span className="ml-2 text-gray-500">Loading data...</span>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Matches to Schedule</h3>
        <p className="text-sm text-gray-500 max-w-md">
          Matches are created when you configure phases and brackets. 
          First set up your division phases, then come back here to assign court times.
        </p>
      </div>
    )
  }

  const selectedMatchList = matches.filter(m => selectedMatches.has(m.id))
  const totalDuration = selectedMatchList.reduce((sum, m) => sum + m.duration, 0)

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[600px]">
      {/* ─── Left Panel: Phase/Match Selector ─── */}
      <div className="w-80 flex-shrink-0 bg-white rounded-xl border overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Select Matches
            </h3>
            <button
              onClick={() => {
                const newShow = !showPhaseDiagram
                setShowPhaseDiagram(newShow)
                if (newShow && selectedDivision && divisionStructure?.divisionId !== selectedDivision) {
                  loadDivisionStructure(selectedDivision)
                }
              }}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${
                showPhaseDiagram 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="Toggle phase diagram"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Click a phase to select all its matches, or pick individually
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {divisions.map(div => {
            const divMatches = matchesByDivPhase[div.id] || {}
            // Sort phases by phaseOrder/sortOrder
            const phases = [...(div.phases || [])].sort((a, b) => 
              (a.phaseOrder || a.sortOrder || 0) - (b.phaseOrder || b.sortOrder || 0)
            )
            // Exclude phases with 0 incoming or 0 advancing slots (entry/exit points), and Draw/Award types (no encounters)
            const playablePhases = phases.filter(p => 
              (p.incomingSlotCount || 0) > 0 && 
              (p.advancingSlotCount || 0) > 0 &&
              p.phaseType !== 'Draw' && 
              p.phaseType !== 'Award'
            )
            const playablePhaseIds = new Set(playablePhases.map(p => p.id))
            const noPhaseMatches = divMatches['no-phase'] || []
            const color = divColors[div.id]
            const isExpanded = expandedDivisions.has(div.id)
            // Only count matches from playable phases
            const totalDivMatches = Object.entries(divMatches)
              .filter(([phaseId]) => phaseId === 'no-phase' || playablePhaseIds.has(parseInt(phaseId)))
              .flatMap(([_, matches]) => matches).length
            
            return (
              <div key={div.id} className="mb-2">
                {/* Division header */}
                <button
                  onClick={() => toggleDivision(div.id)}
                  className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 ${color?.bg} ${color?.border} border`}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className={`font-medium ${color?.text}`}>{div.name}</span>
                  <span className="ml-auto text-xs text-gray-500">{totalDivMatches} matches</span>
                </button>
                
                {/* Phases (only playable - excludes Draw/Award) */}
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {playablePhases.map(phase => {
                      const phaseMatches = divMatches[phase.id] || []
                      const isSelected = selectedDivision === div.id && selectedPhase === phase.id
                      const scheduledCount = phaseMatches.filter(m => 
                        m.courtId || assignments[m.id]?.courtId
                      ).length
                      
                      return (
                        <div key={phase.id}>
                          <button
                            onClick={() => selectPhase(div.id, phase.id)}
                            className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 ${
                              isSelected ? 'bg-orange-100 border-orange-400 border' : 'hover:bg-gray-100'
                            }`}
                          >
                            <Play className="w-3 h-3 text-gray-400" />
                            <span className="flex-1">{phase.name}</span>
                            <span className="text-xs text-gray-500">
                              {scheduledCount}/{phaseMatches.length}
                            </span>
                          </button>
                          
                          {/* Individual matches when phase is selected */}
                          {isSelected && (
                            <div className="ml-4 mt-1 space-y-0.5 max-h-64 overflow-y-auto">
                              {phaseMatches.map(match => {
                                const isScheduled = match.courtId || assignments[match.id]?.courtId
                                return (
                                  <label
                                    key={match.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-xs ${
                                      isScheduled ? 'bg-green-50' : ''
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedMatches.has(match.id)}
                                      onChange={() => toggleMatch(match.id)}
                                      className="rounded border-gray-300"
                                    />
                                    <span className="flex-1 truncate">
                                      {match.unit1Name || 'TBD'} vs {match.unit2Name || 'TBD'}
                                      <span className="text-gray-400 ml-1">
                                        (Bo{match.totalGames})
                                      </span>
                                    </span>
                                    {isScheduled && (
                                      <span className="text-green-600 text-[10px]">
                                        {match.courtLabel || assignments[match.id]?.courtId}
                                      </span>
                                    )}
                                  </label>
                                )
                              })}
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

        {/* Phase Timing Editor - shown when a phase is selected */}
        {selectedPhase && selectedPhase !== 'no-phase' && (
          <div className="p-3 border-t bg-blue-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-800 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Timing Settings
              </span>
              <button 
                onClick={() => savePhaseTimimg(selectedPhase)}
                disabled={savingTiming}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                {savingTiming ? 'Saving...' : 'Save'}
              </button>
            </div>
            {(() => {
              const timing = getEffectiveTiming(selectedPhase)
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-20">Per game:</label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={timing.gameDurationMinutes}
                      onChange={(e) => updatePhaseTiming(selectedPhase, 'gameDurationMinutes', parseInt(e.target.value) || 15)}
                      className="w-16 px-2 py-1 text-xs border rounded"
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-20">Changeover:</label>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      value={timing.changeoverMinutes}
                      onChange={(e) => updatePhaseTiming(selectedPhase, 'changeoverMinutes', parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-xs border rounded"
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-20">Match buffer:</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={timing.matchBufferMinutes}
                      onChange={(e) => updatePhaseTiming(selectedPhase, 'matchBufferMinutes', parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-xs border rounded"
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                  <div className="text-xs text-blue-700 mt-1 pt-1 border-t border-blue-200">
                    {timing.bestOf > 1 
                      ? `Bo${timing.bestOf} = ${timing.bestOf * timing.gameDurationMinutes}min/slot (${timing.bestOf}×${timing.gameDurationMinutes}m, no buffer)`
                      : `1 game = ${timing.gameDurationMinutes + timing.matchBufferMinutes}min/slot (${timing.gameDurationMinutes}m + ${timing.matchBufferMinutes}m buffer)`
                    }
                  </div>
                </div>
              )
            })()}
          </div>
        )}

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

        {/* Phase Diagram - shown when toggled */}
        {showPhaseDiagram && (
          <div className="border-t">
            <div className="p-2 bg-purple-50 border-b flex items-center justify-between">
              <span className="text-xs font-medium text-purple-800 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                Phase Structure {selectedDivision ? `- ${divisions.find(d => d.id === selectedDivision)?.name || ''}` : ''}
              </span>
              <button
                onClick={() => setShowPhaseDiagram(false)}
                className="p-1 text-purple-600 hover:bg-purple-100 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="h-[300px]">
              {loadingStructure ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                </div>
              ) : divisionStructure?.visualState ? (
                <CanvasPhaseEditor
                  visualState={divisionStructure.visualState}
                  onChange={() => {}} // No-op for read-only
                  readOnly={true}
                />
              ) : selectedDivision ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Layers className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs">No phase structure found</p>
                  <button
                    onClick={() => loadDivisionStructure(selectedDivision)}
                    className="mt-2 text-xs text-purple-600 hover:underline"
                  >
                    Reload
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Layers className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs">Select a division to view structure</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Right Panel: Court Timeline ─── */}
      <div className="flex-1 bg-white rounded-xl border overflow-hidden flex flex-col">
        {/* Header with controls */}
        <div className="p-4 border-b bg-gray-50 flex items-center gap-4 flex-wrap">
          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={dayStart.toISOString().split('T')[0]}
              onChange={(e) => {
                const newDate = new Date(e.target.value)
                // Update dayStart keeping the time
                const newStart = new Date(dayStart)
                newStart.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
                setDayStart(newStart)
                // Update dayEnd keeping the time
                const newEnd = new Date(dayEnd)
                newEnd.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
                setDayEnd(newEnd)
              }}
              className="px-2 py-1 border rounded text-sm font-medium"
            />
          </div>
          
          <div className="h-6 border-l border-gray-300" />
          
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
              <span className="text-sm text-gray-500">
                {Object.keys(assignments).length} pending changes
              </span>
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
                scheduledMatches={scheduledMatches.filter(m => m.courtId === court.id)}
                pendingAssignments={Object.entries(assignments)
                  .filter(([_, a]) => a.courtId === court.id)
                  .map(([id, a]) => {
                    const match = matches.find(m => m.id === id || m.id === parseInt(id))
                    return match ? { ...match, ...a } : null
                  })
                  .filter(Boolean)}
                divColors={divColors}
                matches={matches}
                onDropMatch={(matchId, time) => {
                  const match = matches.find(m => m.id === matchId || m.id === parseInt(matchId))
                  if (match && !wouldViolateStagger(match, court.id, time.getTime(), assignments)) {
                    const endTime = addMinutes(time, match.duration)
                    setAssignments(prev => ({
                      ...prev,
                      [matchId]: { 
                        courtId: court.id, 
                        startTime: time.toISOString(),
                        endTime: endTime.toISOString()
                      }
                    }))
                  } else {
                    toast.warn('Would cause back-to-back conflict for a team')
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
          {courts.slice(0, 10).map(court => (
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
          {courts.length > 10 && (
            <span className="text-xs text-gray-500">+{courts.length - 10} more</span>
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
// Court Row (now shows matches, not games)
// ═════════════════════════════════════════════════════
function CourtRow({ court, timeSlots, dayStart, scheduledMatches, pendingAssignments, divColors, matches, onDropMatch }) {
  const rowRef = useRef(null)

  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault()
    const matchId = e.dataTransfer.getData('matchId')
    if (!matchId || !rowRef.current) return

    const rect = rowRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - 96 // account for label width
    const slotIndex = Math.floor(x / PIXELS_PER_SLOT)
    const dropTime = addMinutes(dayStart, slotIndex * SLOT_SIZE)
    
    onDropMatch(matchId, dropTime)
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

        {/* Scheduled matches */}
        {scheduledMatches.map(match => {
          const slotIndex = getSlotIndex(new Date(match.startTime), dayStart)
          const width = Math.ceil(match.duration / SLOT_SIZE) * PIXELS_PER_SLOT
          const color = divColors[match.divisionId] || COLORS[0]
          
          return (
            <div
              key={match.id}
              className={`absolute top-1 bottom-1 rounded ${color.bg} ${color.border} border flex items-center px-2 text-xs overflow-hidden cursor-move`}
              style={{
                left: slotIndex * PIXELS_PER_SLOT,
                width: Math.max(width - 2, 50)
              }}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('matchId', match.id.toString())}
              title={`${match.unit1Name} vs ${match.unit2Name} (Bo${match.totalGames}, ${match.duration}min)`}
            >
              <span className={`truncate ${color.text}`}>
                {match.unit1Name || 'TBD'} v {match.unit2Name || 'TBD'}
                <span className="opacity-50 ml-1">Bo{match.totalGames}</span>
              </span>
            </div>
          )
        })}

        {/* Pending assignments (show with dashed border) */}
        {pendingAssignments.map(match => {
          if (!match?.startTime) return null
          const slotIndex = getSlotIndex(new Date(match.startTime), dayStart)
          const width = Math.ceil(match.duration / SLOT_SIZE) * PIXELS_PER_SLOT
          const color = divColors[match.divisionId] || COLORS[0]
          
          return (
            <div
              key={`pending-${match.id}`}
              className={`absolute top-1 bottom-1 rounded ${color.bg} border-2 border-dashed ${color.border} flex items-center px-2 text-xs overflow-hidden cursor-move opacity-80`}
              style={{
                left: slotIndex * PIXELS_PER_SLOT,
                width: Math.max(width - 2, 50)
              }}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('matchId', match.id.toString())}
              title={`${match.unit1Name} vs ${match.unit2Name} (Bo${match.totalGames}, ${match.duration}min) - pending`}
            >
              <span className={`truncate ${color.text}`}>
                {match.unit1Name || 'TBD'} v {match.unit2Name || 'TBD'}
                <span className="opacity-50 ml-1">Bo{match.totalGames}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
