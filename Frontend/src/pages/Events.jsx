import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, Filter, Search, Plus, DollarSign, ChevronLeft, ChevronRight, X, UserPlus, Trophy, Layers, Check, AlertCircle, Navigation, Building2, Loader2, MessageCircle, CheckCircle, Edit3, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { eventsApi, eventTypesApi, courtsApi, getSharedAssetUrl } from '../services/api';

export default function Events() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courtIdParam = searchParams.get('courtId');
  const courtNameParam = searchParams.get('courtName');

  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [myEvents, setMyEvents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(100);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming'); // upcoming, my-events
  const pageSize = 20;

  // Get user's location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Geolocation error:', error);
        }
      );
    }
  }, []);

  // Load event types
  useEffect(() => {
    const loadEventTypes = async () => {
      try {
        const response = await eventTypesApi.getAll();
        if (response.success) {
          setEventTypes(response.data || []);
        }
      } catch (err) {
        console.error('Error loading event types:', err);
      }
    };
    loadEventTypes();
  }, []);

  // Load my events when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadMyEvents();
    }
  }, [isAuthenticated]);

  const loadMyEvents = async () => {
    try {
      const response = await eventsApi.getMyEvents();
      if (response.success) {
        setMyEvents(response.data);
      }
    } catch (err) {
      console.error('Error loading my events:', err);
    }
  };

  // Load events
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize,
        query: searchQuery || undefined,
        eventTypeId: selectedEventType || undefined,
        country: country || undefined,
        state: state || undefined,
        city: city || undefined,
        latitude: userLocation?.lat,
        longitude: userLocation?.lng,
        radiusMiles: userLocation ? radiusMiles : undefined,
        isUpcoming: activeTab === 'upcoming'
      };

      const response = await eventsApi.search(params);
      if (response.success && response.data) {
        setEvents(response.data.items || []);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error loading events:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedEventType, country, state, city, userLocation, radiusMiles, activeTab]);

  useEffect(() => {
    if (activeTab === 'upcoming') {
      loadEvents();
    }
  }, [loadEvents, activeTab]);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState(null);
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      setPage(1);
    }, 500));
  };

  const handleViewDetails = async (event) => {
    try {
      const response = await eventsApi.getEvent(event.id);
      if (response.success) {
        setSelectedEvent(response.data);
      }
    } catch (err) {
      console.error('Error loading event details:', err);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-700 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Calendar className="w-12 h-12" />
              <div>
                <h1 className="text-3xl font-bold">Pickleball Events</h1>
                <p className="text-orange-100 mt-1">
                  Find tournaments, open play, and community events
                </p>
              </div>
            </div>
            {isAuthenticated && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-medium hover:bg-orange-50 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Event
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Court Context Banner */}
        {courtIdParam && courtNameParam && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-orange-700">
              <MapPin className="w-5 h-5" />
              <span>Creating event at: <strong>{decodeURIComponent(courtNameParam)}</strong></span>
            </div>
            <button
              onClick={() => navigate('/events')}
              className="text-orange-600 hover:text-orange-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tabs */}
        {isAuthenticated && (
          <div className="mb-6 border-b">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'upcoming'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Find Events
              </button>
              <button
                onClick={() => setActiveTab('my-events')}
                className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'my-events'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                My Events
                {myEvents && (myEvents.eventsIOrganize.length + myEvents.eventsImRegisteredFor.length) > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 text-orange-600 rounded-full">
                    {myEvents.eventsIOrganize.length + myEvents.eventsImRegisteredFor.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'upcoming' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex flex-wrap gap-4 items-center">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search events..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Event Type Filter */}
                <select
                  value={selectedEventType}
                  onChange={(e) => { setSelectedEventType(e.target.value); setPage(1); }}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">All Types</option>
                  {eventTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>

                {/* Location Filters */}
                <input
                  type="text"
                  placeholder="State"
                  value={state}
                  onChange={(e) => { setState(e.target.value); setPage(1); }}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
                />

                <input
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setPage(1); }}
                  className="w-28 border border-gray-300 rounded-lg px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
                />

                {/* Distance Filter */}
                {userLocation && (
                  <select
                    value={radiusMiles}
                    onChange={(e) => { setRadiusMiles(parseInt(e.target.value)); setPage(1); }}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value={25}>Within 25 miles</option>
                    <option value={50}>Within 50 miles</option>
                    <option value={100}>Within 100 miles</option>
                    <option value={250}>Within 250 miles</option>
                    <option value={500}>Within 500 miles</option>
                  </select>
                )}
              </div>
            </div>

            {/* Events List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-600"></div>
              </div>
            ) : events.length > 0 ? (
              <>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {events.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      formatDate={formatDate}
                      formatTime={formatTime}
                      onViewDetails={() => handleViewDetails(event)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <span className="text-gray-600">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Events Found</h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery || state || city
                    ? 'No events match your search criteria.'
                    : 'No upcoming events scheduled.'}
                </p>
                {isAuthenticated && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Create an Event
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'my-events' && myEvents && (
          <div className="space-y-8">
            {/* Events I Organize */}
            {myEvents.eventsIOrganize.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-orange-500" />
                  Events I Organize
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {myEvents.eventsIOrganize.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      formatDate={formatDate}
                      formatTime={formatTime}
                      onViewDetails={() => handleViewDetails(event)}
                      showManage
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Events I'm Registered For */}
            {myEvents.eventsImRegisteredFor.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  Events I'm Registered For
                </h2>
                <div className="space-y-3">
                  {myEvents.eventsImRegisteredFor.map(reg => (
                    <div key={reg.eventId} className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4">
                      {reg.posterImageUrl && (
                        <img
                          src={getSharedAssetUrl(reg.posterImageUrl)}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{reg.eventName}</h3>
                        <p className="text-sm text-gray-500">
                          {formatDate(reg.startDate)} • {reg.venueName || `${reg.city}, ${reg.state}`}
                        </p>
                        <div className="flex gap-2 mt-1">
                          {reg.registeredDivisions.map((div, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                              {div}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          reg.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {reg.paymentStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {myEvents.eventsIOrganize.length === 0 && myEvents.eventsImRegisteredFor.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Events Yet</h3>
                <p className="text-gray-500 mb-6">
                  You haven't organized or registered for any events yet.
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => setActiveTab('upcoming')}
                    className="px-6 py-2 border border-orange-600 text-orange-600 rounded-lg font-medium hover:bg-orange-50"
                  >
                    Find Events
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
                  >
                    <Plus className="w-5 h-5" />
                    Create Event
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          isAuthenticated={isAuthenticated}
          currentUserId={user?.id}
          formatDate={formatDate}
          formatTime={formatTime}
          onClose={() => setSelectedEvent(null)}
          onUpdate={() => {
            loadMyEvents();
            loadEvents();
          }}
        />
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <CreateEventModal
          eventTypes={eventTypes}
          courtId={courtIdParam}
          courtName={courtNameParam}
          userLocation={userLocation}
          onClose={() => setShowCreateModal(false)}
          onCreate={(newEvent) => {
            setShowCreateModal(false);
            loadMyEvents();
            handleViewDetails(newEvent);
          }}
        />
      )}
    </div>
  );
}

function EventCard({ event, formatDate, formatTime, onViewDetails, showManage = false }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {event.posterImageUrl && (
        <div className="h-40 bg-orange-100 relative">
          <img
            src={getSharedAssetUrl(event.posterImageUrl)}
            alt={event.name}
            className="w-full h-full object-cover"
          />
          {!event.isPublished && (
            <span className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded">
              Draft
            </span>
          )}
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
            {event.eventTypeName || 'Event'}
          </span>
          {event.registrationFee > 0 && (
            <span className="text-sm font-medium text-gray-700">
              ${event.registrationFee}
            </span>
          )}
        </div>

        <h3 className="font-semibold text-gray-900 mb-2">{event.name}</h3>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(event.startDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{formatTime(event.startDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{event.venueName || `${event.city}, ${event.state}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{event.registeredCount} registered • {event.divisionCount} division{event.divisionCount !== 1 ? 's' : ''}</span>
          </div>
          {event.distance && (
            <div className="flex items-center gap-2 text-orange-600">
              <MapPin className="w-4 h-4" />
              <span>{event.distance.toFixed(1)} miles away</span>
            </div>
          )}
        </div>

        <button
          onClick={onViewDetails}
          className="mt-4 w-full py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
        >
          {showManage ? 'Manage Event' : 'View Details'}
        </button>
      </div>
    </div>
  );
}

function EventDetailModal({ event, isAuthenticated, currentUserId, formatDate, formatTime, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('details');
  const [registrations, setRegistrations] = useState({});
  const [partnerRequests, setPartnerRequests] = useState({});
  const [loading, setLoading] = useState(false);
  const [registeringDivision, setRegisteringDivision] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);

  // Registration management state
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [showRegistrations, setShowRegistrations] = useState(false);
  const [updatingRegistration, setUpdatingRegistration] = useState(null);

  // Court selection for editing
  const [topCourts, setTopCourts] = useState([]);
  const [courtsLoading, setCourtsLoading] = useState(false);
  const [courtSearchQuery, setCourtSearchQuery] = useState('');
  const [searchedCourts, setSearchedCourts] = useState([]);
  const [searchingCourts, setSearchingCourts] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [editStep, setEditStep] = useState(1); // 1: court, 2: details

  const isOrganizer = event.isOrganizer;
  const isRegistered = event.isRegistered;

  // Load all registrations when organizer opens manage tab
  const loadAllRegistrations = async () => {
    if (!isOrganizer) return;
    setRegistrationsLoading(true);
    try {
      const response = await eventsApi.getAllRegistrations(event.id);
      if (response.success) {
        setAllRegistrations(response.data || []);
      }
    } catch (err) {
      console.error('Error loading registrations:', err);
    } finally {
      setRegistrationsLoading(false);
    }
  };

  // Load registrations when switching to manage tab
  useEffect(() => {
    if (activeTab === 'manage' && isOrganizer && allRegistrations.length === 0) {
      loadAllRegistrations();
    }
  }, [activeTab, isOrganizer]);

  // Load courts for editing
  const loadTopCourts = async () => {
    setCourtsLoading(true);
    try {
      const response = await courtsApi.getTopForEvents(null, null, 10);
      if (response.success) {
        setTopCourts(response.data || []);
      }
    } catch (err) {
      console.error('Error loading courts:', err);
    } finally {
      setCourtsLoading(false);
    }
  };

  // Search courts when query changes
  useEffect(() => {
    if (!courtSearchQuery.trim() || !isEditing) {
      setSearchedCourts([]);
      return;
    }

    const searchCourts = async () => {
      setSearchingCourts(true);
      try {
        const response = await courtsApi.search({ query: courtSearchQuery, pageSize: 10 });
        if (response.success) {
          setSearchedCourts(response.data?.items || []);
        }
      } catch (err) {
        console.error('Error searching courts:', err);
      } finally {
        setSearchingCourts(false);
      }
    };

    const timer = setTimeout(searchCourts, 300);
    return () => clearTimeout(timer);
  }, [courtSearchQuery, isEditing]);

  // Handle court selection in edit mode
  const handleSelectCourt = (court) => {
    const courtData = {
      courtId: court.courtId || court.id,
      courtName: court.courtName || court.name,
      city: court.city,
      state: court.state,
      country: court.country,
      address: court.address
    };
    setSelectedCourt(courtData);
    setEditFormData(prev => ({
      ...prev,
      courtId: courtData.courtId,
      venueName: courtData.courtName || '',
      city: courtData.city || '',
      state: courtData.state || '',
      country: courtData.country || 'USA'
    }));
  };

  // Initialize edit form data when entering edit mode
  const startEditing = () => {
    setEditFormData({
      name: event.name || '',
      description: event.description || '',
      eventTypeId: event.eventTypeId,
      startDate: event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : '',
      startTime: event.startDate ? new Date(event.startDate).toTimeString().slice(0, 5) : '09:00',
      endDate: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : '',
      endTime: event.endDate ? new Date(event.endDate).toTimeString().slice(0, 5) : '17:00',
      courtId: event.courtId,
      venueName: event.venueName || '',
      address: event.address || '',
      city: event.city || '',
      state: event.state || '',
      country: event.country || 'USA',
      registrationFee: event.registrationFee || 0,
      perDivisionFee: event.perDivisionFee || 0,
      contactEmail: event.contactEmail || '',
      contactPhone: event.contactPhone || '',
      maxParticipants: event.maxParticipants || '',
      isPublished: event.isPublished,
      isPrivate: event.isPrivate
    });
    setSelectedCourt(event.courtId ? { courtId: event.courtId, courtName: event.courtName || event.venueName } : null);
    setIsEditing(true);
    setEditStep(1);
    setEditError(null);
    loadTopCourts();
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditFormData(null);
    setEditError(null);
    setEditStep(1);
    setSelectedCourt(null);
  };

  const saveEdit = async () => {
    if (!editFormData.name || !editFormData.startDate) {
      setEditError('Event name and start date are required');
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      const startDateTime = new Date(`${editFormData.startDate}T${editFormData.startTime}`);
      const endDateTime = editFormData.endDate
        ? new Date(`${editFormData.endDate}T${editFormData.endTime}`)
        : new Date(`${editFormData.startDate}T${editFormData.endTime}`);

      const response = await eventsApi.update(event.id, {
        ...editFormData,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        registrationFee: parseFloat(editFormData.registrationFee) || 0,
        perDivisionFee: parseFloat(editFormData.perDivisionFee) || 0,
        maxParticipants: editFormData.maxParticipants ? parseInt(editFormData.maxParticipants) : null,
        divisions: [] // Keep existing divisions
      });

      if (response.success) {
        setIsEditing(false);
        setEditFormData(null);
        setEditStep(1);
        onUpdate();
      } else {
        setEditError(response.message || 'Failed to update event');
      }
    } catch (err) {
      setEditError(err.message || 'An error occurred while updating');
    } finally {
      setSavingEdit(false);
    }
  };

  // Mark registration as paid
  const markAsPaid = async (registration) => {
    setUpdatingRegistration(registration.id);
    try {
      const response = await eventsApi.updateRegistration(event.id, registration.id, {
        paymentStatus: 'Paid',
        amountPaid: (event.registrationFee || 0) + (event.perDivisionFee || 0)
      });
      if (response.success) {
        setAllRegistrations(prev =>
          prev.map(r => r.id === registration.id ? { ...r, paymentStatus: 'Paid' } : r)
        );
      }
    } catch (err) {
      console.error('Error updating registration:', err);
    } finally {
      setUpdatingRegistration(null);
    }
  };

  // Assign team name to registration
  const assignTeam = async (registration, teamName) => {
    setUpdatingRegistration(registration.id);
    try {
      const response = await eventsApi.updateRegistration(event.id, registration.id, { teamName });
      if (response.success) {
        setAllRegistrations(prev =>
          prev.map(r => r.id === registration.id ? { ...r, teamName } : r)
        );
      }
    } catch (err) {
      console.error('Error updating registration:', err);
    } finally {
      setUpdatingRegistration(null);
    }
  };

  const loadDivisionData = async (divisionId) => {
    setLoading(true);
    try {
      const [regsResponse, partnersResponse] = await Promise.all([
        eventsApi.getRegistrations(event.id, divisionId),
        eventsApi.getPartnerRequests(event.id, divisionId)
      ]);

      if (regsResponse.success) {
        setRegistrations(prev => ({ ...prev, [divisionId]: regsResponse.data }));
      }
      if (partnersResponse.success) {
        setPartnerRequests(prev => ({ ...prev, [divisionId]: partnersResponse.data }));
      }
    } catch (err) {
      console.error('Error loading division data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (divisionId) => {
    if (!isAuthenticated) return;
    setRegisteringDivision(divisionId);
    try {
      const response = await eventsApi.register(event.id, { divisionId });
      if (response.success) {
        onUpdate();
        // Refresh event data
        const updated = await eventsApi.getEvent(event.id);
        if (updated.success) {
          Object.assign(event, updated.data);
        }
      }
    } catch (err) {
      console.error('Error registering:', err);
    } finally {
      setRegisteringDivision(null);
    }
  };

  const handleCancelRegistration = async (divisionId) => {
    if (!confirm('Are you sure you want to cancel your registration?')) return;
    try {
      await eventsApi.cancelRegistration(event.id, divisionId);
      onUpdate();
    } catch (err) {
      console.error('Error cancelling registration:', err);
    }
  };

  const canRegister = () => {
    const now = new Date();
    if (event.registrationOpenDate && new Date(event.registrationOpenDate) > now) return false;
    if (event.registrationCloseDate && new Date(event.registrationCloseDate) < now) return false;
    return true;
  };

  const registrationStatus = () => {
    const now = new Date();
    if (event.registrationOpenDate && new Date(event.registrationOpenDate) > now) {
      return { text: `Opens ${formatDate(event.registrationOpenDate)}`, color: 'yellow' };
    }
    if (event.registrationCloseDate && new Date(event.registrationCloseDate) < now) {
      return { text: 'Closed', color: 'red' };
    }
    return { text: 'Open', color: 'green' };
  };

  const status = registrationStatus();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10">
          {event.bannerImageUrl || event.posterImageUrl ? (
            <div className="h-48 relative">
              <img
                src={getSharedAssetUrl(event.bannerImageUrl || event.posterImageUrl)}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/80 rounded-full hover:bg-white"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-6 text-white">
                <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${status.color}-500`}>
                  Registration {status.text}
                </span>
                <h2 className="text-2xl font-bold mt-2">{event.name}</h2>
              </div>
            </div>
          ) : (
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${status.color}-100 text-${status.color}-700`}>
                  Registration {status.text}
                </span>
                <h2 className="text-xl font-semibold text-gray-900 mt-1">{event.name}</h2>
              </div>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex px-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'details' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('divisions')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'divisions' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500'
              }`}
            >
              Divisions ({event.divisions?.length || 0})
            </button>
            {isOrganizer && (
              <button
                onClick={() => setActiveTab('manage')}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'manage' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500'
                }`}
              >
                Manage
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Quick Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <Calendar className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                  <div className="text-sm text-gray-500">Date</div>
                  <div className="font-medium">{formatDate(event.startDate)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <Clock className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                  <div className="text-sm text-gray-500">Time</div>
                  <div className="font-medium">{formatTime(event.startDate)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <Users className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                  <div className="text-sm text-gray-500">Registered</div>
                  <div className="font-medium">{event.registeredCount}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <DollarSign className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                  <div className="text-sm text-gray-500">Entry Fee</div>
                  <div className="font-medium">
                    {event.registrationFee > 0 ? `$${event.registrationFee}` : 'Free'}
                  </div>
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">About This Event</h3>
                  <p className="text-gray-600">{event.description}</p>
                </div>
              )}

              {/* Location */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-600" />
                  Location
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  {event.venueName && <p className="font-medium">{event.venueName}</p>}
                  {event.address && <p className="text-sm text-gray-600">{event.address}</p>}
                  <p className="text-sm text-gray-600">
                    {event.city}{event.state && `, ${event.state}`}{event.country && `, ${event.country}`}
                  </p>
                </div>
              </div>

              {/* Contact */}
              {(event.contactEmail || event.contactPhone) && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Contact</h3>
                  <div className="space-y-1 text-sm">
                    {event.contactEmail && (
                      <p><span className="text-gray-500">Email:</span> {event.contactEmail}</p>
                    )}
                    {event.contactPhone && (
                      <p><span className="text-gray-500">Phone:</span> {event.contactPhone}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Organizer */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Organizer</h3>
                <p className="text-gray-600">
                  {event.clubName || event.organizerName || 'Event Organizer'}
                </p>
              </div>
            </div>
          )}

          {/* Divisions Tab */}
          {activeTab === 'divisions' && (
            <div className="space-y-4">
              {!canRegister() && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-700">
                  <AlertCircle className="w-5 h-5" />
                  <span>Registration is currently {status.text.toLowerCase()}</span>
                </div>
              )}

              {event.divisions?.map(division => (
                <div key={division.id} className="border rounded-lg overflow-hidden">
                  <div className="p-4 bg-gray-50 flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{division.name}</h4>
                      <div className="flex gap-4 text-sm text-gray-500 mt-1">
                        <span>{division.teamSize === 1 ? 'Singles' : 'Doubles'}</span>
                        {division.skillLevelMin && (
                          <span>Skill: {division.skillLevelMin}{division.skillLevelMax && ` - ${division.skillLevelMax}`}</span>
                        )}
                        {division.gender && <span>{division.gender}</span>}
                        <span>{division.registeredCount} registered</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {division.divisionFee && division.divisionFee > 0 && (
                        <span className="text-sm text-gray-600">+${division.divisionFee}</span>
                      )}
                      {event.registeredDivisionIds?.includes(division.id) ? (
                        <button
                          onClick={() => handleCancelRegistration(division.id)}
                          className="px-4 py-2 text-red-600 border border-red-300 rounded-lg text-sm font-medium hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRegister(division.id)}
                          disabled={!isAuthenticated || !canRegister() || registeringDivision === division.id}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                        >
                          {registeringDivision === division.id ? 'Registering...' : 'Register'}
                        </button>
                      )}
                    </div>
                  </div>

                  {division.description && (
                    <div className="px-4 py-2 text-sm text-gray-600 border-t">
                      {division.description}
                    </div>
                  )}

                  {division.teamSize > 1 && division.lookingForPartnerCount > 0 && (
                    <div className="px-4 py-2 border-t bg-blue-50 flex items-center gap-2 text-sm text-blue-700">
                      <UserPlus className="w-4 h-4" />
                      <span>{division.lookingForPartnerCount} player{division.lookingForPartnerCount !== 1 ? 's' : ''} looking for a partner</span>
                    </div>
                  )}
                </div>
              ))}

              {(!event.divisions || event.divisions.length === 0) && (
                <p className="text-center text-gray-500 py-8">No divisions configured yet</p>
              )}
            </div>
          )}

          {/* Manage Tab */}
          {activeTab === 'manage' && isOrganizer && (
            <div className="space-y-6">
              {isEditing ? (
                // Edit Form with Steps
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">
                      Edit Event - Step {editStep}: {editStep === 1 ? 'Select Venue/Court' : 'Event Details'}
                    </h3>
                    <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {editError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                      {editError}
                    </div>
                  )}

                  {editStep === 1 ? (
                    // Step 1: Court Selection
                    <div className="space-y-4">
                      {selectedCourt && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-green-800">{selectedCourt.courtName}</span>
                            {selectedCourt.city && <span className="text-green-600">- {selectedCourt.city}, {selectedCourt.state}</span>}
                          </div>
                          <button onClick={() => setSelectedCourt(null)} className="text-green-600 hover:text-green-800 text-sm">
                            Change
                          </button>
                        </div>
                      )}

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          placeholder="Search courts..."
                          value={courtSearchQuery}
                          onChange={(e) => setCourtSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      {courtsLoading || searchingCourts ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {(courtSearchQuery ? searchedCourts : topCourts).map(court => (
                            <button
                              key={court.courtId || court.id}
                              onClick={() => handleSelectCourt(court)}
                              className={`w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors ${
                                selectedCourt?.courtId === (court.courtId || court.id) ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                              }`}
                            >
                              <div className="font-medium text-gray-900">{court.courtName || court.name}</div>
                              <div className="text-sm text-gray-500">
                                {court.city}{court.state && `, ${court.state}`}
                                {court.distanceMiles && <span className="ml-2">({court.distanceMiles.toFixed(1)} mi)</span>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-3 pt-4 border-t">
                        <button type="button" onClick={cancelEditing} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                          Cancel
                        </button>
                        <button type="button" onClick={() => setEditStep(2)} className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700">
                          Next: Event Details
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Step 2: Event Details
                    <div className="space-y-4">
                      {selectedCourt && (
                        <div className="p-2 bg-gray-50 rounded-lg text-sm">
                          <span className="font-medium">Venue:</span> {selectedCourt.courtName}
                          {selectedCourt.city && ` - ${selectedCourt.city}, ${selectedCourt.state}`}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
                        <input type="text" value={editFormData?.name || ''} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea value={editFormData?.description || ''} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} rows={3} className="w-full border border-gray-300 rounded-lg p-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                          <input type="date" value={editFormData?.startDate || ''} onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                          <input type="time" value={editFormData?.startTime || ''} onChange={(e) => setEditFormData({ ...editFormData, startTime: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                          <input type="date" value={editFormData?.endDate || ''} onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                          <input type="time" value={editFormData?.endTime || ''} onChange={(e) => setEditFormData({ ...editFormData, endTime: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Registration Fee ($)</label>
                          <input type="number" min="0" step="0.01" value={editFormData?.registrationFee || 0} onChange={(e) => setEditFormData({ ...editFormData, registrationFee: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Per Division Fee ($)</label>
                          <input type="number" min="0" step="0.01" value={editFormData?.perDivisionFee || 0} onChange={(e) => setEditFormData({ ...editFormData, perDivisionFee: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                          <input type="email" value={editFormData?.contactEmail || ''} onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                          <input type="tel" value={editFormData?.contactPhone || ''} onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2" />
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setEditStep(1)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                          Back
                        </button>
                        <button type="button" onClick={saveEdit} disabled={savingEdit} className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50">
                          {savingEdit ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Normal Manage View
                <>
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h3 className="font-medium text-orange-800 mb-2">Event Status</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm ${event.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {event.isPublished ? 'Published' : 'Draft'}
                      </span>
                      {!event.isPublished && (
                        <button onClick={async () => { await eventsApi.publish(event.id); onUpdate(); }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                          Publish Event
                        </button>
                      )}
                      <button onClick={startEditing} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 flex items-center gap-2">
                        <Edit3 className="w-4 h-4" /> Edit Event
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Quick Stats</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">{event.registeredCount}</div>
                        <div className="text-sm text-gray-500">Registrations</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">{event.divisions?.length || 0}</div>
                        <div className="text-sm text-gray-500">Divisions</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          ${((event.registrationFee || 0) * event.registeredCount).toFixed(0)}
                        </div>
                        <div className="text-sm text-gray-500">Est. Revenue</div>
                      </div>
                    </div>
                  </div>

                  {/* Registrations Management */}
                  <div>
                    <button
                      onClick={() => setShowRegistrations(!showRegistrations)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-600" />
                        <span className="font-medium text-gray-900">Manage Registrations ({allRegistrations.length})</span>
                      </div>
                      {showRegistrations ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                    </button>

                    {showRegistrations && (
                      <div className="mt-3 border rounded-lg overflow-hidden">
                        {registrationsLoading ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                          </div>
                        ) : allRegistrations.length === 0 ? (
                          <div className="p-8 text-center text-gray-500">No registrations yet</div>
                        ) : (
                          <div className="divide-y">
                            {allRegistrations.map(reg => (
                              <div key={reg.id} className="p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                  {reg.userProfileImageUrl ? (
                                    <img src={getSharedAssetUrl(reg.userProfileImageUrl)} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm font-medium">
                                      {reg.userName?.charAt(0) || '?'}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 truncate">{reg.userName}</div>
                                  <div className="text-sm text-gray-500">
                                    {reg.divisionName || 'Division'} • {new Date(reg.registeredAt).toLocaleDateString()}
                                  </div>
                                  {reg.teamName && (
                                    <div className="text-sm text-blue-600">Team: {reg.teamName}</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`px-2 py-1 text-xs rounded-full ${reg.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {reg.paymentStatus}
                                  </span>
                                  {reg.paymentStatus !== 'Paid' && (
                                    <button
                                      onClick={() => markAsPaid(reg)}
                                      disabled={updatingRegistration === reg.id}
                                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                      title="Mark as Paid"
                                    >
                                      <DollarSign className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      const teamName = prompt('Enter team/unit name:', reg.teamName || '');
                                      if (teamName !== null) assignTeam(reg, teamName);
                                    }}
                                    disabled={updatingRegistration === reg.id}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Assign to Team/Unit"
                                  >
                                    <UserPlus className="w-4 h-4" />
                                  </button>
                                  <Link
                                    to={`/messages?userId=${reg.userId}`}
                                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    title="Send Message"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateEventModal({ eventTypes, courtId, courtName, onClose, onCreate, userLocation }) {
  // State for courts
  const [topCourts, setTopCourts] = useState([]);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [courtSearchQuery, setCourtSearchQuery] = useState('');
  const [searchedCourts, setSearchedCourts] = useState([]);
  const [searchingCourts, setSearchingCourts] = useState(false);

  // Selected court
  const [selectedCourt, setSelectedCourt] = useState(
    courtId && courtName ? { courtId: parseInt(courtId), courtName: decodeURIComponent(courtName) } : null
  );

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    eventTypeId: eventTypes[0]?.id || '',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '17:00',
    venueName: courtName ? decodeURIComponent(courtName) : '',
    city: '',
    state: '',
    country: 'USA',
    registrationFee: 0,
    perDivisionFee: 0,
    contactEmail: '',
    contactPhone: '',
    divisions: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(courtId ? 2 : 1); // Skip court selection if already provided

  // Load top courts on mount
  useEffect(() => {
    const loadTopCourts = async () => {
      try {
        setCourtsLoading(true);
        const response = await courtsApi.getTopForEvents(
          userLocation?.lat,
          userLocation?.lng,
          10
        );
        if (response.success) {
          setTopCourts(response.data || []);
        }
      } catch (err) {
        console.error('Error loading top courts:', err);
      } finally {
        setCourtsLoading(false);
      }
    };
    loadTopCourts();
  }, [userLocation]);

  // Search courts when query changes
  useEffect(() => {
    if (!courtSearchQuery.trim()) {
      setSearchedCourts([]);
      return;
    }

    const searchCourts = async () => {
      setSearchingCourts(true);
      try {
        const response = await courtsApi.search({
          query: courtSearchQuery,
          pageSize: 10,
          latitude: userLocation?.lat,
          longitude: userLocation?.lng
        });
        if (response.success) {
          setSearchedCourts(response.data?.items || []);
        }
      } catch (err) {
        console.error('Error searching courts:', err);
      } finally {
        setSearchingCourts(false);
      }
    };

    const timer = setTimeout(searchCourts, 300);
    return () => clearTimeout(timer);
  }, [courtSearchQuery, userLocation]);

  // Handle court selection
  const handleSelectCourt = (court) => {
    setSelectedCourt({
      courtId: court.courtId || court.id,
      courtName: court.courtName || court.name,
      city: court.city,
      state: court.state,
      country: court.country,
      address: court.address
    });
    // Auto-fill location fields
    setFormData(prev => ({
      ...prev,
      venueName: court.courtName || court.name || '',
      city: court.city || '',
      state: court.state || '',
      country: court.country || 'USA'
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.startDate || !formData.eventTypeId) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = formData.endDate
        ? new Date(`${formData.endDate}T${formData.endTime}`)
        : new Date(`${formData.startDate}T${formData.endTime}`);

      const response = await eventsApi.create({
        ...formData,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        courtId: selectedCourt?.courtId || undefined
      });

      if (response.success) {
        onCreate(response.data);
      } else {
        setError(response.message || 'Failed to create event');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const addDivision = () => {
    setFormData({
      ...formData,
      divisions: [
        ...formData.divisions,
        { name: '', teamSize: 2, gender: 'Open', skillLevelMin: '', skillLevelMax: '' }
      ]
    });
  };

  const updateDivision = (index, field, value) => {
    const updated = [...formData.divisions];
    updated[index][field] = value;
    setFormData({ ...formData, divisions: updated });
  };

  const removeDivision = (index) => {
    setFormData({
      ...formData,
      divisions: formData.divisions.filter((_, i) => i !== index)
    });
  };

  const stepLabels = ['Court', 'Event Info', 'Date & Time', 'Fees', 'Divisions'];
  const totalSteps = 5;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Event</h2>
            <p className="text-sm text-gray-500">Step {step} of {totalSteps}: {stepLabels[step - 1]}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Court Selection */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-2 text-gray-700 mb-4">
                <Building2 className="w-5 h-5 text-orange-600" />
                <span className="font-medium">Select a Court for Your Event</span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search courts by name or location..."
                  value={courtSearchQuery}
                  onChange={(e) => setCourtSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                />
                {searchingCourts && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                )}
              </div>

              {/* Search Results */}
              {courtSearchQuery && searchedCourts.length > 0 && (
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {searchedCourts.map(court => (
                    <button
                      key={court.id}
                      type="button"
                      onClick={() => handleSelectCourt(court)}
                      className={`w-full p-3 text-left hover:bg-orange-50 flex items-center gap-3 ${
                        selectedCourt?.courtId === court.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''
                      }`}
                    >
                      <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{court.name}</div>
                        <div className="text-sm text-gray-500 truncate">
                          {[court.city, court.state].filter(Boolean).join(', ')}
                        </div>
                      </div>
                      {court.distance && (
                        <span className="text-xs text-orange-600 flex-shrink-0">
                          {court.distance.toFixed(1)} mi
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Top Courts */}
              {!courtSearchQuery && (
                <>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
                    <Navigation className="w-4 h-4" />
                    <span>Suggested courts based on your history and location</span>
                  </div>

                  {courtsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
                    </div>
                  ) : topCourts.length > 0 ? (
                    <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                      {topCourts.map(court => (
                        <button
                          key={court.courtId}
                          type="button"
                          onClick={() => handleSelectCourt(court)}
                          className={`w-full p-3 text-left hover:bg-orange-50 flex items-center gap-3 ${
                            selectedCourt?.courtId === court.courtId ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''
                          }`}
                        >
                          <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{court.courtName}</div>
                            <div className="text-sm text-gray-500 truncate">
                              {[court.city, court.state].filter(Boolean).join(', ')}
                            </div>
                            <div className="flex gap-2 mt-1">
                              {court.indoorCourts > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  {court.indoorCourts} indoor
                                </span>
                              )}
                              {court.outdoorCourts > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                                  {court.outdoorCourts} outdoor
                                </span>
                              )}
                            </div>
                          </div>
                          {court.distanceMiles && (
                            <span className="text-xs text-orange-600 flex-shrink-0">
                              {court.distanceMiles.toFixed(1)} mi
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-4">
                      No suggested courts. Use search to find a court.
                    </p>
                  )}
                </>
              )}

              {/* Selected Court Display */}
              {selectedCourt && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-orange-600" />
                      <div>
                        <div className="font-medium text-gray-900">{selectedCourt.courtName}</div>
                        <div className="text-sm text-gray-600">
                          {[selectedCourt.city, selectedCourt.state].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCourt(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2: Event Type & Basic Info */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
                <select
                  value={formData.eventTypeId}
                  onChange={(e) => setFormData({ ...formData, eventTypeId: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg p-2"
                >
                  {eventTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="Summer Tournament 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
              </div>
            </>
          )}

          {/* Step 3: Date & Time */}
          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 4: Location & Fees */}
          {step === 4 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name</label>
                <input
                  type="text"
                  value={formData.venueName}
                  onChange={(e) => setFormData({ ...formData, venueName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Fee ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.registrationFee}
                    onChange={(e) => setFormData({ ...formData, registrationFee: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Per Division Fee ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.perDivisionFee}
                    onChange={(e) => setFormData({ ...formData, perDivisionFee: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 5: Divisions */}
          {step === 5 && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Event Divisions</h3>
                <button
                  type="button"
                  onClick={addDivision}
                  className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Division
                </button>
              </div>

              {formData.divisions.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  No divisions yet. Add divisions to allow registration.
                </p>
              ) : (
                <div className="space-y-4">
                  {formData.divisions.map((div, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex justify-between mb-3">
                        <span className="font-medium text-sm text-gray-700">Division {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeDivision(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Division Name"
                          value={div.name}
                          onChange={(e) => updateDivision(index, 'name', e.target.value)}
                          className="border border-gray-300 rounded-lg p-2 text-sm"
                        />
                        <select
                          value={div.teamSize}
                          onChange={(e) => updateDivision(index, 'teamSize', parseInt(e.target.value))}
                          className="border border-gray-300 rounded-lg p-2 text-sm"
                        >
                          <option value={1}>Singles</option>
                          <option value={2}>Doubles</option>
                        </select>
                        <select
                          value={div.gender}
                          onChange={(e) => updateDivision(index, 'gender', e.target.value)}
                          className="border border-gray-300 rounded-lg p-2 text-sm"
                        >
                          <option value="Open">Open</option>
                          <option value="Men">Men</option>
                          <option value="Women">Women</option>
                          <option value="Mixed">Mixed</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Skill Level (e.g., 3.5-4.0)"
                          value={div.skillLevelMin}
                          onChange={(e) => updateDivision(index, 'skillLevelMin', e.target.value)}
                          className="border border-gray-300 rounded-lg p-2 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-4 border-t">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Back
              </button>
            )}
            {step < totalSteps ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !selectedCourt) {
                    setError('Please select a court first');
                    return;
                  }
                  setError(null);
                  setStep(step + 1);
                }}
                className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Event'}
              </button>
            )}
          </div>

          {/* Step Indicators */}
          <div className="flex justify-center gap-2">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full ${s === step ? 'bg-orange-600' : s < step ? 'bg-orange-300' : 'bg-gray-300'}`}
              />
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
