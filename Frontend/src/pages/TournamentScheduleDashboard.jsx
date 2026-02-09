import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Clock, Loader2, RefreshCw, Zap, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, ChevronRight, Grid3X3,
  Play, Move, Eye, EyeOff, Layers, GripVertical, MapPin,
  Calendar, Settings, Info, Maximize2, Minimize2, Filter,
  RotateCcw, Download, Upload, LayoutGrid, List
} from 'lucide-react'
import { tournamentApi } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import PhaseCourtScheduler from '../components/tournament/PhaseCourtScheduler'

// ─── Color palette ──────────────────────────────────
const COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', hex: '#3b82f6', light: '#dbeafe', ring: 'ring-blue-400' },
  { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800', hex: '#10b981', light: '#d1fae5', ring: 'ring-emerald-400' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', hex: '#8b5cf6', light: '#ede9fe', ring: 'ring-purple-400' },
  { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', hex: '#f59e0b', light: '#fef3c7', ring: 'ring-amber-400' },
  { bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-800', hex: '#f43f5e', light: '#ffe4e6', ring: 'ring-rose-400' },
  { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-800', hex: '#06b6d4', light: '#cffafe', ring: 'ring-cyan-400' },
  { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800', hex: '#f97316', light: '#ffedd5', ring: 'ring-orange-400' },
  { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-800', hex: '#6366f1', light: '#e0e7ff', ring: 'ring-indigo-400' },
]

function fmtTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtDuration(min) {
  if (!min) return ''
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// ═════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════
export default function TournamentScheduleDashboard() {
  const { eventId } = useParams()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)     // court-planning data
  const [timeline, setTimeline] = useState(null) // timeline data
  const [busy, setBusy] = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState('phase') // 'phase' (new) or 'legacy'

  // Interaction
  const [expandedDivisions, setExpandedDivisions] = useState(new Set())
  const [selectedEncounter, setSelectedEncounter] = useState(null)
  const [movingEncounter, setMovingEncounter] = useState(null)
  const [filterDivision, setFilterDivision] = useState(null)
  const [showTimeline, setShowTimeline] = useState(true)

  // Division colors
  const divColors = useMemo(() => {
    const m = {}
    data?.divisions?.forEach((d, i) => { m[d.id] = COLORS[i % COLORS.length] })
    return m
  }, [data?.divisions])

  // ── Data Loading ───────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      const [planRes, tlRes] = await Promise.all([
        tournamentApi.getCourtPlanningData(eventId),
        tournamentApi.getTimelineData(eventId).catch(() => null)
      ])
      if (planRes.success) setData(planRes.data)
      if (tlRes?.success) setTimeline(tlRes.data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { loadAll() }, [eventId])

  // ── Derived ────────────────────────────────────────
  const encounters = useMemo(() => {
    if (!data?.encounters) return []
    return data.encounters.filter(e => !e.isBye)
  }, [data])

  const filteredEncounters = useMemo(() => {
    if (!filterDivision) return encounters
    return encounters.filter(e => e.divisionId === filterDivision)
  }, [encounters, filterDivision])

  const allCourts = useMemo(() => {
    const grouped = data?.courtGroups?.flatMap(g => g.courts) || []
    const ungrouped = data?.unassignedCourts || []
    return [...grouped, ...ungrouped]
  }, [data])

  const stats = useMemo(() => {
    const total = encounters.length
    const assigned = encounters.filter(e => e.courtId && e.estimatedStartTime).length
    const unassigned = total - assigned
    return { total, assigned, unassigned }
  }, [encounters])

  // Group encounters by division → phase
  const divisionTree = useMemo(() => {
    if (!data?.divisions) return []
    return data.divisions.map(div => {
      const divEncs = encounters.filter(e => e.divisionId === div.id)
      const phases = (div.phases || []).map(ph => {
        const phEncs = divEncs.filter(e => e.phaseId === ph.id)
        const assigned = phEncs.filter(e => e.courtId && e.estimatedStartTime).length
        return { ...ph, encounters: phEncs, assigned, total: phEncs.length }
      })
      // Encounters with no phase
      const noPhase = divEncs.filter(e => !e.phaseId)
      const totalAssigned = divEncs.filter(e => e.courtId && e.estimatedStartTime).length
      return {
        ...div,
        color: divColors[div.id] || COLORS[0],
        phases,
        noPhaseEncounters: noPhase,
        totalEncounters: divEncs.length,
        totalAssigned,
      }
    })
  }, [data, encounters, divColors])

  // ── Actions ────────────────────────────────────────
  const handleAutoAssignAll = async () => {
    try {
      setBusy(true)
      // Use server-side scheduling for each division that has court groups AND encounters
      const results = []
      const skipped = []
      for (const div of data.divisions) {
        // Skip divisions without court groups or without encounters
        const divEncounters = encounters.filter(e => e.divisionId === div.id)
        if (!div.assignedCourtGroups?.length || divEncounters.length === 0) {
          skipped.push(div.name)
          continue
        }
        try {
          const res = await tournamentApi.schedulingGenerate({
            eventId: parseInt(eventId),
            divisionId: div.id,
            clearExisting: true,
            respectPlayerOverlap: true,
          })
          if (res.success) {
            results.push({ div: div.name, ...res.data })
          }
        } catch (err) {
          // Silently skip divisions that can't be scheduled (no encounters, bad config, etc.)
          console.warn(`Auto-schedule skipped ${div.name}:`, err.response?.data?.message || err.message)
          skipped.push(div.name)
        }
      }
      const totalAssigned = results.reduce((s, r) => s + (r.assignedCount || 0), 0)
      const msg = `Scheduled ${totalAssigned} encounters across ${results.length} division${results.length !== 1 ? 's' : ''}`
      if (skipped.length > 0) {
        toast.success(`${msg} (skipped ${skipped.length}: no courts/encounters)`)
      } else {
        toast.success(msg)
      }
      await loadAll()
    } catch (err) {
      toast.error('Auto-schedule failed')
    } finally {
      setBusy(false)
    }
  }

  const handleAutoAssignDivision = async (divisionId) => {
    try {
      setBusy(true)
      const res = await tournamentApi.schedulingGenerate({
        eventId: parseInt(eventId),
        divisionId,
        clearExisting: true,
        respectPlayerOverlap: true,
      })
      if (res.success) {
        const count = res.data?.assignedCount || 0
        const conflicts = res.data?.conflicts?.length || 0
        let msg = `Assigned ${count} encounters`
        if (conflicts > 0) msg += ` (${conflicts} conflict${conflicts !== 1 ? 's' : ''})`
        toast.success(msg)
      }
      await loadAll()
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to auto-schedule division'
      toast.error(msg.includes('No encounters') || msg.includes('No courts')
        ? `Cannot schedule: ${msg}`
        : msg)
    } finally {
      setBusy(false)
    }
  }

  const handleAutoAssignPhase = async (divisionId, phaseId) => {
    try {
      setBusy(true)
      const res = await tournamentApi.schedulingGenerate({
        eventId: parseInt(eventId),
        divisionId,
        phaseId,
        clearExisting: false, // only fill unassigned in this phase
        respectPlayerOverlap: true,
      })
      if (res.success) {
        const count = res.data?.assignedCount || 0
        toast.success(`Phase scheduled: ${count} encounters assigned`)
      }
      await loadAll()
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to schedule phase'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const handleClearDivision = async (divisionId) => {
    if (!confirm('Clear all court and time assignments for this division?')) return
    try {
      setBusy(true)
      await tournamentApi.schedulingClear(divisionId)
      toast.success('Assignments cleared')
      await loadAll()
    } catch (err) {
      toast.error('Failed to clear')
    } finally {
      setBusy(false)
    }
  }

  const handleMoveEncounter = async (encounterId, courtId, startTime) => {
    try {
      setBusy(true)
      const res = await tournamentApi.schedulingMoveEncounter(encounterId, {
        courtId,
        startTime: startTime instanceof Date ? startTime.toISOString() : startTime,
      })
      if (res.success) {
        toast.success(res.data?.hasConflicts ? 'Moved (has conflicts)' : 'Moved')
      }
      setMovingEncounter(null)
      setSelectedEncounter(null)
      await loadAll()
    } catch (err) {
      toast.error('Failed to move encounter')
    } finally {
      setBusy(false)
    }
  }

  const handleAssignCourt = async (encounterId, courtId) => {
    try {
      await tournamentApi.bulkAssignCourtsAndTimes(eventId, [{
        encounterId,
        courtId: courtId || null,
      }])
      await loadAll()
    } catch (err) {
      toast.error('Failed to assign court')
    }
  }

  const handleValidate = async () => {
    try {
      setBusy(true)
      const res = await tournamentApi.validateSchedule(eventId)
      if (res.success) {
        if (res.data.isValid) toast.success('Schedule is valid — no conflicts!')
        else toast.warn(`Found ${res.data.conflictCount} conflict(s)`)
      }
    } catch (err) {
      toast.error('Validation failed')
    } finally {
      setBusy(false)
    }
  }

  const handlePublish = async () => {
    if (!confirm('Publish the schedule? Players will see court assignments and times.')) return
    try {
      setBusy(true)
      await tournamentApi.publishSchedule(eventId)
      toast.success('Schedule published!')
      await loadAll()
    } catch (err) {
      if (err.response?.data?.data?.conflictCount) {
        toast.error(`Cannot publish: ${err.response.data.data.conflictCount} conflicts`)
      } else {
        toast.error(err.response?.data?.message || 'Publish failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleUnpublish = async () => {
    if (!confirm('Unpublish the schedule?')) return
    try {
      setBusy(true)
      await tournamentApi.unpublishSchedule(eventId)
      toast.success('Schedule unpublished')
      await loadAll()
    } catch (err) {
      toast.error('Unpublish failed')
    } finally {
      setBusy(false)
    }
  }

  // Toggle expanded
  const toggleDiv = (id) => {
    setExpandedDivisions(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const expandAll = () => setExpandedDivisions(new Set(data?.divisions?.map(d => d.id) || []))
  const collapseAll = () => setExpandedDivisions(new Set())

  // ── Render ─────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  const isPublished = !!data?.schedulePublishedAt

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── Header ─────────────────────────────────── */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to={`/tournament/${eventId}/manage`} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  Schedule Dashboard
                  {isPublished && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Published
                    </span>
                  )}
                </h1>
                <p className="text-sm text-gray-500">{data?.eventName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* View mode toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 mr-2">
                <button
                  onClick={() => setViewMode('phase')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                    viewMode === 'phase' ? 'bg-white shadow text-purple-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Phase View
                </button>
                <button
                  onClick={() => setViewMode('legacy')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                    viewMode === 'legacy' ? 'bg-white shadow text-purple-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-4 h-4" />
                  Timeline
                </button>
              </div>

              {/* Quick stats */}
              <div className="hidden sm:flex items-center gap-2 mr-2 text-xs">
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                  {stats.assigned} scheduled
                </span>
                {stats.unassigned > 0 && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                    {stats.unassigned} unscheduled
                  </span>
                )}
              </div>
              <button
                onClick={handleAutoAssignAll}
                disabled={busy || viewMode === 'phase'}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium"
                title={viewMode === 'phase' ? 'Use auto-schedule in Phase View instead' : ''}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Auto-Schedule All
              </button>
              <button onClick={handleValidate} disabled={busy}
                className="px-3 py-2 border text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="w-4 h-4" /> Validate
              </button>
              {!isPublished ? (
                <button onClick={handlePublish} disabled={busy}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium">
                  <Eye className="w-4 h-4" /> Publish
                </button>
              ) : (
                <button onClick={handleUnpublish} disabled={busy}
                  className="px-3 py-2 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50 disabled:opacity-50 flex items-center gap-1.5 text-sm">
                  <EyeOff className="w-4 h-4" /> Unpublish
                </button>
              )}
              <button onClick={loadAll} disabled={loading} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Moving indicator bar ───────────────────── */}
      {movingEncounter && (
        <div className="bg-purple-600 text-white px-4 py-2 text-sm flex items-center justify-between sticky top-[60px] z-20">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4" />
            <span>Moving: <strong>{movingEncounter.unit1Name || 'TBD'} vs {movingEncounter.unit2Name || 'TBD'}</strong> — click a time slot on the timeline below</span>
          </div>
          <button onClick={() => setMovingEncounter(null)} className="px-3 py-1 bg-purple-500 hover:bg-purple-400 rounded text-sm">Cancel</button>
        </div>
      )}

      {/* ─── Phase Court Scheduler (New View) ─────────── */}
      {viewMode === 'phase' && (
        <div className="max-w-full mx-auto px-4 py-4">
          <PhaseCourtScheduler
            eventId={eventId}
            data={data}
            onUpdate={loadAll}
          />
        </div>
      )}

      {/* ─── Legacy Timeline View ─────────────────────── */}
      {viewMode === 'legacy' && (
      <div className="max-w-full mx-auto px-4 py-4 space-y-4">
        {/* ─── Quick Controls Bar ───────────────────── */}
        <div className="bg-white rounded-xl border p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterDivision || ''}
              onChange={(e) => setFilterDivision(e.target.value ? parseInt(e.target.value) : null)}
              className="px-2 py-1.5 border rounded-lg text-sm"
            >
              <option value="">All Divisions</option>
              {data?.divisions?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="h-5 w-px bg-gray-200" />
          <button onClick={expandAll} className="text-xs text-gray-500 hover:text-gray-700">Expand All</button>
          <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700">Collapse All</button>
          <div className="h-5 w-px bg-gray-200" />
          <button onClick={() => setShowTimeline(t => !t)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            {showTimeline ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            {showTimeline ? 'Hide' : 'Show'} Timeline
          </button>
          {/* Legend */}
          <div className="flex-1" />
          <div className="flex items-center gap-2 flex-wrap">
            {data?.divisions?.filter(d => !filterDivision || d.id === filterDivision).map(d => {
              const c = divColors[d.id]
              return (
                <div key={d.id} className="flex items-center gap-1">
                  <div className={`w-2.5 h-2.5 rounded-sm ${c?.bg} ${c?.border} border`} />
                  <span className="text-[11px] text-gray-500">{d.name}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── Division / Phase Tree ────────────────── */}
        <div className="space-y-3">
          {divisionTree
            .filter(d => !filterDivision || d.id === filterDivision)
            .map(div => (
              <DivisionCard
                key={div.id}
                div={div}
                expanded={expandedDivisions.has(div.id)}
                onToggle={() => toggleDiv(div.id)}
                allCourts={allCourts}
                onAutoAssign={() => handleAutoAssignDivision(div.id)}
                onAutoAssignPhase={(phaseId) => handleAutoAssignPhase(div.id, phaseId)}
                onClear={() => handleClearDivision(div.id)}
                onAssignCourt={handleAssignCourt}
                onMoveEncounter={(enc) => { setMovingEncounter(enc); setShowTimeline(true) }}
                selectedEncounter={selectedEncounter}
                onSelectEncounter={setSelectedEncounter}
                busy={busy}
              />
            ))}
        </div>

        {/* ─── Timeline (Court × Time grid) ─────────── */}
        {showTimeline && (
          <TimelineGrid
            data={data}
            encounters={filteredEncounters}
            allCourts={allCourts}
            divColors={divColors}
            movingEncounter={movingEncounter}
            selectedEncounter={selectedEncounter}
            onSelectEncounter={setSelectedEncounter}
            onPlaceEncounter={(courtId, time) => {
              if (movingEncounter) handleMoveEncounter(movingEncounter.id, courtId, time)
            }}
          />
        )}
      </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════
// Division Card
// ═════════════════════════════════════════════════════
function DivisionCard({
  div, expanded, onToggle, allCourts,
  onAutoAssign, onAutoAssignPhase, onClear, onAssignCourt,
  onMoveEncounter, selectedEncounter, onSelectEncounter, busy
}) {
  const c = div.color
  const pct = div.totalEncounters > 0 ? Math.round((div.totalAssigned / div.totalEncounters) * 100) : 0

  // Phase expansion
  const [expandedPhases, setExpandedPhases] = useState(new Set())
  const togglePhase = (id) => setExpandedPhases(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  // Calculate total time range for this division
  const divEncounters = [...(div.noPhaseEncounters || []), ...(div.phases?.flatMap(p => p.encounters) || [])]
  const scheduledEncs = divEncounters.filter(e => e.estimatedStartTime)
  const firstTime = scheduledEncs.length ? fmtTime(scheduledEncs.reduce((m, e) =>
    !m || new Date(e.estimatedStartTime) < new Date(m) ? e.estimatedStartTime : m, null)) : null
  const lastEnc = scheduledEncs.length ? scheduledEncs.reduce((m, e) => {
    const end = e.estimatedEndTime || e.estimatedStartTime
    return !m || new Date(end) > new Date(m) ? end : m
  }, null) : null
  const lastTime = lastEnc ? fmtTime(lastEnc) : null

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${expanded ? 'shadow-sm' : ''}`}>
      {/* Division header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        <div className={`w-1.5 h-10 rounded-full ${c.bg} ${c.border} border-2 flex-shrink-0`} />
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> :
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        <div className="flex-1 text-left min-w-0">
          <div className="font-semibold text-gray-900 flex items-center gap-2">
            {div.name}
            {div.matchesPerEncounter > 1 && (
              <span className="text-xs font-normal bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {div.matchesPerEncounter} matches/encounter
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
            <span>{div.totalEncounters} encounters</span>
            <span>{div.phases?.length || 0} phase{(div.phases?.length || 0) !== 1 ? 's' : ''}</span>
            {div.estimatedMatchDurationMinutes && <span>{div.estimatedMatchDurationMinutes}min/game</span>}
            {firstTime && lastTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{firstTime} – {lastTime}</span>}
            {div.assignedCourtGroups?.length > 0 && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{div.assignedCourtGroups.map(g => g.courtGroupName).join(', ')}</span>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-200'}`}
              style={{ width: `${pct}%` }} />
          </div>
          <span className={`text-xs font-medium ${pct === 100 ? 'text-green-600' : 'text-gray-500'}`}>
            {div.totalAssigned}/{div.totalEncounters}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t">
          {/* Actions bar */}
          <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2 flex-wrap">
            <button onClick={onAutoAssign} disabled={busy}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5 text-xs font-medium">
              <Zap className="w-3.5 h-3.5" /> Auto-Schedule Division
            </button>
            <button onClick={onClear} disabled={busy}
              className="px-3 py-1.5 border text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1.5 text-xs">
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
            {!div.assignedCourtGroups?.length && (
              <span className="text-xs text-yellow-600 flex items-center gap-1 ml-2">
                <AlertTriangle className="w-3.5 h-3.5" /> No court groups assigned
              </span>
            )}
          </div>

          {/* Phases */}
          {div.phases.map(phase => (
            <PhaseSection
              key={phase.id}
              phase={phase}
              color={c}
              expanded={expandedPhases.has(phase.id)}
              onToggle={() => togglePhase(phase.id)}
              allCourts={allCourts}
              onAutoAssign={() => onAutoAssignPhase(phase.id)}
              onAssignCourt={onAssignCourt}
              onMoveEncounter={onMoveEncounter}
              selectedEncounter={selectedEncounter}
              onSelectEncounter={onSelectEncounter}
              busy={busy}
            />
          ))}

          {/* No-phase encounters */}
          {div.noPhaseEncounters.length > 0 && (
            <div className="px-4 py-2">
              <div className="text-xs font-medium text-gray-500 mb-2">Encounters (no phase)</div>
              <EncounterTable
                encounters={div.noPhaseEncounters}
                allCourts={allCourts}
                color={c}
                onAssignCourt={onAssignCourt}
                onMoveEncounter={onMoveEncounter}
                selectedEncounter={selectedEncounter}
                onSelectEncounter={onSelectEncounter}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════
// Phase Section
// ═════════════════════════════════════════════════════
function PhaseSection({
  phase, color, expanded, onToggle, allCourts,
  onAutoAssign, onAssignCourt, onMoveEncounter,
  selectedEncounter, onSelectEncounter, busy
}) {
  const pct = phase.total > 0 ? Math.round((phase.assigned / phase.total) * 100) : 0

  // Phase time range
  const startTime = phase.estimatedStartTime ? fmtTime(phase.estimatedStartTime) : null
  const endTime = phase.estimatedEndTime ? fmtTime(phase.estimatedEndTime) : null

  // Estimate encounter duration from the encounters themselves
  const sampleEnc = phase.encounters.find(e => e.estimatedDurationMinutes)
  const encDuration = sampleEnc?.estimatedDurationMinutes

  return (
    <div className="border-t">
      {/* Phase header */}
      <button onClick={onToggle} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50">
        <div className="w-4" /> {/* indent */}
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> :
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
            {phase.name}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${color.bg} ${color.text}`}>
              {phase.phaseType}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
            <span>{phase.total} encounters</span>
            {encDuration && <span>~{fmtDuration(encDuration)}/encounter</span>}
            {startTime && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{startTime}{endTime && ` – ${endTime}`}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!expanded && (
            <button
              onClick={(e) => { e.stopPropagation(); onAutoAssign() }}
              disabled={busy}
              className="px-2 py-1 text-[11px] bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
            >
              <Zap className="w-3 h-3 inline" /> Schedule
            </button>
          )}
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-400' : 'bg-gray-200'}`}
              style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-gray-500 w-10 text-right">{phase.assigned}/{phase.total}</span>
        </div>
      </button>

      {/* Expanded encounters */}
      {expanded && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={onAutoAssign} disabled={busy}
              className="px-2 py-1 text-[11px] bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Auto-Schedule Phase
            </button>
          </div>
          <EncounterTable
            encounters={phase.encounters}
            allCourts={allCourts}
            color={color}
            onAssignCourt={onAssignCourt}
            onMoveEncounter={onMoveEncounter}
            selectedEncounter={selectedEncounter}
            onSelectEncounter={onSelectEncounter}
          />
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════
// Encounter Table (compact rows)
// ═════════════════════════════════════════════════════
function EncounterTable({
  encounters, allCourts, color,
  onAssignCourt, onMoveEncounter,
  selectedEncounter, onSelectEncounter
}) {
  if (!encounters.length) return <div className="text-xs text-gray-400 py-2">No encounters</div>

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 text-gray-500 uppercase">
            <th className="px-2 py-1.5 text-left font-medium w-8">#</th>
            <th className="px-2 py-1.5 text-left font-medium">Matchup</th>
            <th className="px-2 py-1.5 text-left font-medium w-20">Round</th>
            <th className="px-2 py-1.5 text-left font-medium w-16">Status</th>
            <th className="px-2 py-1.5 text-left font-medium w-20">Time</th>
            <th className="px-2 py-1.5 text-left font-medium w-16">Dur.</th>
            <th className="px-2 py-1.5 text-left font-medium w-32">Court</th>
            <th className="px-2 py-1.5 text-center font-medium w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {encounters.map(enc => {
            const isSelected = selectedEncounter?.id === enc.id
            const hasTime = !!enc.estimatedStartTime
            const hasCourt = !!enc.courtId

            return (
              <tr
                key={enc.id}
                className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-purple-50 ring-1 ring-purple-300 ring-inset' : ''}`}
                onClick={() => onSelectEncounter(isSelected ? null : enc)}
              >
                <td className="px-2 py-1.5 text-gray-400">{enc.encounterNumber}</td>
                <td className="px-2 py-1.5">
                  <span className="font-medium text-gray-800">{enc.unit1Name || enc.unit1SeedLabel || 'TBD'}</span>
                  <span className="text-gray-400 mx-1">vs</span>
                  <span className="font-medium text-gray-800">{enc.unit2Name || enc.unit2SeedLabel || 'TBD'}</span>
                </td>
                <td className="px-2 py-1.5 text-gray-500">{enc.roundName || enc.encounterLabel || `R${enc.roundNumber}`}</td>
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    enc.status === 'Completed' ? 'bg-green-100 text-green-700' :
                    enc.status === 'InProgress' ? 'bg-yellow-100 text-yellow-700' :
                    hasCourt && hasTime ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {enc.status === 'Completed' ? '✓' : enc.status === 'InProgress' ? '▶' : hasCourt && hasTime ? 'Sched' : 'Pending'}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-gray-600 font-mono">
                  {hasTime ? fmtTime(enc.estimatedStartTime) : '—'}
                </td>
                <td className="px-2 py-1.5 text-gray-500">
                  {enc.estimatedDurationMinutes ? fmtDuration(enc.estimatedDurationMinutes) : '—'}
                </td>
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={enc.courtId || ''}
                    onChange={(e) => onAssignCourt(enc.id, e.target.value ? parseInt(e.target.value) : null)}
                    className={`w-full px-1.5 py-1 border rounded text-xs ${hasCourt ? 'border-gray-300' : 'border-yellow-300 bg-yellow-50'}`}
                  >
                    <option value="">—</option>
                    {allCourts.map(ct => (
                      <option key={ct.id} value={ct.id}>{ct.courtLabel}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onMoveEncounter(enc)}
                    className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                    title="Move on timeline"
                  >
                    <Move className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ═════════════════════════════════════════════════════
// Timeline Grid (Court × Time)
// ═════════════════════════════════════════════════════
function TimelineGrid({
  data, encounters, allCourts, divColors,
  movingEncounter, selectedEncounter, onSelectEncounter, onPlaceEncounter
}) {
  const gridRef = useRef(null)
  const [increment, setIncrement] = useState(15)

  // Determine time range from scheduled encounters
  const scheduledEncs = encounters.filter(e => e.estimatedStartTime && e.courtId)

  // Fallback time range
  const eventDate = data?.eventStartDate ? new Date(data.eventStartDate) : new Date()
  let minTime = new Date(eventDate); minTime.setHours(7, 0, 0, 0)
  let maxTime = new Date(eventDate); maxTime.setHours(20, 0, 0, 0)

  if (scheduledEncs.length > 0) {
    const times = scheduledEncs.map(e => new Date(e.estimatedStartTime).getTime())
    const endTimes = scheduledEncs.map(e => {
      const end = e.estimatedEndTime || new Date(new Date(e.estimatedStartTime).getTime() + (e.estimatedDurationMinutes || 20) * 60000)
      return new Date(end).getTime()
    })
    const earliest = new Date(Math.min(...times))
    const latest = new Date(Math.max(...endTimes))
    minTime = new Date(earliest); minTime.setMinutes(0, 0, 0); minTime.setHours(minTime.getHours() - 1)
    maxTime = new Date(latest); maxTime.setMinutes(0, 0, 0); maxTime.setHours(maxTime.getHours() + 1)
  }

  // Generate slots
  const slots = useMemo(() => {
    const s = []
    const cur = new Date(minTime)
    while (cur < maxTime) {
      s.push(new Date(cur))
      cur.setMinutes(cur.getMinutes() + increment)
    }
    return s
  }, [minTime.getTime(), maxTime.getTime(), increment])

  const totalMinutes = (maxTime - minTime) / 60000

  // Build court encounter map
  const courtEncMap = useMemo(() => {
    const m = {}
    allCourts.forEach(c => { m[c.id] = [] })
    scheduledEncs.forEach(enc => {
      if (m[enc.courtId]) m[enc.courtId].push(enc)
    })
    return m
  }, [scheduledEncs, allCourts])

  if (allCourts.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No courts configured for this event</p>
      </div>
    )
  }

  const COURT_W = 120
  const SLOT_H = 36

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
          <Grid3X3 className="w-4 h-4" /> Court Timeline
        </h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Grid:</label>
          <select value={increment} onChange={(e) => setIncrement(parseInt(e.target.value))}
            className="px-2 py-1 text-xs border rounded">
            <option value={10}>10m</option>
            <option value={15}>15m</option>
            <option value={30}>30m</option>
            <option value={60}>1h</option>
          </select>
        </div>
      </div>

      <div className="overflow-auto max-h-[50vh]" ref={gridRef}>
        <div style={{ minWidth: `${COURT_W + allCourts.length * COURT_W}px` }}>
          {/* Header */}
          <div className="flex sticky top-0 z-10 bg-white border-b">
            <div className="flex-shrink-0 px-2 py-2 bg-gray-50 border-r text-xs font-medium text-gray-600 sticky left-0 z-20"
              style={{ width: COURT_W }}>
              Time
            </div>
            {allCourts.map(court => (
              <div key={court.id}
                className="px-2 py-2 bg-gray-50 border-r text-xs font-medium text-gray-700 text-center truncate"
                style={{ width: COURT_W, minWidth: COURT_W }}>
                {court.courtLabel}
              </div>
            ))}
          </div>

          {/* Rows */}
          {slots.map((slot, si) => {
            const isHour = slot.getMinutes() === 0
            return (
              <div key={si} className={`flex ${isHour ? 'border-t border-gray-300' : 'border-t border-gray-50'}`}
                style={{ height: SLOT_H }}>
                <div className={`flex-shrink-0 px-2 flex items-center text-[11px] border-r sticky left-0 bg-white z-10 ${isHour ? 'font-medium text-gray-700' : 'text-gray-300'}`}
                  style={{ width: COURT_W }}>
                  {isHour || si === 0 ? fmtTime(slot) : ''}
                </div>
                {allCourts.map(court => {
                  const cellStart = slot.getTime()
                  const cellEnd = cellStart + increment * 60000
                  const courtEncs = courtEncMap[court.id] || []

                  // Encounter starting in this slot
                  const startingEnc = courtEncs.find(e => {
                    const st = new Date(e.estimatedStartTime).getTime()
                    return st >= cellStart && st < cellEnd
                  })

                  // Encounter spanning this slot
                  const spanningEnc = !startingEnc && courtEncs.find(e => {
                    const st = new Date(e.estimatedStartTime).getTime()
                    const et = e.estimatedEndTime ? new Date(e.estimatedEndTime).getTime() :
                      st + (e.estimatedDurationMinutes || 20) * 60000
                    return st < cellStart && et > cellStart
                  })

                  if (startingEnc) {
                    const color = divColors[startingEnc.divisionId] || COLORS[0]
                    const dur = startingEnc.estimatedDurationMinutes || 20
                    const spans = Math.max(1, Math.ceil(dur / increment))
                    const isSelected = selectedEncounter?.id === startingEnc.id

                    return (
                      <div key={court.id} className="border-r relative"
                        style={{ width: COURT_W, minWidth: COURT_W }}>
                        <div
                          className={`absolute inset-x-0.5 top-0.5 rounded px-1.5 py-0.5 cursor-pointer
                            ${color.bg} ${color.border} border overflow-hidden
                            ${isSelected ? 'ring-2 ring-purple-500 ring-offset-1 shadow-md z-10' : 'hover:shadow-sm'}
                          `}
                          style={{ height: `${spans * SLOT_H - 4}px`, zIndex: isSelected ? 5 : 2 }}
                          onClick={() => onSelectEncounter(isSelected ? null : startingEnc)}
                          title={`${startingEnc.unit1Name || 'TBD'} vs ${startingEnc.unit2Name || 'TBD'}\n${fmtTime(startingEnc.estimatedStartTime)} – ${fmtTime(startingEnc.estimatedEndTime)}\n${fmtDuration(dur)}`}
                        >
                          <div className={`text-[10px] font-semibold truncate leading-tight ${color.text}`}>
                            {(startingEnc.unit1Name || 'TBD').split('/')[0]?.split(' ')[0]} vs {(startingEnc.unit2Name || 'TBD').split('/')[0]?.split(' ')[0]}
                          </div>
                          {spans > 1 && (
                            <div className={`text-[9px] ${color.text} opacity-70 truncate`}>
                              {startingEnc.phaseName || startingEnc.roundName || ''}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  if (spanningEnc) {
                    return <div key={court.id} className="border-r" style={{ width: COURT_W, minWidth: COURT_W }} />
                  }

                  // Empty — clickable for placing
                  return (
                    <div key={court.id}
                      className={`border-r transition-colors ${movingEncounter ? 'hover:bg-purple-50 cursor-crosshair' : 'hover:bg-gray-50'}`}
                      style={{ width: COURT_W, minWidth: COURT_W }}
                      onClick={() => movingEncounter && onPlaceEncounter(court.id, slot)}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
