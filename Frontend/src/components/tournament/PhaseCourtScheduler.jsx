import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Clock, Loader2, ChevronDown, ChevronRight, Check, X,
  GripVertical, MapPin, Calendar, AlertTriangle, Zap,
  Play, Square, Users, Filter, RotateCcw, Hash
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
  
  // Games data
  const [games, setGames] = useState([])
  const [loadingGames, setLoadingGames] = useState(true)
  
  // Selection state
  const [selectedDivision, setSelectedDivision] = useState(null)
  const [selectedPhase, setSelectedPhase] = useState(null)
  const [selectedGames, setSelectedGames] = useState(new Set())
  const [expandedDivisions, setExpandedDivisions] = useState(new Set())
  
  // Scheduling state
  const [assignments, setAssignments] = useState({}) // gameId -> { courtId, startTime }
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
  
  const timelineRef = useRef(null)

  // ─── Load Games ──────────────────────────────────
  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoadingGames(true)
        const response = await tournamentApi.getGamesForScheduling(eventId)
        if (response.success) {
          setGames(response.data || [])
        } else {
          toast.error(response.message || 'Failed to load games')
        }
      } catch (err) {
        console.error('Error loading games:', err)
        toast.error('Failed to load games')
      } finally {
        setLoadingGames(false)
      }
    }
    loadGames()
  }, [eventId])

  // ─── Computed Values ──────────────────────────────────
  
  // Group games by division and phase
  const gamesByDivPhase = useMemo(() => {
    const grouped = {}
    games.forEach(game => {
      const divKey = game.divisionId
      const phaseKey = game.phaseId || 'no-phase'
      if (!grouped[divKey]) grouped[divKey] = {}
      if (!grouped[divKey][phaseKey]) grouped[divKey][phaseKey] = []
      grouped[divKey][phaseKey].push(game)
    })
    return grouped
  }, [games])

  // Get unique divisions from games
  const divisions = useMemo(() => {
    const divMap = {}
    games.forEach(g => {
      if (!divMap[g.divisionId]) {
        divMap[g.divisionId] = {
          id: g.divisionId,
          name: g.divisionName,
          phases: {}
        }
      }
      if (g.phaseId && !divMap[g.divisionId].phases[g.phaseId]) {
        divMap[g.divisionId].phases[g.phaseId] = {
          id: g.phaseId,
          name: g.phaseName
        }
      }
    })
    return Object.values(divMap).map(d => ({
      ...d,
      phases: Object.values(d.phases)
    }))
  }, [games])

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

  // Currently scheduled games (existing + pending assignments)
  const scheduledGames = useMemo(() => {
    return games
      .map(g => {
        const assignment = assignments[g.id]
        return {
          ...g,
          courtId: assignment?.courtId ?? g.tournamentCourtId,
          startTime: assignment?.startTime ?? g.scheduledStartTime,
          duration: g.estimatedDurationMinutes || 30
        }
      })
      .filter(g => g.courtId && g.startTime)
  }, [games, assignments])

  // Get team IDs for a game (for stagger logic)
  const getTeamIds = (game) => {
    return [game.unit1Id, game.unit2Id].filter(Boolean)
  }

  // Check if scheduling a game at a time would violate back-to-back rule
  const wouldViolateStagger = useCallback((game, courtId, startTime, proposedAssignments) => {
    const teams = getTeamIds(game)
    if (teams.length === 0) return false
    
    const endTime = addMinutes(new Date(startTime), game.estimatedDurationMinutes || 30)
    
    // Check against all scheduled games
    for (const other of scheduledGames) {
      if (other.id === game.id) continue
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
      if (parseInt(otherId) === game.id) continue
      const other = games.find(g => g.id === parseInt(otherId))
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
  }, [scheduledGames, games])

  // ─── Auto-schedule selected games ──────────────────────────────────
  const autoScheduleSelected = useCallback((courtIds, startTime) => {
    if (selectedGames.size === 0) {
      toast.warn('No games selected')
      return
    }
    if (courtIds.length === 0) {
      toast.warn('No courts selected')
      return
    }

    const gameList = games.filter(g => selectedGames.has(g.id))
    const newAssignments = { ...assignments }
    let currentTime = new Date(startTime)
    let courtIndex = 0
    
    // Sort games by match, then game number
    const sortedGames = [...gameList].sort((a, b) => {
      if (a.encounterId !== b.encounterId) return a.encounterId - b.encounterId
      if (a.matchId !== b.matchId) return a.matchId - b.matchId
      return a.gameNumber - b.gameNumber
    })

    for (const game of sortedGames) {
      const duration = game.estimatedDurationMinutes || 30
      let scheduled = false
      let attempts = 0
      
      // Try each court, advancing time if needed
      while (!scheduled && attempts < courtIds.length * 20) {
        const courtId = courtIds[courtIndex % courtIds.length]
        
        // Check for conflicts on this court at this time
        const hasCourtConflict = scheduledGames.some(g => {
          if (g.courtId !== courtId) return false
          const gStart = new Date(g.startTime)
          const gEnd = addMinutes(gStart, g.duration)
          return currentTime < gEnd && addMinutes(currentTime, duration) > gStart
        }) || Object.entries(newAssignments).some(([id, a]) => {
          if (parseInt(id) === game.id) return false
          if (a.courtId !== courtId) return false
          const aStart = new Date(a.startTime)
          const other = games.find(g => g.id === parseInt(id))
          const aEnd = addMinutes(aStart, other?.estimatedDurationMinutes || 30)
          return currentTime < aEnd && addMinutes(currentTime, duration) > aStart
        })

        // Check stagger rule
        const violatesStagger = wouldViolateStagger(game, courtId, currentTime.getTime(), newAssignments)
        
        if (!hasCourtConflict && !violatesStagger) {
          const endTime = addMinutes(currentTime, duration)
          newAssignments[game.id] = {
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
        toast.warn(`Could not schedule game ${game.gameNumber} of ${game.unit1Name} vs ${game.unit2Name}`)
      }
    }

    setAssignments(newAssignments)
    toast.success(`Scheduled ${sortedGames.length} games`)
  }, [selectedGames, games, assignments, scheduledGames, wouldViolateStagger, toast])

  // ─── Save assignments ──────────────────────────────────
  const saveAssignments = async () => {
    if (Object.keys(assignments).length === 0) {
      toast.warn('No changes to save')
      return
    }

    setSaving(true)
    try {
      const updates = Object.entries(assignments).map(([gameId, { courtId, startTime, endTime }]) => ({
        gameId: parseInt(gameId),
        courtId,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime
      }))

      const response = await tournamentApi.bulkAssignGames(eventId, updates)
      if (response.success) {
        toast.success('Schedule saved!')
        setAssignments({})
        // Reload games to get updated data
        const gamesRes = await tournamentApi.getGamesForScheduling(eventId)
        if (gamesRes.success) setGames(gamesRes.data || [])
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
    // Auto-select all games in this phase
    const phaseGames = gamesByDivPhase[divId]?.[phaseId] || []
    setSelectedGames(new Set(phaseGames.map(g => g.id)))
  }

  const toggleGame = (gameId) => {
    setSelectedGames(prev => {
      const next = new Set(prev)
      if (next.has(gameId)) next.delete(gameId)
      else next.add(gameId)
      return next
    })
  }

  const clearSelection = () => {
    setSelectedGames(new Set())
    setSelectedDivision(null)
    setSelectedPhase(null)
  }

  // ─── Render ──────────────────────────────────
  if (loadingGames || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading games...</span>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Games to Schedule</h3>
        <p className="text-sm text-gray-500 max-w-md">
          Games are created when you configure phases and match formats. 
          First set up your division phases with game formats (Best of 1/3/5), then come back here to assign court times.
        </p>
      </div>
    )
  }

  const selectedGameList = games.filter(g => selectedGames.has(g.id))
  const totalDuration = selectedGameList.reduce((sum, g) => sum + (g.estimatedDurationMinutes || 30), 0)

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[600px]">
      {/* ─── Left Panel: Phase/Game Selector ─── */}
      <div className="w-80 flex-shrink-0 bg-white rounded-xl border overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Select Games
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Click a phase to select all its games, or pick individually
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {divisions.map(div => {
            const divGames = gamesByDivPhase[div.id] || {}
            const phases = div.phases || []
            const noPhaseGames = divGames['no-phase'] || []
            const color = divColors[div.id]
            const isExpanded = expandedDivisions.has(div.id)
            const totalDivGames = Object.values(divGames).flat().length
            
            return (
              <div key={div.id} className="mb-2">
                {/* Division header */}
                <button
                  onClick={() => toggleDivision(div.id)}
                  className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 ${color?.bg} ${color?.border} border`}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className={`font-medium ${color?.text}`}>{div.name}</span>
                  <span className="ml-auto text-xs text-gray-500">{totalDivGames} games</span>
                </button>
                
                {/* Phases */}
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {phases.map(phase => {
                      const phaseGames = divGames[phase.id] || []
                      const isSelected = selectedDivision === div.id && selectedPhase === phase.id
                      const scheduledCount = phaseGames.filter(g => 
                        g.tournamentCourtId || assignments[g.id]?.courtId
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
                              {scheduledCount}/{phaseGames.length}
                            </span>
                          </button>
                          
                          {/* Individual games when phase is selected */}
                          {isSelected && (
                            <div className="ml-4 mt-1 space-y-0.5 max-h-64 overflow-y-auto">
                              {phaseGames.map(game => {
                                const isScheduled = game.tournamentCourtId || assignments[game.id]?.courtId
                                return (
                                  <label
                                    key={game.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-xs ${
                                      isScheduled ? 'bg-green-50' : ''
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedGames.has(game.id)}
                                      onChange={() => toggleGame(game.id)}
                                      className="rounded border-gray-300"
                                    />
                                    <span className="flex-1 truncate">
                                      <span className="text-gray-400">G{game.gameNumber}</span>{' '}
                                      {game.unit1Name || 'TBD'} vs {game.unit2Name || 'TBD'}
                                    </span>
                                    {isScheduled && (
                                      <span className="text-green-600 text-[10px]">
                                        {game.courtLabel || assignments[game.id]?.courtId}
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
                    
                    {/* No-phase games */}
                    {noPhaseGames.length > 0 && (
                      <button
                        onClick={() => selectPhase(div.id, 'no-phase')}
                        className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 ${
                          selectedDivision === div.id && selectedPhase === 'no-phase' 
                            ? 'bg-orange-100 border-orange-400 border' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Square className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600">Other Games</span>
                        <span className="ml-auto text-xs text-gray-500">{noPhaseGames.length}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Selection summary */}
        {selectedGames.size > 0 && (
          <div className="p-3 border-t bg-orange-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-orange-800">
                {selectedGames.size} games selected
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
        {selectedGames.size > 0 && (
          <QuickScheduleBar
            courts={allCourts}
            selectedCount={selectedGames.size}
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
                scheduledGames={scheduledGames.filter(g => g.courtId === court.id)}
                pendingAssignments={Object.entries(assignments)
                  .filter(([_, a]) => a.courtId === court.id)
                  .map(([id, a]) => ({
                    ...games.find(g => g.id === parseInt(id)),
                    ...a
                  }))}
                divColors={divColors}
                onDropGame={(gameId, time) => {
                  const game = games.find(g => g.id === gameId)
                  if (game && !wouldViolateStagger(game, court.id, time.getTime(), assignments)) {
                    const endTime = addMinutes(time, game.estimatedDurationMinutes || 30)
                    setAssignments(prev => ({
                      ...prev,
                      [gameId]: { 
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
        Schedule {selectedCount} games ({Math.floor(totalDuration / 60)}h {totalDuration % 60}m)
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
// Court Row
// ═════════════════════════════════════════════════════
function CourtRow({ court, timeSlots, dayStart, scheduledGames, pendingAssignments, divColors, onDropGame }) {
  const rowRef = useRef(null)

  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault()
    const gameId = parseInt(e.dataTransfer.getData('gameId'))
    if (!gameId || !rowRef.current) return

    const rect = rowRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - 96 // account for label width
    const slotIndex = Math.floor(x / PIXELS_PER_SLOT)
    const dropTime = addMinutes(dayStart, slotIndex * SLOT_SIZE)
    
    onDropGame(gameId, dropTime)
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

        {/* Scheduled games */}
        {scheduledGames.map(game => {
          const slotIndex = getSlotIndex(new Date(game.startTime), dayStart)
          const width = Math.ceil(game.duration / SLOT_SIZE) * PIXELS_PER_SLOT
          const color = divColors[game.divisionId] || COLORS[0]
          
          return (
            <div
              key={game.id}
              className={`absolute top-1 bottom-1 rounded ${color.bg} ${color.border} border flex items-center px-2 text-xs overflow-hidden cursor-move`}
              style={{
                left: slotIndex * PIXELS_PER_SLOT,
                width: Math.max(width - 2, 30)
              }}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('gameId', game.id.toString())}
              title={`G${game.gameNumber}: ${game.unit1Name} vs ${game.unit2Name}`}
            >
              <span className={`truncate ${color.text}`}>
                <span className="opacity-60">G{game.gameNumber}</span> {game.unit1Name || 'TBD'} v {game.unit2Name || 'TBD'}
              </span>
            </div>
          )
        })}

        {/* Pending assignments (show with dashed border) */}
        {pendingAssignments.map(game => {
          if (!game?.startTime) return null
          const slotIndex = getSlotIndex(new Date(game.startTime), dayStart)
          const duration = game.estimatedDurationMinutes || 30
          const width = Math.ceil(duration / SLOT_SIZE) * PIXELS_PER_SLOT
          const color = divColors[game.divisionId] || COLORS[0]
          
          return (
            <div
              key={`pending-${game.id}`}
              className={`absolute top-1 bottom-1 rounded ${color.bg} border-2 border-dashed ${color.border} flex items-center px-2 text-xs overflow-hidden cursor-move opacity-80`}
              style={{
                left: slotIndex * PIXELS_PER_SLOT,
                width: Math.max(width - 2, 30)
              }}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('gameId', game.id.toString())}
              title={`G${game.gameNumber}: ${game.unit1Name} vs ${game.unit2Name} (pending)`}
            >
              <span className={`truncate ${color.text}`}>
                <span className="opacity-60">G{game.gameNumber}</span> {game.unit1Name || 'TBD'} v {game.unit2Name || 'TBD'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
