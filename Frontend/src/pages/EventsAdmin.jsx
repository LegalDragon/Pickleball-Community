import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { eventsApi, eventTypesApi, venuesApi } from '../services/api'
import {
  Search, Calendar, MapPin, Building2, Users, Filter, ChevronDown, ChevronUp,
  Edit2, ExternalLink, Eye, EyeOff, Check, X, RefreshCw, AlertTriangle, Clock
} from 'lucide-react'

const EventsAdmin = ({ embedded = false }) => {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Search and filter state
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [isPublished, setIsPublished] = useState('')
  const [hasVenue, setHasVenue] = useState('')
  const [eventTypeId, setEventTypeId] = useState('')
  const [sortBy, setSortBy] = useState('startdate')
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // Edit modal state
  const [editingEvent, setEditingEvent] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Reference data
  const [eventTypes, setEventTypes] = useState([])
  const [venues, setVenues] = useState([])

  // Load reference data
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [typesRes, venuesRes] = await Promise.all([
          eventTypesApi.list(),
          venuesApi.list()
        ])
        if (typesRes.success) setEventTypes(typesRes.data || [])
        if (venuesRes.success) setVenues(venuesRes.data || [])
      } catch (err) {
        console.error('Error loading reference data:', err)
      }
    }
    loadReferenceData()
  }, [])

  // Load events
  const loadEvents = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        search: search || undefined,
        status: status || undefined,
        isPublished: isPublished !== '' ? isPublished === 'true' : undefined,
        hasVenue: hasVenue !== '' ? hasVenue === 'true' : undefined,
        eventTypeId: eventTypeId || undefined,
        sortBy,
        sortDesc,
        page,
        pageSize
      }
      const response = await eventsApi.adminSearch(params)
      if (response.success) {
        setEvents(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
        setTotalPages(response.data.totalPages || 0)
      } else {
        setError(response.message || 'Failed to load events')
      }
    } catch (err) {
      setError(err.message || 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [status, isPublished, hasVenue, eventTypeId, sortBy, sortDesc, page])

  // Search on enter
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      setPage(1)
      loadEvents()
    }
  }

  // Helper to extract date and time from ISO date string
  const extractDateTime = (isoString) => {
    if (!isoString) return { date: '', time: '' }
    try {
      const dt = new Date(isoString)
      const date = dt.toISOString().split('T')[0]
      const time = dt.toTimeString().slice(0, 5)
      return { date, time }
    } catch {
      return { date: '', time: '' }
    }
  }

  // Open edit modal
  const handleEdit = async (eventId) => {
    try {
      const response = await eventsApi.adminGet(eventId)
      if (response.success) {
        const regOpen = extractDateTime(response.data.registrationOpenDate)
        const regClose = extractDateTime(response.data.registrationCloseDate)
        setEditingEvent(response.data)
        setEditForm({
          name: response.data.name || '',
          description: response.data.description || '',
          eventTypeId: response.data.eventTypeId || '',
          isPublished: response.data.isPublished || false,
          isActive: response.data.isActive || false,
          isPrivate: response.data.isPrivate || false,
          tournamentStatus: response.data.tournamentStatus || '',
          venueId: response.data.venueId || '',
          venueName: response.data.venueName || '',
          address: response.data.address || '',
          city: response.data.city || '',
          state: response.data.state || '',
          country: response.data.country || '',
          registrationFee: response.data.registrationFee || 0,
          perDivisionFee: response.data.perDivisionFee || 0,
          registrationOpenDate: regOpen.date,
          registrationOpenTime: regOpen.time || '00:00',
          registrationCloseDate: regClose.date,
          registrationCloseTime: regClose.time || '23:59'
        })
      }
    } catch (err) {
      setError('Failed to load event details')
    }
  }

  // Save event
  const handleSave = async () => {
    if (!editingEvent) return
    setSaving(true)
    try {
      // Registration dates (optional)
      const registrationOpenDate = editForm.registrationOpenDate
        ? `${editForm.registrationOpenDate}T${editForm.registrationOpenTime || '00:00'}:00`
        : null
      const registrationCloseDate = editForm.registrationCloseDate
        ? `${editForm.registrationCloseDate}T${editForm.registrationCloseTime || '23:59'}:00`
        : null

      const updateData = {
        name: editForm.name,
        description: editForm.description,
        eventTypeId: editForm.eventTypeId ? parseInt(editForm.eventTypeId) : null,
        isPublished: editForm.isPublished,
        isActive: editForm.isActive,
        isPrivate: editForm.isPrivate,
        tournamentStatus: editForm.tournamentStatus || null,
        venueId: editForm.venueId ? parseInt(editForm.venueId) : null,
        venueName: editForm.venueName || null,
        address: editForm.address || null,
        city: editForm.city || null,
        state: editForm.state || null,
        country: editForm.country || null,
        registrationFee: editForm.registrationFee ? parseFloat(editForm.registrationFee) : 0,
        perDivisionFee: editForm.perDivisionFee ? parseFloat(editForm.perDivisionFee) : 0,
        registrationOpenDate,
        registrationCloseDate
      }
      const response = await eventsApi.adminUpdate(editingEvent.id, updateData)
      if (response.success) {
        setEditingEvent(null)
        loadEvents()
      } else {
        setError(response.message || 'Failed to save event')
      }
    } catch (err) {
      setError(err.message || 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  // Handle venue selection
  const handleVenueChange = (venueId) => {
    if (venueId) {
      const venue = venues.find(v => v.id === parseInt(venueId))
      if (venue) {
        setEditForm(prev => ({
          ...prev,
          venueId: venue.id,
          venueName: venue.name,
          address: venue.address || '',
          city: venue.city || '',
          state: venue.state || '',
          country: venue.country || ''
        }))
        return
      }
    }
    setEditForm(prev => ({ ...prev, venueId: '' }))
  }

  // Status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800'
      case 'RegistrationOpen': return 'bg-green-100 text-green-800'
      case 'RegistrationClosed': return 'bg-yellow-100 text-yellow-800'
      case 'Drawing': return 'bg-purple-100 text-purple-800'
      case 'Running': return 'bg-blue-100 text-blue-800'
      case 'Completed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Sort column
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDesc(!sortDesc)
    } else {
      setSortBy(column)
      setSortDesc(true)
    }
  }

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return null
    return sortDesc ? <ChevronDown className="w-4 h-4 inline ml-1" /> : <ChevronUp className="w-4 h-4 inline ml-1" />
  }

  return (
    <div className={embedded ? '' : 'max-w-7xl mx-auto p-6'}>
      {!embedded && (
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Events Management</h1>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search events, venues, organizers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Refresh */}
          <button
            onClick={loadEvents}
            disabled={loading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="RegistrationOpen">Registration Open</option>
                <option value="RegistrationClosed">Registration Closed</option>
                <option value="ScheduleReady">Schedule Ready</option>
                <option value="Drawing">Drawing</option>
                <option value="Running">Running</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Published</label>
              <select
                value={isPublished}
                onChange={(e) => { setIsPublished(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="true">Published</option>
                <option value="false">Not Published</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Has Venue</label>
              <select
                value={hasVenue}
                onChange={(e) => { setHasVenue(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="true">Has Venue</option>
                <option value="false">No Venue</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
              <select
                value={eventTypeId}
                onChange={(e) => { setEventTypeId(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {eventTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-gray-600 mb-2">
        {totalCount} event{totalCount !== 1 ? 's' : ''} found
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  Event <SortIcon column="name" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('startdate')}
                >
                  Date <SortIcon column="startdate" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Venue
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon column="status" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Published
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organizer
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading events...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    No events found
                  </td>
                </tr>
              ) : (
                events.map(event => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{event.name}</div>
                      <div className="text-sm text-gray-500">{event.eventTypeName}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(event.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {event.venueId ? (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 text-green-600" />
                          <span>{event.venueName}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-sm text-orange-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span>No venue</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(event.tournamentStatus)}`}>
                        {event.tournamentStatus || 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {event.isPublished ? (
                        <Eye className="w-4 h-4 text-green-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {event.organizerName || event.clubName || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(event.id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/event/${event.id}`)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="View"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Event</h2>
              <button
                onClick={() => setEditingEvent(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                <select
                  value={editForm.eventTypeId}
                  onChange={(e) => setEditForm(prev => ({ ...prev, eventTypeId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type...</option>
                  {eventTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              {/* Tournament Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Status</label>
                <select
                  value={editForm.tournamentStatus}
                  onChange={(e) => setEditForm(prev => ({ ...prev, tournamentStatus: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select status...</option>
                  <option value="Draft">Draft</option>
                  <option value="RegistrationOpen">Registration Open</option>
                  <option value="RegistrationClosed">Registration Closed</option>
                  <option value="ScheduleReady">Schedule Ready</option>
                  <option value="Drawing">Drawing</option>
                  <option value="Running">Running</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Venue Selection */}
              <div className="bg-blue-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Venue Binding
                </label>
                <select
                  value={editForm.venueId}
                  onChange={(e) => handleVenueChange(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select venue to bind...</option>
                  {venues.map(venue => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} - {venue.city}, {venue.state}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-blue-700 mt-1">
                  Binding a venue will auto-fill the address fields below
                </p>
              </div>

              {/* Address Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name</label>
                  <input
                    type="text"
                    value={editForm.venueName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, venueName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={editForm.country}
                    onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Fees */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Fee</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.registrationFee}
                    onChange={(e) => setEditForm(prev => ({ ...prev, registrationFee: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Per Division Fee</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.perDivisionFee}
                    onChange={(e) => setEditForm(prev => ({ ...prev, perDivisionFee: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Registration Window */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Registration Window
                  <span className="text-xs font-normal text-gray-500">(optional)</span>
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration Opens</label>
                    <input
                      type="date"
                      value={editForm.registrationOpenDate || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, registrationOpenDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Open Time</label>
                    <input
                      type="time"
                      value={editForm.registrationOpenTime || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, registrationOpenTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration Closes</label>
                    <input
                      type="date"
                      value={editForm.registrationCloseDate || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, registrationCloseDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Close Time</label>
                    <input
                      type="time"
                      value={editForm.registrationCloseTime || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, registrationCloseTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isPublished}
                    onChange={(e) => setEditForm(prev => ({ ...prev, isPublished: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Published</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isPrivate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, isPrivate: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Private</span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingEvent(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventsAdmin
