import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Plus, Trash2, Edit2, Check, X, Users, Calendar,
  Clock, Save, RefreshCw, ChevronDown, ChevronRight, Grid3X3, List,
  Play, AlertCircle, Loader2, Settings, Layers, LayoutGrid
} from 'lucide-react'
import { tournamentApi } from '../services/api'
import { useToast } from '../contexts/ToastContext'

export default function CourtPlanning() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState(null)

  // View states
  const [activeTab, setActiveTab] = useState('schedule') // 'groups', 'divisions', 'schedule', 'timeline'
  const [selectedDivision, setSelectedDivision] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list', 'grid', 'timeline'

  // Editing states
  const [editingGroup, setEditingGroup] = useState(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedEncounters, setSelectedEncounters] = useState(new Set())

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await tournamentApi.getCourtPlanningData(eventId)
      if (res.success) {
        setData(res.data)
        if (!selectedDivision && res.data.divisions.length > 0) {
          setSelectedDivision(res.data.divisions[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading court planning data:', err)
      toast.error('Failed to load court planning data')
    } finally {
      setLoading(false)
    }
  }, [eventId, selectedDivision])

  useEffect(() => {
    loadData()
  }, [eventId])

  // Get all courts (grouped + ungrouped)
  const allCourts = [
    ...(data?.courtGroups?.flatMap(g => g.courts) || []),
    ...(data?.unassignedCourts || [])
  ]

  // Filter encounters by division
  const filteredEncounters = selectedDivision
    ? data?.encounters?.filter(e => e.divisionId === selectedDivision && !e.isBye) || []
    : data?.encounters?.filter(e => !e.isBye) || []

  // Group encounters by round
  const encountersByRound = filteredEncounters.reduce((acc, enc) => {
    const key = `${enc.roundType}-${enc.roundNumber}`
    if (!acc[key]) {
      acc[key] = {
        roundType: enc.roundType,
        roundNumber: enc.roundNumber,
        roundName: enc.roundName,
        encounters: []
      }
    }
    acc[key].encounters.push(enc)
    return acc
  }, {})

  // Court group handlers
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return

    try {
      setSaving(true)
      await tournamentApi.createCourtGroup({
        eventId: parseInt(eventId),
        groupName: newGroupName.trim()
      })
      toast.success('Court group created')
      setNewGroupName('')
      loadData()
    } catch (err) {
      toast.error('Failed to create court group')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Delete this court group? Courts will be unassigned.')) return

    try {
      await tournamentApi.deleteCourtGroup(groupId)
      toast.success('Court group deleted')
      loadData()
    } catch (err) {
      toast.error('Failed to delete court group')
    }
  }

  const handleAssignCourtToGroup = async (courtId, groupId) => {
    try {
      const group = data.courtGroups.find(g => g.id === groupId)
      const courtIds = groupId
        ? [...(group?.courts?.map(c => c.id) || []), courtId]
        : []

      if (groupId) {
        await tournamentApi.assignCourtsToGroup(groupId, courtIds)
      }
      toast.success('Court assigned')
      loadData()
    } catch (err) {
      toast.error('Failed to assign court')
    }
  }

  // Division court group assignment
  const handleAssignGroupToDivision = async (divisionId, groupIds) => {
    try {
      await tournamentApi.assignCourtGroupsToDivision(divisionId, groupIds)
      toast.success('Court groups assigned to division')
      loadData()
    } catch (err) {
      toast.error('Failed to assign court groups')
    }
  }

  // Encounter court assignment
  const handleAssignCourtToEncounter = async (encounterId, courtId) => {
    try {
      await tournamentApi.preAssignCourt(encounterId, courtId)
      toast.success(courtId ? 'Court assigned' : 'Court cleared')
      loadData()
    } catch (err) {
      toast.error('Failed to assign court')
    }
  }

  // Bulk operations
  const handleBulkAssign = async (courtId) => {
    if (selectedEncounters.size === 0) return

    try {
      setSaving(true)
      const assignments = Array.from(selectedEncounters).map(encId => ({
        encounterId: encId,
        courtId: courtId || null
      }))
      await tournamentApi.bulkAssignCourtsAndTimes(eventId, assignments)
      toast.success(`${assignments.length} encounters updated`)
      setSelectedEncounters(new Set())
      loadData()
    } catch (err) {
      toast.error('Failed to bulk assign courts')
    } finally {
      setSaving(false)
    }
  }

  // Auto-assign for division
  const handleAutoAssign = async () => {
    if (!selectedDivision) return

    try {
      setSaving(true)
      const division = data.divisions.find(d => d.id === selectedDivision)
      const startTime = data.eventStartDate ? new Date(data.eventStartDate) : new Date()
      startTime.setHours(8, 0, 0, 0)

      const res = await tournamentApi.autoAssignDivisionCourts(selectedDivision, {
        startTime: startTime.toISOString(),
        matchDurationMinutes: division?.estimatedMatchDurationMinutes || 20,
        clearExisting: true
      })

      if (res.success) {
        toast.success(res.message || 'Courts auto-assigned')
        loadData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to auto-assign courts')
    } finally {
      setSaving(false)
    }
  }

  // Clear assignments
  const handleClearAssignments = async () => {
    if (!selectedDivision) return
    if (!confirm('Clear all court and time assignments for this division?')) return

    try {
      setSaving(true)
      await tournamentApi.clearDivisionCourtAssignments(selectedDivision)
      toast.success('Assignments cleared')
      loadData()
    } catch (err) {
      toast.error('Failed to clear assignments')
    } finally {
      setSaving(false)
    }
  }

  // Toggle encounter selection
  const toggleEncounterSelection = (encId) => {
    setSelectedEncounters(prev => {
      const next = new Set(prev)
      if (next.has(encId)) {
        next.delete(encId)
      } else {
        next.add(encId)
      }
      return next
    })
  }

  // Select all/none
  const selectAllEncounters = () => {
    if (selectedEncounters.size === filteredEncounters.length) {
      setSelectedEncounters(new Set())
    } else {
      setSelectedEncounters(new Set(filteredEncounters.map(e => e.id)))
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to={`/events/${eventId}/manage`}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Court Planning</h1>
                <p className="text-sm text-gray-500">{data?.eventName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-4 overflow-x-auto">
            {[
              { key: 'schedule', label: 'Schedule', icon: Calendar },
              { key: 'groups', label: 'Court Groups', icon: Layers },
              { key: 'divisions', label: 'Division Assignment', icon: Grid3X3 },
              { key: 'timeline', label: 'Timeline', icon: Clock }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'groups' && (
          <CourtGroupsTab
            data={data}
            newGroupName={newGroupName}
            setNewGroupName={setNewGroupName}
            onCreateGroup={handleCreateGroup}
            onDeleteGroup={handleDeleteGroup}
            onAssignCourt={handleAssignCourtToGroup}
            saving={saving}
          />
        )}

        {activeTab === 'divisions' && (
          <DivisionAssignmentTab
            data={data}
            onAssignGroups={handleAssignGroupToDivision}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleTab
            data={data}
            allCourts={allCourts}
            filteredEncounters={filteredEncounters}
            encountersByRound={encountersByRound}
            selectedDivision={selectedDivision}
            setSelectedDivision={setSelectedDivision}
            selectedEncounters={selectedEncounters}
            toggleEncounterSelection={toggleEncounterSelection}
            selectAllEncounters={selectAllEncounters}
            onAssignCourt={handleAssignCourtToEncounter}
            onBulkAssign={handleBulkAssign}
            onAutoAssign={handleAutoAssign}
            onClearAssignments={handleClearAssignments}
            saving={saving}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineTab
            data={data}
            allCourts={allCourts}
            selectedDivision={selectedDivision}
            setSelectedDivision={setSelectedDivision}
          />
        )}
      </div>
    </div>
  )
}

// =====================================================
// Court Groups Tab
// =====================================================
function CourtGroupsTab({ data, newGroupName, setNewGroupName, onCreateGroup, onDeleteGroup, onAssignCourt, saving }) {
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Create new group */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-medium text-gray-900 mb-3">Create Court Group</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name (e.g., Courts 1-4, North Side)"
            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && onCreateGroup()}
          />
          <button
            onClick={onCreateGroup}
            disabled={saving || !newGroupName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Court groups let you assign related courts together to divisions (e.g., assign "North Courts" to Division A).
        </p>
      </div>

      {/* Existing groups */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-medium text-gray-900">Court Groups ({data?.courtGroups?.length || 0})</h3>
        </div>
        <div className="divide-y">
          {data?.courtGroups?.map(group => (
            <div key={group.id} className="p-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {expandedGroups.has(group.id) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-medium text-sm">
                    {group.groupCode || group.id}
                  </div>
                  <div>
                    <div className="font-medium">{group.groupName}</div>
                    <div className="text-sm text-gray-500">
                      {group.courtCount} court{group.courtCount !== 1 ? 's' : ''}
                      {group.locationArea && ` • ${group.locationArea}`}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => onDeleteGroup(group.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  title="Delete group"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {expandedGroups.has(group.id) && (
                <div className="mt-3 ml-10 flex flex-wrap gap-2">
                  {group.courts.map(court => (
                    <span
                      key={court.id}
                      className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm flex items-center gap-2"
                    >
                      <MapPin className="w-3 h-3 text-gray-400" />
                      {court.courtLabel}
                    </span>
                  ))}
                  {group.courts.length === 0 && (
                    <span className="text-gray-400 text-sm">No courts assigned</span>
                  )}
                </div>
              )}
            </div>
          ))}
          {data?.courtGroups?.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Layers className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p>No court groups yet</p>
              <p className="text-sm">Create groups to organize your courts</p>
            </div>
          )}
        </div>
      </div>

      {/* Unassigned courts */}
      {data?.unassignedCourts?.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 bg-yellow-50 border-b">
            <h3 className="font-medium text-yellow-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Unassigned Courts ({data.unassignedCourts.length})
            </h3>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {data.unassignedCourts.map(court => (
                <div
                  key={court.id}
                  className="px-3 py-2 bg-gray-50 rounded-lg flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{court.courtLabel}</span>
                  {data.courtGroups.length > 0 && (
                    <select
                      onChange={(e) => onAssignCourt(court.id, parseInt(e.target.value))}
                      className="ml-2 text-sm border rounded px-2 py-1"
                      defaultValue=""
                    >
                      <option value="" disabled>Assign to...</option>
                      {data.courtGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.groupName}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =====================================================
// Division Assignment Tab
// =====================================================
function DivisionAssignmentTab({ data, onAssignGroups }) {
  const [assignments, setAssignments] = useState({})

  // Initialize assignments from data
  useEffect(() => {
    if (data?.divisions) {
      const initial = {}
      data.divisions.forEach(div => {
        initial[div.id] = div.assignedCourtGroups?.map(a => a.courtGroupId) || []
      })
      setAssignments(initial)
    }
  }, [data?.divisions])

  const toggleGroupForDivision = (divisionId, groupId) => {
    setAssignments(prev => {
      const current = prev[divisionId] || []
      const next = current.includes(groupId)
        ? current.filter(id => id !== groupId)
        : [...current, groupId]
      return { ...prev, [divisionId]: next }
    })
  }

  const saveAssignment = async (divisionId) => {
    await onAssignGroups(divisionId, assignments[divisionId] || [])
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-medium text-blue-800 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Division Court Assignment
        </h3>
        <p className="text-sm text-blue-700 mt-1">
          Assign court groups to divisions. When auto-assigning courts, only courts from assigned groups will be used.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data?.divisions?.map(division => {
          const currentAssignments = assignments[division.id] || []
          const hasChanges = JSON.stringify(currentAssignments.sort()) !==
            JSON.stringify((division.assignedCourtGroups?.map(a => a.courtGroupId) || []).sort())

          return (
            <div key={division.id} className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{division.name}</h3>
                    <p className="text-sm text-gray-500">
                      {division.unitCount} teams • {division.encounterCount} matches
                    </p>
                  </div>
                  {hasChanges && (
                    <button
                      onClick={() => saveAssignment(division.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </button>
                  )}
                </div>
              </div>
              <div className="p-4">
                {data.courtGroups.length === 0 ? (
                  <p className="text-gray-500 text-sm">Create court groups first</p>
                ) : (
                  <div className="space-y-2">
                    {data.courtGroups.map(group => (
                      <label
                        key={group.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          currentAssignments.includes(group.id)
                            ? 'bg-blue-50 border border-blue-200'
                            : 'bg-gray-50 border border-transparent hover:border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={currentAssignments.includes(group.id)}
                          onChange={() => toggleGroupForDivision(division.id, group.id)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{group.groupName}</div>
                          <div className="text-xs text-gray-500">
                            {group.courtCount} court{group.courtCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =====================================================
// Schedule Tab
// =====================================================
function ScheduleTab({
  data, allCourts, filteredEncounters, encountersByRound,
  selectedDivision, setSelectedDivision,
  selectedEncounters, toggleEncounterSelection, selectAllEncounters,
  onAssignCourt, onBulkAssign, onAutoAssign, onClearAssignments,
  saving, viewMode, setViewMode
}) {
  const [expandedRounds, setExpandedRounds] = useState(new Set())

  // Auto-expand all rounds initially
  useEffect(() => {
    setExpandedRounds(new Set(Object.keys(encountersByRound)))
  }, [selectedDivision])

  const toggleRound = (key) => {
    setExpandedRounds(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const assignedCount = filteredEncounters.filter(e => e.courtId).length
  const totalCount = filteredEncounters.length

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Division:</label>
            <select
              value={selectedDivision || ''}
              onChange={(e) => setSelectedDivision(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Divisions</option>
              {data?.divisions?.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {assignedCount}/{totalCount} assigned
            </span>
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <button
            onClick={onAutoAssign}
            disabled={saving || !selectedDivision}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Auto-Assign Courts
          </button>
          <button
            onClick={onClearAssignments}
            disabled={saving || !selectedDivision}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>

          {selectedEncounters.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-600">{selectedEncounters.size} selected</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onBulkAssign(e.target.value === 'clear' ? null : parseInt(e.target.value))
                    e.target.value = ''
                  }
                }}
                className="px-3 py-2 border rounded-lg text-sm"
                defaultValue=""
              >
                <option value="" disabled>Bulk assign to...</option>
                <option value="clear">Clear assignment</option>
                {allCourts.map(c => (
                  <option key={c.id} value={c.id}>{c.courtLabel}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Schedule list */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {Object.entries(encountersByRound).map(([key, round]) => (
            <div key={key} className="bg-white rounded-xl border overflow-hidden">
              <button
                onClick={() => toggleRound(key)}
                className="w-full px-4 py-3 bg-gray-50 border-b flex items-center justify-between hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  {expandedRounds.has(key) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-medium">
                    {round.roundName || `${round.roundType} Round ${round.roundNumber}`}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({round.encounters.length} match{round.encounters.length !== 1 ? 'es' : ''})
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {round.encounters.filter(e => e.courtId).length}/{round.encounters.length} assigned
                </span>
              </button>

              {expandedRounds.has(key) && (
                <div className="divide-y">
                  <div className="px-4 py-2 bg-gray-50/50 flex items-center gap-4 text-xs font-medium text-gray-500 uppercase">
                    <input
                      type="checkbox"
                      checked={round.encounters.every(e => selectedEncounters.has(e.id))}
                      onChange={() => {
                        const allSelected = round.encounters.every(e => selectedEncounters.has(e.id))
                        if (allSelected) {
                          round.encounters.forEach(e => selectedEncounters.delete(e.id))
                        } else {
                          round.encounters.forEach(e => selectedEncounters.add(e.id))
                        }
                        // Trigger re-render
                        toggleEncounterSelection(round.encounters[0].id)
                        toggleEncounterSelection(round.encounters[0].id)
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="w-8">#</span>
                    <span className="flex-1">Match</span>
                    <span className="w-32">Time</span>
                    <span className="w-40">Court</span>
                  </div>
                  {round.encounters.map(enc => (
                    <EncounterRow
                      key={enc.id}
                      encounter={enc}
                      courts={allCourts}
                      selected={selectedEncounters.has(enc.id)}
                      onToggleSelect={() => toggleEncounterSelection(enc.id)}
                      onAssignCourt={(courtId) => onAssignCourt(enc.id, courtId)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <input
                      type="checkbox"
                      checked={selectedEncounters.size === filteredEncounters.length && filteredEncounters.length > 0}
                      onChange={selectAllEncounters}
                      className="w-4 h-4 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Round</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Court</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEncounters.map(enc => (
                  <tr key={enc.id} className={selectedEncounters.has(enc.id) ? 'bg-blue-50' : ''}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedEncounters.has(enc.id)}
                        onChange={() => toggleEncounterSelection(enc.id)}
                        className="w-4 h-4 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{enc.encounterNumber}</td>
                    <td className="px-4 py-3 text-sm">{enc.roundName || `R${enc.roundNumber}`}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{enc.unit1Name || 'TBD'}</div>
                      <div className="text-sm text-gray-500">vs {enc.unit2Name || 'TBD'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {enc.estimatedStartTime && new Date(enc.estimatedStartTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={enc.courtId || ''}
                        onChange={(e) => onAssignCourt(enc.id, e.target.value ? parseInt(e.target.value) : null)}
                        className="px-2 py-1 text-sm border rounded-lg w-32"
                      >
                        <option value="">No Court</option>
                        {allCourts.map(c => (
                          <option key={c.id} value={c.id}>{c.courtLabel}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredEncounters.length === 0 && (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No matches found</p>
          <p className="text-sm text-gray-400">Generate a schedule first</p>
        </div>
      )}
    </div>
  )
}

// =====================================================
// Encounter Row Component
// =====================================================
function EncounterRow({ encounter, courts, selected, onToggleSelect, onAssignCourt }) {
  return (
    <div className={`px-4 py-3 flex items-center gap-4 hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="w-4 h-4 rounded"
      />
      <span className="w-8 text-sm text-gray-400">#{encounter.encounterNumber}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{encounter.unit1Name || 'TBD'}</span>
          <span className="text-gray-400">vs</span>
          <span className="font-medium truncate">{encounter.unit2Name || 'TBD'}</span>
        </div>
        {encounter.encounterLabel && (
          <span className="text-xs text-gray-400">{encounter.encounterLabel}</span>
        )}
      </div>
      <div className="w-32 text-sm text-gray-500">
        {encounter.estimatedStartTime && new Date(encounter.estimatedStartTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit'
        })}
      </div>
      <select
        value={encounter.courtId || ''}
        onChange={(e) => onAssignCourt(e.target.value ? parseInt(e.target.value) : null)}
        className="w-40 px-2 py-1.5 text-sm border rounded-lg"
      >
        <option value="">No Court</option>
        {courts.map(c => (
          <option key={c.id} value={c.id}>{c.courtLabel}</option>
        ))}
      </select>
    </div>
  )
}

// =====================================================
// Timeline Tab
// =====================================================
function TimelineTab({ data, allCourts, selectedDivision, setSelectedDivision }) {
  // Get encounters with times assigned
  const encounters = selectedDivision
    ? data?.encounters?.filter(e => e.divisionId === selectedDivision && !e.isBye)
    : data?.encounters?.filter(e => !e.isBye)

  const scheduledEncounters = encounters?.filter(e => e.estimatedStartTime || e.scheduledTime) || []

  // Group by court
  const byCourt = allCourts.reduce((acc, court) => {
    acc[court.id] = {
      court,
      encounters: scheduledEncounters.filter(e => e.courtId === court.id)
        .sort((a, b) => new Date(a.estimatedStartTime || a.scheduledTime) - new Date(b.estimatedStartTime || b.scheduledTime))
    }
    return acc
  }, {})

  // Find time range
  let minTime = null, maxTime = null
  scheduledEncounters.forEach(e => {
    const time = new Date(e.estimatedStartTime || e.scheduledTime)
    if (!minTime || time < minTime) minTime = time
    if (!maxTime || time > maxTime) maxTime = time
  })

  if (minTime) {
    minTime = new Date(minTime)
    minTime.setMinutes(0, 0, 0)
  }
  if (maxTime) {
    maxTime = new Date(maxTime)
    maxTime.setHours(maxTime.getHours() + 1, 0, 0, 0)
  }

  // Generate time slots
  const timeSlots = []
  if (minTime && maxTime) {
    const current = new Date(minTime)
    while (current <= maxTime) {
      timeSlots.push(new Date(current))
      current.setMinutes(current.getMinutes() + 30)
    }
  }

  return (
    <div className="space-y-4">
      {/* Division filter */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Division:</label>
          <select
            value={selectedDivision || ''}
            onChange={(e) => setSelectedDivision(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Divisions</option>
            {data?.divisions?.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {scheduledEncounters.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No scheduled matches</p>
          <p className="text-sm text-gray-400">Auto-assign courts to generate a timeline</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Timeline header */}
              <div className="flex border-b bg-gray-50">
                <div className="w-32 flex-shrink-0 px-4 py-3 font-medium text-sm text-gray-700">
                  Court
                </div>
                <div className="flex-1 flex">
                  {timeSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className="flex-1 min-w-[80px] px-2 py-3 text-center text-xs text-gray-500 border-l"
                    >
                      {slot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Court rows */}
              {allCourts.map(court => {
                const courtEncounters = byCourt[court.id]?.encounters || []

                return (
                  <div key={court.id} className="flex border-b last:border-0">
                    <div className="w-32 flex-shrink-0 px-4 py-3 font-medium text-sm bg-gray-50 border-r">
                      {court.courtLabel}
                    </div>
                    <div className="flex-1 relative min-h-[60px]">
                      {/* Time grid */}
                      <div className="absolute inset-0 flex">
                        {timeSlots.map((_, idx) => (
                          <div key={idx} className="flex-1 border-l border-gray-100" />
                        ))}
                      </div>
                      {/* Encounters */}
                      {courtEncounters.map(enc => {
                        const startTime = new Date(enc.estimatedStartTime || enc.scheduledTime)
                        const duration = data?.divisions?.find(d => d.id === enc.divisionId)?.estimatedMatchDurationMinutes || 20
                        const totalMinutes = (maxTime - minTime) / 60000
                        const startOffset = ((startTime - minTime) / 60000) / totalMinutes * 100
                        const width = Math.min((duration / totalMinutes) * 100, 100 - startOffset)

                        return (
                          <div
                            key={enc.id}
                            className="absolute top-1 bottom-1 bg-blue-100 border border-blue-300 rounded px-2 py-1 overflow-hidden text-xs"
                            style={{
                              left: `${startOffset}%`,
                              width: `${width}%`,
                              minWidth: '60px'
                            }}
                            title={`${enc.unit1Name || 'TBD'} vs ${enc.unit2Name || 'TBD'}`}
                          >
                            <div className="font-medium truncate text-blue-700">
                              {enc.unit1Name?.split(' ')[0] || '?'} vs {enc.unit2Name?.split(' ')[0] || '?'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
