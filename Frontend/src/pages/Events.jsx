import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, Filter, Search, Plus, DollarSign, ChevronLeft, ChevronRight, X, UserPlus, Trophy, Layers, Check, AlertCircle, Navigation, Building2, Loader2, MessageCircle, CheckCircle, Edit3, ChevronDown, ChevronUp, Trash2, List, Map, Image, Upload, Play, Link2, QrCode, Download, ArrowRightLeft, FileText, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { eventsApi, eventTypesApi, courtsApi, teamUnitsApi, skillLevelsApi, tournamentApi, sharedAssetApi, getSharedAssetUrl } from '../services/api';
import VenueMap from '../components/ui/VenueMap';
import ShareLink, { QrCodeModal } from '../components/ui/ShareLink';
import { getIconByName } from '../utils/iconMap';
import { getColorValues } from '../utils/colorMap';

export default function Events() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courtIdParam = searchParams.get('courtId');
  const courtNameParam = searchParams.get('courtName');

  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [teamUnits, setTeamUnits] = useState([]);
  const [skillLevels, setSkillLevels] = useState([]);
  const [myEvents, setMyEvents] = useState(null);
  const [myUnits, setMyUnits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [countries, setCountries] = useState([]);
  const [statesWithCounts, setStatesWithCounts] = useState([]);
  const [citiesWithCounts, setCitiesWithCounts] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(100);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState(isAuthenticated ? 'my-events' : 'search'); // my-events, search
  const pageSize = 20;

  // View mode: 'list' or 'map'
  const [viewMode, setViewMode] = useState('list');

  // Sorting
  const [sortBy, setSortBy] = useState('distance'); // distance, date, name
  const [sortOrder, setSortOrder] = useState('asc');

  // Location state
  const [locationError, setLocationError] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);

  // Show recent events (last month)
  const [showRecentEvents, setShowRecentEvents] = useState(false);

  // For map view hover
  const [hoveredEventId, setHoveredEventId] = useState(null);

  // Get user's location on mount with improved two-stage approach
  const getLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setSortBy('date');
      return;
    }

    // Check permission state first if available
    if (navigator.permissions) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          setLocationBlocked(true);
          setLocationError('Location access is blocked. Enable location in browser settings to sort by distance.');
          setSortBy('date');
          return;
        }
        setLocationBlocked(false);
      } catch (e) {
        // Permissions API not fully supported, continue anyway
      }
    }

    setGettingLocation(true);
    setLocationError(null);

    // Try with lower accuracy first (faster, uses IP/WiFi)
    const tryGetPosition = (highAccuracy, timeout) => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: timeout,
          maximumAge: 300000 // Cache for 5 minutes
        });
      });
    };

    try {
      // First try: fast, low accuracy (IP/WiFi based) - 5 second timeout
      const position = await tryGetPosition(false, 5000);
      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
      setGettingLocation(false);
      setLocationBlocked(false);
      setSortBy('distance');
    } catch (firstError) {
      // Second try: high accuracy (GPS) - 15 second timeout
      try {
        const position = await tryGetPosition(true, 15000);
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGettingLocation(false);
        setLocationBlocked(false);
        setSortBy('distance');
      } catch (error) {
        console.warn('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationBlocked(true);
          setLocationError('Location access was denied. Sort by distance unavailable.');
          setSortBy('date');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('Location unavailable.');
          setSortBy('date');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Location request timed out.');
          setSortBy('date');
        } else {
          setLocationError('Unable to get your location.');
          setSortBy('date');
        }
        setGettingLocation(false);
      }
    }
  }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  // Load event types, team units, and skill levels
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
    const loadTeamUnits = async () => {
      try {
        const response = await teamUnitsApi.getAll();
        if (response.success) {
          setTeamUnits(response.data || []);
        }
      } catch (err) {
        console.error('Error loading team units:', err);
      }
    };
    const loadSkillLevels = async () => {
      try {
        const response = await skillLevelsApi.getAll();
        if (response.success) {
          setSkillLevels(response.data || []);
        }
      } catch (err) {
        console.error('Error loading skill levels:', err);
      }
    };
    loadEventTypes();
    loadTeamUnits();
    loadSkillLevels();
  }, []);

  // Load countries on mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await eventsApi.getCountries();
        if (response.success) {
          setCountries(response.data || []);
        }
      } catch (err) {
        console.error('Error loading countries:', err);
      }
    };
    loadCountries();
  }, []);

  // Load states when country is selected
  useEffect(() => {
    if (!country) {
      setStatesWithCounts([]);
      setState('');
      setCitiesWithCounts([]);
      setCity('');
      return;
    }

    const loadStates = async () => {
      try {
        const response = await eventsApi.getStatesByCountry(country);
        if (response.success) {
          const sorted = (response.data || []).sort((a, b) => a.name.localeCompare(b.name));
          setStatesWithCounts(sorted);
        }
      } catch (err) {
        console.error('Error loading states:', err);
      }
    };
    loadStates();
  }, [country]);

  // Load cities when state is selected
  useEffect(() => {
    if (!country || !state) {
      setCitiesWithCounts([]);
      setCity('');
      return;
    }

    const loadCities = async () => {
      try {
        const response = await eventsApi.getCitiesByState(country, state);
        if (response.success) {
          const sorted = (response.data || []).sort((a, b) => a.name.localeCompare(b.name));
          setCitiesWithCounts(sorted);
        }
      } catch (err) {
        console.error('Error loading cities:', err);
      }
    };
    loadCities();
  }, [country, state]);

  // Load my events and units when authenticated, set appropriate tab
  useEffect(() => {
    if (isAuthenticated) {
      loadMyEvents();
      loadMyUnits();
      setActiveTab('my-events');
    } else {
      setActiveTab('search');
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

  const loadMyUnits = async () => {
    try {
      const response = await tournamentApi.getMyUnits();
      if (response.success) {
        setMyUnits(response.data);
      }
    } catch (err) {
      console.error('Error loading my units:', err);
    }
  };

  const handleRespondToJoinRequest = async (requestId, accept) => {
    try {
      const response = await tournamentApi.respondToJoinRequest(requestId, accept);
      if (response.success) {
        loadMyUnits();
      }
    } catch (err) {
      console.error('Error responding to join request:', err);
    }
  };

  const handleRespondToInvitation = async (unitId, accept) => {
    try {
      const response = await tournamentApi.respondToInvitation(unitId, accept);
      if (response.success) {
        loadMyUnits();
      }
    } catch (err) {
      console.error('Error responding to invitation:', err);
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
        isUpcoming: !showRecentEvents,
        includeRecent: showRecentEvents,
        sortBy: sortBy,
        sortOrder: sortOrder
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
  }, [page, searchQuery, selectedEventType, country, state, city, userLocation, radiusMiles, showRecentEvents, sortBy, sortOrder]);

  useEffect(() => {
    if (activeTab === 'search') {
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
              <button
                onClick={() => setActiveTab('search')}
                className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'search'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Search Events
              </button>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
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
                <select
                  value={country}
                  onChange={(e) => { setCountry(e.target.value); setPage(1); }}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">All Countries</option>
                  {countries.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count})
                    </option>
                  ))}
                </select>

                <select
                  value={state}
                  onChange={(e) => { setState(e.target.value); setPage(1); }}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
                  disabled={!country}
                >
                  <option value="">All States</option>
                  {statesWithCounts.map(s => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.count})
                    </option>
                  ))}
                </select>

                <select
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setPage(1); }}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
                  disabled={!state}
                >
                  <option value="">All Cities</option>
                  {citiesWithCounts.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count})
                    </option>
                  ))}
                </select>

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

              {/* Second row: Sort, View Mode, Show Recent */}
              <div className="flex flex-wrap gap-4 items-center mt-4 pt-4 border-t border-gray-100">
                {/* Sort By */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  >
                    {userLocation && <option value="distance">Distance</option>}
                    <option value="date">Date</option>
                    <option value="name">Name</option>
                  </select>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 flex items-center gap-1 ${
                      viewMode === 'list'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    <span className="text-sm">List</span>
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`px-3 py-2 flex items-center gap-1 ${
                      viewMode === 'map'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Map className="w-4 h-4" />
                    <span className="text-sm">Map</span>
                  </button>
                </div>

                {/* Show Recent Events Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRecentEvents}
                    onChange={(e) => { setShowRecentEvents(e.target.checked); setPage(1); }}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Show recent events</span>
                </label>

                {/* Location Status */}
                {gettingLocation && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Getting location...
                  </span>
                )}
                {locationError && !gettingLocation && (
                  <span className="text-sm text-amber-600">{locationError}</span>
                )}
              </div>
            </div>

            {/* Events Results */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-600"></div>
              </div>
            ) : events.length > 0 ? (
              <>
                {viewMode === 'map' ? (
                  /* Map View with Side List */
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="flex h-[600px]">
                      {/* Compact Event List */}
                      <div className="w-80 border-r border-gray-200 flex flex-col">
                        <div className="p-3 border-b bg-gray-50">
                          <p className="text-sm font-medium text-gray-700">
                            {events.filter(e => e.latitude || e.gpsLat).length} events on map
                          </p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          {events.filter(e => e.latitude || e.gpsLat).map((event, index) => {
                            const eventId = event.id;
                            const isSelected = hoveredEventId === eventId;
                            return (
                              <div
                                key={eventId}
                                className={`p-3 border-b border-gray-100 cursor-pointer transition-colors ${
                                  isSelected ? 'bg-orange-50 border-l-4 border-l-orange-500' : 'hover:bg-gray-50'
                                }`}
                                onClick={() => handleViewDetails(event)}
                                onMouseEnter={() => setHoveredEventId(eventId)}
                                onMouseLeave={() => setHoveredEventId(null)}
                              >
                                <div className="flex items-start gap-2">
                                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                                    isSelected ? 'bg-orange-600' : 'bg-blue-600'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 text-sm truncate">
                                      {event.name}
                                    </h4>
                                    <p className="text-xs text-gray-500 truncate">
                                      {formatDate(event.startDate)}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {event.venueName || [event.city, event.state].filter(Boolean).join(', ')}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {event.distance && (
                                        <span className="text-xs text-orange-600 font-medium">
                                          {event.distance.toFixed(1)} mi
                                        </span>
                                      )}
                                      {(() => {
                                        const EventIcon = event.eventTypeIcon ? getIconByName(event.eventTypeIcon, null) : null;
                                        const colors = getColorValues(event.eventTypeColor);
                                        return (
                                          <span
                                            className="text-xs flex items-center gap-1"
                                            style={{ color: colors.text }}
                                          >
                                            {EventIcon && <EventIcon className="w-3 h-3" />}
                                            {event.eventTypeName || 'Event'}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {events.filter(e => !(e.latitude || e.gpsLat)).length > 0 && (
                            <div className="p-3 text-xs text-gray-400 text-center">
                              {events.filter(e => !(e.latitude || e.gpsLat)).length} events without coordinates
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Map */}
                      <div className="flex-1">
                        <VenueMap
                          venues={events.map(e => ({
                            ...e,
                            id: e.id,
                            name: e.name,
                            latitude: e.latitude,
                            longitude: e.longitude
                          }))}
                          userLocation={userLocation}
                          onVenueClick={(event) => handleViewDetails(event)}
                          onMarkerSelect={(event) => setHoveredEventId(event.id)}
                          selectedVenueId={hoveredEventId}
                          showNumbers={true}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* List View */
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
                )}

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
                    : showRecentEvents
                    ? 'No events found in the past month.'
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

            {/* Pending Team Invitations */}
            {myUnits?.pendingInvitations?.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-500" />
                  Team Invitations
                </h2>
                <div className="space-y-3">
                  {myUnits.pendingInvitations.map(unit => (
                    <div key={unit.id} className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {unit.captainProfileImageUrl ? (
                            <img
                              src={getSharedAssetUrl(unit.captainProfileImageUrl)}
                              alt=""
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium text-lg">
                              {unit.captainName?.charAt(0) || '?'}
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium text-gray-900">{unit.name}</h3>
                            {(unit.eventName || unit.divisionName) && (
                              <p className="text-xs text-blue-600">
                                {unit.eventName}{unit.divisionName && ` - ${unit.divisionName}`}
                              </p>
                            )}
                            <p className="text-sm text-gray-500">
                              Captain: {unit.captainName || 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {unit.members?.length || 1} / {unit.requiredPlayers} players
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRespondToInvitation(unit.id, false)}
                            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleRespondToInvitation(unit.id, true)}
                            className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Join Requests (for captains) */}
            {myUnits?.pendingJoinRequestsAsCaption?.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  Join Requests for My Teams
                </h2>
                <div className="space-y-3">
                  {myUnits.pendingJoinRequestsAsCaption.map(request => (
                    <div key={request.id} className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {request.profileImageUrl ? (
                            <img
                              src={getSharedAssetUrl(request.profileImageUrl)}
                              alt=""
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium text-lg">
                              {request.userName?.charAt(0) || '?'}
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium text-gray-900">{request.userName}</h3>
                            <p className="text-sm text-gray-500">
                              Wants to join: {request.unitName}
                            </p>
                            {request.message && (
                              <p className="text-xs text-gray-400 mt-1">"{request.message}"</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRespondToJoinRequest(request.id, false)}
                            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleRespondToJoinRequest(request.id, true)}
                            className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Active Teams */}
            {myUnits?.activeUnits?.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-500" />
                  My Teams
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {myUnits.activeUnits.map(unit => (
                    <div key={unit.id} className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">{unit.name}</h3>
                          {(unit.eventName || unit.divisionName) && (
                            <p className="text-xs text-blue-600 mb-1">
                              {unit.eventName}{unit.divisionName && ` - ${unit.divisionName}`}
                            </p>
                          )}
                          <p className="text-sm text-gray-500">
                            {unit.isComplete ? 'Team Complete' : `${unit.members?.length || 0} / ${unit.requiredPlayers} players`}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          unit.status === 'Registered' ? 'bg-green-100 text-green-700' :
                          unit.status === 'Waitlisted' ? 'bg-yellow-100 text-yellow-700' :
                          unit.status === 'CheckedIn' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {unit.status}
                        </span>
                      </div>
                      <div className="flex -space-x-2 overflow-hidden">
                        {unit.members?.slice(0, 5).map((member, i) => (
                          member.profileImageUrl ? (
                            <img
                              key={member.id}
                              src={getSharedAssetUrl(member.profileImageUrl)}
                              alt={`${member.firstName} ${member.lastName}`}
                              className="w-8 h-8 rounded-full border-2 border-white object-cover"
                              title={`${member.firstName} ${member.lastName}`}
                            />
                          ) : (
                            <div
                              key={member.id}
                              className="w-8 h-8 rounded-full border-2 border-white bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-medium"
                              title={`${member.firstName} ${member.lastName}`}
                            >
                              {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                            </div>
                          )
                        ))}
                        {(unit.members?.length || 0) > 5 && (
                          <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium">
                            +{unit.members.length - 5}
                          </div>
                        )}
                      </div>
                      {!unit.isComplete && unit.captainUserId === user?.id && (
                        <p className="text-xs text-orange-600 mt-2">
                          Looking for more players to complete the team
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {myEvents.eventsIOrganize.length === 0 && myEvents.eventsImRegisteredFor.length === 0 && (!myUnits || (myUnits.activeUnits?.length === 0 && myUnits.pendingInvitations?.length === 0)) && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Events Yet</h3>
                <p className="text-gray-500 mb-6">
                  You haven't organized or registered for any events yet.
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => setActiveTab('search')}
                    className="px-6 py-2 border border-orange-600 text-orange-600 rounded-lg font-medium hover:bg-orange-50"
                  >
                    Search Events
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
          teamUnits={teamUnits}
          skillLevels={skillLevels}
          onClose={() => setSelectedEvent(null)}
          onUpdate={(updatedEvent) => {
            if (updatedEvent) {
              setSelectedEvent(updatedEvent);
            }
            loadMyEvents();
            loadEvents();
          }}
        />
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <CreateEventModal
          eventTypes={eventTypes}
          teamUnits={teamUnits}
          skillLevels={skillLevels}
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
          {(() => {
            const EventIcon = event.eventTypeIcon ? getIconByName(event.eventTypeIcon, Trophy) : Trophy;
            const colors = getColorValues(event.eventTypeColor);
            return (
              <span
                className="px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1"
                style={{
                  backgroundColor: colors.bg,
                  color: colors.text
                }}
              >
                <EventIcon className="w-3 h-3" />
                {event.eventTypeName || 'Event'}
              </span>
            );
          })()}
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
            {event.courtId && event.venueName ? (
              <Link
                to={`/venues?venueId=${event.courtId}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate text-orange-600 hover:text-orange-700 hover:underline"
              >
                {event.venueName}
              </Link>
            ) : (
              <span className="truncate">{event.venueName || `${event.city}, ${event.state}`}</span>
            )}
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

function EventDetailModal({ event, isAuthenticated, currentUserId, formatDate, formatTime, teamUnits = [], skillLevels = [], onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('details');
  const [registrations, setRegistrations] = useState({});
  const [partnerRequests, setPartnerRequests] = useState({});
  const [loading, setLoading] = useState(false);
  const [registeringDivision, setRegisteringDivision] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);

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
  const [showCourtPicker, setShowCourtPicker] = useState(false);
  const [editDivisions, setEditDivisions] = useState([]);
  const [showAddDivision, setShowAddDivision] = useState(false);
  const [newDivision, setNewDivision] = useState({ name: '', description: '', teamSize: 2, maxTeams: null, entryFee: 0, teamUnitId: null, skillLevelId: null });

  // Edit division modal state
  const [showEditDivision, setShowEditDivision] = useState(false);
  const [editingDivision, setEditingDivision] = useState(null);
  const [savingDivision, setSavingDivision] = useState(false);

  // Team registration state
  const [showTeamRegistration, setShowTeamRegistration] = useState(false);
  const [selectedDivisionForRegistration, setSelectedDivisionForRegistration] = useState(null);
  const [unitsLookingForPartners, setUnitsLookingForPartners] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  // Registration viewer state (expandable per division)
  const [expandedDivisions, setExpandedDivisions] = useState({});
  const [divisionRegistrationsCache, setDivisionRegistrationsCache] = useState({});
  const [loadingDivisionId, setLoadingDivisionId] = useState(null);
  // Legacy modal state (kept for organizer manage tab)
  const [showRegistrationViewer, setShowRegistrationViewer] = useState(false);
  const [selectedDivisionForViewing, setSelectedDivisionForViewing] = useState(null);
  const [divisionRegistrations, setDivisionRegistrations] = useState([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);

  // Share link state
  const [linkCopied, setLinkCopied] = useState(false);
  const [showEventQrModal, setShowEventQrModal] = useState(false);

  // Document management state
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [newDocument, setNewDocument] = useState({ title: '', isPublic: true, sortOrder: 0 });
  const [editingDocument, setEditingDocument] = useState(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const toast = useToast();

  // Handle publish/unpublish event
  const handlePublishToggle = async (shouldPublish) => {
    setPublishing(true);
    try {
      if (shouldPublish) {
        const response = await eventsApi.publish(event.id);
        if (response.success) {
          toast.success('🎉 Event published! You earned the Event Publisher award!');
          onUpdate();
        } else {
          toast.error(response.message || 'Failed to publish event');
        }
      } else {
        const response = await eventsApi.unpublish(event.id);
        if (response.success) {
          toast.info('Event unpublished. It is now hidden from public search.');
          onUpdate();
        } else {
          toast.error(response.message || 'Failed to unpublish event');
        }
      }
    } catch (err) {
      toast.error('An error occurred. Please try again.');
      console.error('Error toggling publish:', err);
    } finally {
      setPublishing(false);
    }
  };

  // Copy event invite link to clipboard
  const copyEventLink = async () => {
    const eventUrl = `${window.location.origin}/events?id=${event.id}`;
    try {
      await navigator.clipboard.writeText(eventUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = eventUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // Auto-generate division name when team unit or skill level changes
  const generateDivisionName = (teamUnitId, skillLevelId) => {
    const teamUnit = teamUnits.find(t => t.id === teamUnitId);
    const skillLevel = skillLevels.find(s => s.id === skillLevelId);
    if (teamUnit && skillLevel) {
      return `${teamUnit.name} - ${skillLevel.name}`;
    } else if (teamUnit) {
      return teamUnit.name;
    } else if (skillLevel) {
      return skillLevel.name;
    }
    return '';
  };

  const handleTeamUnitChange = (teamUnitId) => {
    const newName = generateDivisionName(teamUnitId ? parseInt(teamUnitId) : null, newDivision.skillLevelId);
    const teamUnit = teamUnits.find(t => t.id === parseInt(teamUnitId));
    setNewDivision({
      ...newDivision,
      teamUnitId: teamUnitId ? parseInt(teamUnitId) : null,
      teamSize: teamUnit?.totalPlayers || 2,
      name: newName
    });
  };

  const handleSkillLevelChange = (skillLevelId) => {
    const newName = generateDivisionName(newDivision.teamUnitId, skillLevelId ? parseInt(skillLevelId) : null);
    setNewDivision({
      ...newDivision,
      skillLevelId: skillLevelId ? parseInt(skillLevelId) : null,
      name: newName
    });
  };

  const isOrganizer = event.isOrganizer;
  const isAdmin = user?.role === 'Admin';
  const canEditDivision = isOrganizer || isAdmin;
  const isRegistered = event.isRegistered;

  // Load all registrations when organizer opens manage tab
  // Uses tournament API (EventUnits) which is the actual registration system
  const loadAllRegistrations = async () => {
    if (!isOrganizer) return;
    setRegistrationsLoading(true);
    try {
      const response = await tournamentApi.getEventUnits(event.id);
      if (response.success) {
        // Transform units into a flat list of registrations for the manage tab
        const registrations = [];
        (response.data || []).forEach(unit => {
          // Find the division name from event.divisions
          const division = event.divisions?.find(d => d.id === unit.divisionId);
          const divisionName = division?.name || unit.divisionName || 'Unknown Division';

          // Add each member as a registration entry
          unit.members?.forEach(member => {
            registrations.push({
              id: `${unit.id}-${member.userId}`,
              eventId: unit.eventId,
              divisionId: unit.divisionId,
              divisionName: divisionName,
              userId: member.userId,
              userName: member.firstName && member.lastName
                ? `${member.firstName} ${member.lastName}`
                : member.firstName || 'Player',
              userProfileImageUrl: member.profileImageUrl,
              unitId: unit.id,
              teamName: unit.name,
              status: unit.status,
              paymentStatus: unit.paymentStatus || 'Pending',
              role: member.role,
              isComplete: unit.isComplete,
              registeredAt: unit.createdAt
            });
          });
        });
        setAllRegistrations(registrations);
      }
    } catch (err) {
      console.error('Error loading registrations:', err);
    } finally {
      setRegistrationsLoading(false);
    }
  };

  // Load registrations and documents when switching to manage tab
  useEffect(() => {
    if (activeTab === 'manage' && isOrganizer) {
      if (allRegistrations.length === 0) {
        loadAllRegistrations();
      }
      if (documents.length === 0) {
        loadDocuments();
      }
    }
  }, [activeTab, isOrganizer]);

  // Load documents on initial render for public viewing
  useEffect(() => {
    loadDocuments();
  }, [event.id]);

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
      courtId: court.venueId || court.courtId || court.id,
      courtName: court.venueName || court.courtName || court.name,
      city: court.city,
      state: court.state,
      country: court.country,
      address: court.address || court.addr1
    };
    setSelectedCourt(courtData);
    setEditFormData(prev => ({
      ...prev,
      courtId: courtData.courtId,
      venueName: courtData.courtName || '',
      address: courtData.address || '',
      city: courtData.city || '',
      state: courtData.state || '',
      country: courtData.country || 'USA'
    }));
  };

  // Handle image upload for edit mode
  const handleEditImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setEditError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setEditError('Image must be less than 5MB');
      return;
    }

    setUploadingEditImage(true);
    setEditError(null);
    try {
      const response = await sharedAssetApi.upload(file, 'image', 'event');
      if (response?.data?.url) {
        setEditFormData({ ...editFormData, posterImageUrl: response.data.url });
      } else if (response?.url) {
        setEditFormData({ ...editFormData, posterImageUrl: response.url });
      } else {
        setEditError(response.message || 'Upload failed');
      }
    } catch (err) {
      setEditError(err.message || 'Failed to upload image');
    } finally {
      setUploadingEditImage(false);
    }
  };

  // Initialize edit form data when entering edit mode
  const startEditing = () => {
    // Extract date and time directly from ISO string without timezone conversion
    const extractDateTime = (isoString) => {
      if (!isoString) return { date: '', time: '' };
      // Handle both "2024-03-15T14:00:00" and "2024-03-15T14:00:00Z" formats
      const cleaned = isoString.replace('Z', '');
      const [datePart, timePart] = cleaned.split('T');
      return {
        date: datePart || '',
        time: timePart ? timePart.slice(0, 5) : ''
      };
    };

    const start = extractDateTime(event.startDate);
    const end = extractDateTime(event.endDate);

    setEditFormData({
      name: event.name || '',
      description: event.description || '',
      eventTypeId: event.eventTypeId,
      startDate: start.date,
      startTime: start.time || '09:00',
      endDate: end.date,
      endTime: end.time || '17:00',
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
      isPrivate: event.isPrivate,
      allowMultipleDivisions: event.allowMultipleDivisions ?? true,
      posterImageUrl: event.posterImageUrl || ''
    });
    setSelectedCourt(event.courtId ? {
      courtId: event.courtId,
      courtName: event.courtName || event.venueName,
      address: event.address,
      city: event.city,
      state: event.state
    } : null);
    setEditDivisions(event.divisions ? [...event.divisions] : []);
    setIsEditing(true);
    setEditError(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditFormData(null);
    setEditError(null);
    setSelectedCourt(null);
    setEditDivisions([]);
    setShowCourtPicker(false);
    setShowAddDivision(false);
  };

  const handleAddDivision = () => {
    if (!newDivision.name.trim()) return;
    setEditDivisions(prev => [...prev, {
      ...newDivision,
      id: `new-${Date.now()}`,
      isNew: true
    }]);
    setNewDivision({ name: '', description: '', teamSize: 2, maxTeams: null, entryFee: 0, teamUnitId: null, skillLevelId: null });
    setShowAddDivision(false);
  };

  const handleRemoveDivision = (divisionId) => {
    setEditDivisions(prev => prev.filter(d => d.id !== divisionId));
  };

  // Open edit division modal
  const handleEditDivision = (division) => {
    setEditingDivision({
      ...division,
      scheduleType: division.scheduleType || '',
      poolCount: division.poolCount || '',
      poolSize: division.poolSize || '',
      playoffFromPools: division.playoffFromPools || '',
      gamesPerMatch: division.gamesPerMatch || 1
    });
    setShowEditDivision(true);
  };

  // Save division changes
  const handleSaveDivision = async () => {
    if (!editingDivision) return;

    setSavingDivision(true);
    try {
      const updateData = {
        name: editingDivision.name,
        description: editingDivision.description,
        maxUnits: editingDivision.maxUnits ? parseInt(editingDivision.maxUnits) : null,
        divisionFee: editingDivision.divisionFee ? parseFloat(editingDivision.divisionFee) : null,
        scheduleType: editingDivision.scheduleType || null,
        poolCount: editingDivision.poolCount ? parseInt(editingDivision.poolCount) : null,
        poolSize: editingDivision.poolSize ? parseInt(editingDivision.poolSize) : null,
        playoffFromPools: editingDivision.playoffFromPools ? parseInt(editingDivision.playoffFromPools) : null,
        gamesPerMatch: editingDivision.gamesPerMatch ? parseInt(editingDivision.gamesPerMatch) : 1
      };

      const response = await eventsApi.updateDivision(event.id, editingDivision.id, updateData);
      if (response.success) {
        toast.success('Division updated successfully');
        setShowEditDivision(false);
        setEditingDivision(null);
        loadEvent(); // Reload event to get updated divisions
      } else {
        toast.error(response.message || 'Failed to update division');
      }
    } catch (err) {
      console.error('Error updating division:', err);
      toast.error('Failed to update division');
    } finally {
      setSavingDivision(false);
    }
  };

  // Load event documents
  const loadDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const response = await eventsApi.getDocuments(event.id);
      if (response.success) {
        setDocuments(response.data || []);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // Handle document file upload
  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be less than 10MB');
      return;
    }

    if (!newDocument.title.trim()) {
      toast.error('Please enter a document title first');
      return;
    }

    setUploadingDocument(true);
    try {
      // Upload file to shared assets
      const uploadResponse = await sharedAssetApi.upload(file, 'document', 'event');
      const fileUrl = uploadResponse?.data?.url || uploadResponse?.url;

      if (!fileUrl) {
        toast.error('Failed to upload file');
        return;
      }

      // Create document record
      const response = await eventsApi.addDocument(event.id, {
        title: newDocument.title,
        fileUrl: fileUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        isPublic: newDocument.isPublic,
        sortOrder: newDocument.sortOrder
      });

      if (response.success) {
        toast.success('Document added successfully');
        setDocuments([...documents, response.data]);
        setShowAddDocument(false);
        setNewDocument({ title: '', isPublic: true, sortOrder: 0 });
      } else {
        toast.error(response.message || 'Failed to add document');
      }
    } catch (err) {
      console.error('Error adding document:', err);
      toast.error('Failed to add document');
    } finally {
      setUploadingDocument(false);
    }
  };

  // Update document
  const handleUpdateDocument = async (docId, updates) => {
    try {
      const response = await eventsApi.updateDocument(event.id, docId, updates);
      if (response.success) {
        setDocuments(documents.map(d => d.id === docId ? response.data : d));
        setEditingDocument(null);
        toast.success('Document updated');
      } else {
        toast.error(response.message || 'Failed to update document');
      }
    } catch (err) {
      console.error('Error updating document:', err);
      toast.error('Failed to update document');
    }
  };

  // Delete document
  const handleDeleteDocument = async (docId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    setDeletingDocumentId(docId);
    try {
      const response = await eventsApi.deleteDocument(event.id, docId);
      if (response.success) {
        setDocuments(documents.filter(d => d.id !== docId));
        toast.success('Document deleted');
      } else {
        toast.error(response.message || 'Failed to delete document');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      toast.error('Failed to delete document');
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const saveEdit = async () => {
    if (!editFormData.name || !editFormData.startDate) {
      setEditError('Event name and start date are required');
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      // Combine date and time directly without timezone conversion
      const startDateTime = `${editFormData.startDate}T${editFormData.startTime}:00`;
      const endDateTime = editFormData.endDate
        ? `${editFormData.endDate}T${editFormData.endTime}:00`
        : `${editFormData.startDate}T${editFormData.endTime}:00`;

      // Prepare divisions for update - use null for new divisions, number for existing
      const divisionsToSave = editDivisions.map(d => ({
        id: d.isNew ? null : (typeof d.id === 'number' ? d.id : parseInt(d.id) || null),
        name: d.name,
        description: d.description || '',
        teamSize: d.teamSize || 2,
        maxTeams: d.maxTeams || null,
        divisionFee: d.divisionFee || d.entryFee || 0,
        teamUnitId: d.teamUnitId || null,
        skillLevelId: d.skillLevelId || null
      }));

      const response = await eventsApi.update(event.id, {
        ...editFormData,
        startDate: startDateTime,
        endDate: endDateTime,
        registrationFee: parseFloat(editFormData.registrationFee) || 0,
        perDivisionFee: parseFloat(editFormData.perDivisionFee) || 0,
        maxParticipants: editFormData.maxParticipants ? parseInt(editFormData.maxParticipants) : null,
        divisions: divisionsToSave
      });

      if (response.success) {
        setIsEditing(false);
        setEditFormData(null);
        setEditDivisions([]);
        // Pass the updated event data back to parent
        onUpdate(response.data);
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

  // Change division for a registration
  const handleChangeDivision = async (registration) => {
    const divisions = event.divisions?.filter(d => d.id !== registration.divisionId) || [];
    if (divisions.length === 0) {
      toast.error('No other divisions available');
      return;
    }

    const divisionOptions = divisions.map(d => `${d.id}: ${d.name}`).join('\n');
    const input = prompt(`Move to which division?\n\n${divisionOptions}\n\nEnter division ID:`);
    if (!input) return;

    const newDivisionId = parseInt(input.trim());
    if (isNaN(newDivisionId) || !divisions.find(d => d.id === newDivisionId)) {
      toast.error('Invalid division ID');
      return;
    }

    setUpdatingRegistration(registration.id);
    try {
      const response = await tournamentApi.moveRegistration(event.id, registration.unitId, newDivisionId);
      if (response.success) {
        const newDivision = event.divisions.find(d => d.id === newDivisionId);
        setAllRegistrations(prev =>
          prev.map(r => r.id === registration.id ? { ...r, divisionId: newDivisionId, divisionName: newDivision?.name || 'Unknown' } : r)
        );
        toast.success('Registration moved to new division');
      } else {
        toast.error(response.message || 'Failed to move registration');
      }
    } catch (err) {
      console.error('Error moving registration:', err);
      toast.error(err?.message || 'Failed to move registration');
    } finally {
      setUpdatingRegistration(null);
    }
  };

  // Remove a registration
  const handleRemoveRegistration = async (registration) => {
    if (!confirm(`Remove ${registration.userName} from ${registration.divisionName}?`)) return;

    setUpdatingRegistration(registration.id);
    try {
      const response = await tournamentApi.removeRegistration(event.id, registration.unitId, registration.userId);
      if (response.success) {
        setAllRegistrations(prev => prev.filter(r => r.id !== registration.id));
        toast.success('Registration removed');
        onUpdate();
      } else {
        toast.error(response.message || 'Failed to remove registration');
      }
    } catch (err) {
      console.error('Error removing registration:', err);
      toast.error(err?.message || 'Failed to remove registration');
    } finally {
      setUpdatingRegistration(null);
    }
  };

  // Download registrations as CSV
  const downloadRegistrationsCSV = () => {
    if (allRegistrations.length === 0) {
      toast.error('No registrations to download');
      return;
    }

    const headers = ['Name', 'Division', 'Team', 'Status', 'Registered At'];
    const rows = allRegistrations.map(reg => [
      reg.userName || '',
      reg.divisionName || '',
      reg.teamName || '',
      reg.paymentStatus || 'Pending',
      reg.registeredAt ? new Date(reg.registeredAt).toLocaleDateString() : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Add UTF-8 BOM for Excel unicode support
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${event.name || 'event'}-registrations.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
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

  // Check if user can register for another division
  const canRegisterForDivision = (divisionId) => {
    // Already registered for this division
    if (event.registeredDivisionIds?.includes(divisionId)) return false;
    // If multiple divisions not allowed and already registered for any division
    if (!event.allowMultipleDivisions && event.registeredDivisionIds?.length > 0) return false;
    return true;
  };

  const handleRegister = async (divisionId, partnerUserId = null) => {
    if (!isAuthenticated) return;

    // Check upfront if user can register
    if (!canRegisterForDivision(divisionId)) {
      toast.error('This event only allows registration for one division. You are already registered.');
      return;
    }

    // Find the division to check team size
    const division = event.divisions?.find(d => d.id === divisionId);
    const teamSize = division?.teamUnitId
      ? teamUnits.find(t => t.id === division.teamUnitId)?.totalPlayers || division?.teamSize
      : division?.teamSize || 1;

    // For team events (doubles/teams), show the team registration modal
    if (teamSize > 1 && !partnerUserId) {
      setSelectedDivisionForRegistration(division);
      setShowTeamRegistration(true);
      // Load units looking for partners
      loadUnitsLookingForPartners(divisionId);
      return;
    }

    setRegisteringDivision(divisionId);
    try {
      // partnerUserId of -1 means "create team without partner for now"
      const response = await tournamentApi.registerForEvent(event.id, {
        eventId: event.id,
        divisionIds: [divisionId],
        partnerUserId: partnerUserId > 0 ? partnerUserId : null
      });
      if (response.success) {
        toast.success('Successfully registered for division!');
        onUpdate();
        setShowTeamRegistration(false);
        setSelectedDivisionForRegistration(null);
        // Refresh event data
        const updated = await eventsApi.getEvent(event.id);
        if (updated.success) {
          Object.assign(event, updated.data);
        }
      } else {
        toast.error(response.message || 'Failed to register');
      }
    } catch (err) {
      console.error('Error registering:', err);
      // err is the response data from API interceptor: {success, message, data}
      toast.error(err?.message || 'Failed to register. Please try again.');
    } finally {
      setRegisteringDivision(null);
    }
  };

  const loadUnitsLookingForPartners = async (divisionId) => {
    setLoadingUnits(true);
    try {
      const response = await tournamentApi.getEventUnits(event.id, divisionId);
      if (response.success) {
        // Filter to only incomplete units (looking for partners)
        const incomplete = (response.data || []).filter(u =>
          u.members && u.members.length < u.requiredPlayers && !u.isComplete
        );
        setUnitsLookingForPartners(incomplete);
      }
    } catch (err) {
      console.error('Error loading units:', err);
    } finally {
      setLoadingUnits(false);
    }
  };

  // Load all registrations for a division to view (modal version for manage tab)
  const loadDivisionRegistrations = async (division) => {
    setSelectedDivisionForViewing(division);
    setShowRegistrationViewer(true);
    setLoadingRegistrations(true);
    try {
      const response = await tournamentApi.getEventUnits(event.id, division.id);
      if (response.success) {
        // Sort: complete units first, then incomplete units
        const sorted = (response.data || []).sort((a, b) => {
          if (a.isComplete && !b.isComplete) return -1;
          if (!a.isComplete && b.isComplete) return 1;
          return 0;
        });
        setDivisionRegistrations(sorted);
      }
    } catch (err) {
      console.error('Error loading registrations:', err);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  // Toggle expand/collapse for division registrations (inline view)
  const toggleDivisionExpand = async (division) => {
    const divId = division.id;
    const isCurrentlyExpanded = expandedDivisions[divId];

    if (isCurrentlyExpanded) {
      // Collapse
      setExpandedDivisions(prev => ({ ...prev, [divId]: false }));
    } else {
      // Expand - load data if not cached
      setExpandedDivisions(prev => ({ ...prev, [divId]: true }));

      if (!divisionRegistrationsCache[divId]) {
        setLoadingDivisionId(divId);
        try {
          const response = await tournamentApi.getEventUnits(event.id, divId);
          if (response.success) {
            const sorted = (response.data || []).sort((a, b) => {
              if (a.isComplete && !b.isComplete) return -1;
              if (!a.isComplete && b.isComplete) return 1;
              return 0;
            });
            setDivisionRegistrationsCache(prev => ({ ...prev, [divId]: sorted }));
          }
        } catch (err) {
          console.error('Error loading registrations:', err);
        } finally {
          setLoadingDivisionId(null);
        }
      }
    }
  };

  const handleJoinUnit = async (unitId) => {
    // Check upfront if user can register for this division
    const divisionId = selectedDivisionForRegistration?.id;
    if (divisionId && !canRegisterForDivision(divisionId)) {
      toast.error('This event only allows registration for one division. You are already registered.');
      return;
    }

    try {
      const response = await tournamentApi.requestToJoinUnit(unitId, 'I would like to join your team');
      if (response.success) {
        toast.success('Join request sent!');
        setShowTeamRegistration(false);
        setSelectedDivisionForRegistration(null);
        onUpdate();
      } else {
        toast.error(response.message || 'Failed to send join request');
      }
    } catch (err) {
      console.error('Error joining unit:', err);
      toast.error(err?.message || 'Failed to send join request. Please try again.');
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000] overflow-y-auto">
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
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  onClick={copyEventLink}
                  className="p-2 bg-white/80 rounded-full hover:bg-white flex items-center gap-1"
                  title="Copy invite link"
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-5 h-5 text-green-600" />
                      <span className="text-xs text-green-600 pr-1">Copied!</span>
                    </>
                  ) : (
                    <Link2 className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => setShowEventQrModal(true)}
                  className="p-2 bg-white/80 rounded-full hover:bg-white"
                  title="Show QR code"
                >
                  <QrCode className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 bg-white/80 rounded-full hover:bg-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="absolute bottom-4 left-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${status.color}-500`}>
                    Registration {status.text}
                  </span>
                  {event.eventTypeName && (() => {
                    const EventTypeIcon = event.eventTypeIcon ? getIconByName(event.eventTypeIcon, Trophy) : Trophy;
                    return (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-white/20 flex items-center gap-1">
                        <EventTypeIcon className="w-3 h-3" />
                        {event.eventTypeName}
                      </span>
                    );
                  })()}
                </div>
                <h2 className="text-2xl font-bold">{event.name}</h2>
              </div>
            </div>
          ) : (
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${status.color}-100 text-${status.color}-700`}>
                    Registration {status.text}
                  </span>
                  {event.eventTypeName && (() => {
                    const EventTypeIcon = event.eventTypeIcon ? getIconByName(event.eventTypeIcon, Trophy) : Trophy;
                    const colors = getColorValues(event.eventTypeColor);
                    return (
                      <span
                        className="px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1"
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text
                        }}
                      >
                        <EventTypeIcon className="w-3 h-3" />
                        {event.eventTypeName}
                      </span>
                    );
                  })()}
                </div>
                <h2 className="text-xl font-semibold text-gray-900">{event.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyEventLink}
                  className="p-2 text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  title="Copy invite link"
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-5 h-5 text-green-600" />
                      <span className="text-xs text-green-600">Copied!</span>
                    </>
                  ) : (
                    <Link2 className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => setShowEventQrModal(true)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title="Show QR code"
                >
                  <QrCode className="w-5 h-5" />
                </button>
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
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

              {/* Register Button */}
              <div className="flex flex-col items-center gap-3">
                {canRegister() ? (
                  isAuthenticated ? (
                    <button
                      onClick={() => setActiveTab('divisions')}
                      className="px-8 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center gap-2"
                    >
                      <UserPlus className="w-5 h-5" />
                      Register Now
                    </button>
                  ) : (
                    <div className="text-center">
                      <button
                        onClick={() => toast.info('Please create an account or sign in to register for this event')}
                        className="px-8 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center gap-2"
                      >
                        <UserPlus className="w-5 h-5" />
                        Register Now
                      </button>
                      <p className="mt-2 text-sm text-gray-600">
                        To register, please <Link to="/login" className="text-orange-600 font-medium hover:underline">sign in</Link> or{' '}
                        <Link to="/register" className="text-orange-600 font-medium hover:underline">create an account</Link>.
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Make sure to update your name in your profile before registering.
                      </p>
                    </div>
                  )
                ) : (
                  <div className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 ${
                    status.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>
                    <AlertCircle className="w-5 h-5" />
                    Registration {status.text}
                  </div>
                )}
              </div>

              {/* Description */}
              {event.description && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">About This Event</h3>
                  <p className="text-gray-600">{event.description}</p>
                </div>
              )}

              {/* Share Event Link */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-orange-600" />
                  Share This Event
                </h3>
                <ShareLink
                  url={`${window.location.origin}/events?id=${event.id}`}
                  title={`Share: ${event.name}`}
                  buttonColor="bg-orange-600 hover:bg-orange-700"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Share this link or QR code to invite others to view and register for this event
                </p>
              </div>

              {/* Location */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-600" />
                  Location
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  {event.venueName && (
                    event.courtId ? (
                      <Link
                        to={`/venues?venueId=${event.courtId}`}
                        className="font-medium text-orange-600 hover:text-orange-700 hover:underline"
                      >
                        {event.venueName}
                      </Link>
                    ) : (
                      <p className="font-medium">{event.venueName}</p>
                    )
                  )}
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

              {/* Event Documents (for public viewing) */}
              {documents.filter(d => d.isPublic || isOrganizer).length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-600" />
                    Event Documents
                  </h3>
                  <div className="space-y-2">
                    {documents.filter(d => d.isPublic || isOrganizer).map((doc) => (
                      <a
                        key={doc.id}
                        href={getSharedAssetUrl(doc.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                          <p className="text-sm text-gray-500 truncate">{doc.fileName}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
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

              {event.divisions?.map(division => {
                const teamUnit = division.teamUnitId ? teamUnits.find(t => t.id === division.teamUnitId) : null;
                const teamSize = teamUnit?.totalPlayers || division.teamSize || 1;
                const isFull = division.maxUnits && division.registeredCount >= division.maxUnits;

                return (
                  <div key={division.id} className="border rounded-lg overflow-hidden">
                    <div className="p-4 bg-gray-50 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{division.name}</h4>
                          {isFull && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                              Full - Waitlist
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                          <span>{teamUnit?.name || (teamSize === 1 ? 'Singles' : teamSize === 2 ? 'Doubles' : `${teamSize}-Player Team`)}</span>
                          {division.skillLevelName && <span>{division.skillLevelName}</span>}
                          {division.ageGroupName && <span>{division.ageGroupName}</span>}
                          {!division.skillLevelName && division.skillLevelMin && (
                            <span>Skill: {division.skillLevelMin}{division.skillLevelMax && ` - ${division.skillLevelMax}`}</span>
                          )}
                          {division.gender && <span>{division.gender}</span>}
                          <span>
                            {division.registeredCount} registered
                            {division.maxUnits && ` / ${division.maxUnits}`}
                          </span>
                          {division.waitlistedCount > 0 && (
                            <span className="text-yellow-600">+{division.waitlistedCount} waitlisted</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {division.divisionFee && division.divisionFee > 0 && (
                          <span className="text-sm text-gray-600">+${division.divisionFee}</span>
                        )}
                        {canEditDivision && (
                          <button
                            onClick={() => handleEditDivision(division)}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                            title="Edit Division"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
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
                            {registeringDivision === division.id ? 'Registering...' : (isFull ? 'Join Waitlist' : 'Register')}
                          </button>
                        )}
                      </div>
                    </div>

                    {division.description && (
                      <div className="px-4 py-2 text-sm text-gray-600 border-t">
                        {division.description}
                      </div>
                    )}

                    {teamSize > 1 && division.lookingForPartnerCount > 0 && !event.registeredDivisionIds?.includes(division.id) && (
                      <button
                        onClick={() => {
                          setSelectedDivisionForRegistration(division);
                          setShowTeamRegistration(true);
                          loadUnitsLookingForPartners(division.id);
                        }}
                        className="w-full px-4 py-2 border-t bg-blue-50 flex items-center justify-between gap-2 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          {division.lookingForPartnerCount} player{division.lookingForPartnerCount !== 1 ? 's' : ''} looking for a partner
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}

                    {/* Expandable Registrations Section */}
                    {division.registeredCount > 0 && (
                      <>
                        <button
                          onClick={() => toggleDivisionExpand(division)}
                          className="w-full px-4 py-2 border-t bg-gray-50 flex items-center justify-between gap-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            {expandedDivisions[division.id] ? 'Hide' : 'View'} {division.registeredCount} {teamSize > 2 ? 'team' : teamSize === 2 ? 'pair' : 'player'}{division.registeredCount !== 1 ? 's' : ''} registered
                          </span>
                          {loadingDivisionId === division.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : expandedDivisions[division.id] ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {/* Expanded Registrations List */}
                        {expandedDivisions[division.id] && (
                          <div className="border-t bg-white">
                            {loadingDivisionId === division.id ? (
                              <div className="p-4 text-center text-gray-500">
                                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                Loading registrations...
                              </div>
                            ) : (divisionRegistrationsCache[division.id] || []).length === 0 ? (
                              <div className="p-4 text-center text-gray-500">
                                No registrations yet
                              </div>
                            ) : (
                              <div className="divide-y">
                                {(divisionRegistrationsCache[division.id] || []).map((unit, index) => {
                                  const requiredPlayers = unit.requiredPlayers || teamSize;
                                  const isTeam = requiredPlayers > 2;
                                  const isDoubles = requiredPlayers === 2;

                                  return (
                                    <div key={unit.id || index} className="px-4 py-3">
                                      {isTeam ? (
                                        // Team display (3+ players)
                                        <div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <Trophy className="w-4 h-4 text-orange-500" />
                                            <span className="font-medium text-gray-900">
                                              {unit.name || `Team ${index + 1}`}
                                            </span>
                                            {!unit.isComplete && (
                                              <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                                                Looking for players
                                              </span>
                                            )}
                                          </div>
                                          <div className="ml-6 space-y-1">
                                            {unit.members?.map((member, mIdx) => (
                                              <div key={mIdx} className="text-sm text-gray-600 flex items-center gap-2">
                                                {member.profileImageUrl ? (
                                                  <img src={getSharedAssetUrl(member.profileImageUrl)} alt="" className="w-5 h-5 rounded-full object-cover" />
                                                ) : (
                                                  <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 text-xs font-medium">
                                                    {(member.firstName || 'P')[0].toUpperCase()}
                                                  </div>
                                                )}
                                                {member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName || 'Player'}
                                              </div>
                                            ))}
                                            {(unit.members?.length || 0) < requiredPlayers && (
                                              <div className="text-sm text-gray-400 italic flex items-center gap-2">
                                                <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-xs">?</div>
                                                {requiredPlayers - (unit.members?.length || 0)} spot{requiredPlayers - (unit.members?.length || 0) !== 1 ? 's' : ''} available
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ) : isDoubles ? (
                                        // Doubles display
                                        <div className="flex items-center gap-3">
                                          <div className="flex -space-x-2">
                                            {unit.members?.slice(0, 2).map((member, mIdx) => (
                                              member.profileImageUrl ? (
                                                <img key={mIdx} src={getSharedAssetUrl(member.profileImageUrl)} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white" />
                                              ) : (
                                                <div key={mIdx} className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 text-xs font-medium border-2 border-white">
                                                  {(member.firstName || 'P')[0].toUpperCase()}
                                                </div>
                                              )
                                            ))}
                                            {(unit.members?.length || 0) < 2 && (
                                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-xs border-2 border-white">
                                                ?
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex-1">
                                            <div className="text-sm text-gray-900">
                                              {unit.members?.length > 0
                                                ? unit.members.map(m => m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.firstName || 'Player').join(' & ')
                                                : unit.name || 'Looking for partner'}
                                            </div>
                                            {!unit.isComplete && (
                                              <span className="text-xs text-yellow-600">Looking for partner</span>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        // Singles display
                                        <div className="flex items-center gap-3">
                                          {unit.members?.[0]?.profileImageUrl ? (
                                            <img src={getSharedAssetUrl(unit.members[0].profileImageUrl)} alt="" className="w-8 h-8 rounded-full object-cover" />
                                          ) : (
                                            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 text-sm font-medium">
                                              {(unit.members?.[0]?.firstName || unit.name || 'P')[0].toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-sm text-gray-900">
                                            {unit.members?.[0]?.firstName && unit.members?.[0]?.lastName
                                              ? `${unit.members[0].firstName} ${unit.members[0].lastName}`
                                              : unit.members?.[0]?.firstName || unit.name || 'Player'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {(!event.divisions || event.divisions.length === 0) && (
                <p className="text-center text-gray-500 py-8">No divisions configured yet</p>
              )}
            </div>
          )}

          {/* Manage Tab */}
          {activeTab === 'manage' && isOrganizer && (
            <div className="space-y-6">
              {/* Management Dashboard Links */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Tournament Dashboard */}
                <Link
                  to={`/tournament/${event.id}/manage`}
                  className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 hover:bg-orange-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Trophy className="w-5 h-5" />
                    <div>
                      <div className="font-medium">Tournament Dashboard</div>
                      <div className="text-sm text-orange-600">Brackets, pools, and tournament play</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </Link>

                {/* Game Day Dashboard */}
                <Link
                  to={`/gameday/${event.id}/manage`}
                  className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Play className="w-5 h-5" />
                    <div>
                      <div className="font-medium">Game Day Manager</div>
                      <div className="text-sm text-blue-600">Quick games, courts, and scoring</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>

              {/* Event Documents Section */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <h3 className="font-medium text-gray-900">Event Documents</h3>
                    <span className="text-sm text-gray-500">({documents.length})</span>
                  </div>
                  <button
                    onClick={() => setShowAddDocument(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Document
                  </button>
                </div>

                {loadingDocuments ? (
                  <div className="p-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No documents uploaded yet</p>
                    <p className="text-sm">Add rules, schedules, or other event materials</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {documents.map((doc) => (
                      <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            {editingDocument?.id === doc.id ? (
                              <input
                                type="text"
                                value={editingDocument.title}
                                onChange={(e) => setEditingDocument({ ...editingDocument, title: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                autoFocus
                              />
                            ) : (
                              <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                            )}
                            <p className="text-sm text-gray-500 truncate">{doc.fileName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {doc.isPublic ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                  <Eye className="w-3 h-3" /> Public
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                  <EyeOff className="w-3 h-3" /> Registered Only
                                </span>
                              )}
                              {doc.fileSize && (
                                <span className="text-xs text-gray-400">
                                  {(doc.fileSize / 1024).toFixed(0)} KB
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {editingDocument?.id === doc.id ? (
                            <>
                              <button
                                onClick={() => setEditingDocument({ ...editingDocument, isPublic: !editingDocument.isPublic })}
                                className={`p-2 rounded ${editingDocument.isPublic ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'}`}
                                title={editingDocument.isPublic ? 'Make Private' : 'Make Public'}
                              >
                                {editingDocument.isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleUpdateDocument(doc.id, { title: editingDocument.title, isPublic: editingDocument.isPublic })}
                                className="p-2 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingDocument(null)}
                                className="p-2 text-gray-400 hover:bg-gray-100 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <a
                                href={getSharedAssetUrl(doc.fileUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                title="Open Document"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => setEditingDocument({ id: doc.id, title: doc.title, isPublic: doc.isPublic })}
                                className="p-2 text-gray-400 hover:bg-gray-100 rounded"
                                title="Edit"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                disabled={deletingDocumentId === doc.id}
                                className="p-2 text-red-400 hover:bg-red-50 rounded disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingDocumentId === doc.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Document Form */}
                {showAddDocument && (
                  <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Document Title *</label>
                        <input
                          type="text"
                          value={newDocument.title}
                          onChange={(e) => setNewDocument({ ...newDocument, title: e.target.value })}
                          placeholder="e.g., Tournament Rules, Schedule, Waiver Form"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newDocument.isPublic}
                            onChange={(e) => setNewDocument({ ...newDocument, isPublic: e.target.checked })}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700">Public (visible to everyone)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-700">Sort Order:</label>
                          <input
                            type="number"
                            value={newDocument.sortOrder}
                            onChange={(e) => setNewDocument({ ...newDocument, sortOrder: parseInt(e.target.value) || 0 })}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex-1">
                          <input
                            type="file"
                            onChange={handleDocumentUpload}
                            disabled={uploadingDocument || !newDocument.title.trim()}
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.png,.jpg,.jpeg"
                          />
                          <span className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                            uploadingDocument || !newDocument.title.trim()
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-orange-600 text-white hover:bg-orange-700'
                          }`}>
                            {uploadingDocument ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4" />
                                Select & Upload File
                              </>
                            )}
                          </span>
                        </label>
                        <button
                          onClick={() => {
                            setShowAddDocument(false);
                            setNewDocument({ title: '', isPublic: true, sortOrder: 0 });
                          }}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Accepted formats: PDF, Word, Excel, text files, images. Max 10MB.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {isEditing ? (
                // Edit Form - Single Page
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">Edit Event</h3>
                    <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {editError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                      {editError}
                    </div>
                  )}

                  {/* Venue/Court Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Venue/Court</label>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        <div>
                          <span className="font-medium text-gray-900">{selectedCourt?.courtName || editFormData?.venueName || 'No venue selected'}</span>
                          {(selectedCourt?.address || editFormData?.address) && (
                            <div className="text-sm text-gray-500">{selectedCourt?.address || editFormData?.address}</div>
                          )}
                          {(selectedCourt?.city || editFormData?.city) && (
                            <div className="text-sm text-gray-500">
                              {selectedCourt?.city || editFormData?.city}, {selectedCourt?.state || editFormData?.state}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setShowCourtPicker(true); loadTopCourts(); }}
                        className="px-3 py-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
                    <input type="text" value={editFormData?.name || ''} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea value={editFormData?.description || ''} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} rows={3} className="w-full border border-gray-300 rounded-lg p-2" />
                  </div>

                  {/* Event Thumbnail */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Thumbnail</label>
                    <div className="flex items-center gap-4">
                      {editFormData?.posterImageUrl ? (
                        <div className="relative">
                          <img
                            src={getSharedAssetUrl(editFormData.posterImageUrl)}
                            alt="Event thumbnail"
                            className="w-24 h-24 rounded-lg object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, posterImageUrl: '' })}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 hover:bg-orange-50">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleEditImageUpload}
                            className="hidden"
                            disabled={uploadingEditImage}
                          />
                          {uploadingEditImage ? (
                            <Loader2 className="w-6 h-6 text-orange-600 animate-spin" />
                          ) : (
                            <>
                              <Image className="w-6 h-6 text-gray-400" />
                              <span className="text-xs text-gray-500 mt-1">Upload</span>
                            </>
                          )}
                        </label>
                      )}
                      <p className="text-xs text-gray-500">Max 5MB. JPG or PNG recommended.</p>
                    </div>
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

                  {/* Event Settings */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Event Settings</label>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                        <div>
                          <span className="font-medium text-gray-900">Private Event</span>
                          <p className="text-sm text-gray-500">Private events are only visible to invited participants and club members</p>
                        </div>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={editFormData?.isPrivate || false}
                            onChange={(e) => setEditFormData({ ...editFormData, isPrivate: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={`w-11 h-6 rounded-full transition-colors ${editFormData?.isPrivate ? 'bg-orange-600' : 'bg-gray-300'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editFormData?.isPrivate ? 'translate-x-5' : ''}`}></div>
                          </div>
                        </div>
                      </label>
                      <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                        <div>
                          <span className="font-medium text-gray-900">Allow Multiple Divisions</span>
                          <p className="text-sm text-gray-500">Allow players to register for more than one division</p>
                        </div>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={editFormData?.allowMultipleDivisions ?? true}
                            onChange={(e) => setEditFormData({ ...editFormData, allowMultipleDivisions: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={`w-11 h-6 rounded-full transition-colors ${editFormData?.allowMultipleDivisions ?? true ? 'bg-orange-600' : 'bg-gray-300'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editFormData?.allowMultipleDivisions ?? true ? 'translate-x-5' : ''}`}></div>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Divisions Section */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">Divisions</label>
                      <button
                        type="button"
                        onClick={() => setShowAddDivision(true)}
                        className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add Division
                      </button>
                    </div>

                    {editDivisions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No divisions configured</p>
                    ) : (
                      <div className="space-y-2">
                        {editDivisions.map(division => (
                          <div key={division.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900">{division.name}</div>
                              <div className="text-sm text-gray-500">
                                Team size: {division.teamSize}
                                {division.maxTeams && ` • Max: ${division.maxTeams} teams`}
                                {division.entryFee > 0 && ` • $${division.entryFee}`}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveDivision(division.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Division Form */}
                    {showAddDivision && (
                      <div className="mt-3 p-3 border border-orange-200 bg-orange-50 rounded-lg space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Team Unit *</label>
                            <select
                              value={newDivision.teamUnitId || ''}
                              onChange={(e) => handleTeamUnitChange(e.target.value)}
                              className="w-full border border-gray-300 rounded p-2 text-sm"
                            >
                              <option value="">Select team unit...</option>
                              {teamUnits.map(unit => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Skill Level *</label>
                            <select
                              value={newDivision.skillLevelId || ''}
                              onChange={(e) => handleSkillLevelChange(e.target.value)}
                              className="w-full border border-gray-300 rounded p-2 text-sm"
                            >
                              <option value="">Select skill level...</option>
                              {skillLevels.map(level => (
                                <option key={level.id} value={level.id}>
                                  {level.name}{level.description ? ` - ${level.description}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Division Name</label>
                          <input
                            type="text"
                            value={newDivision.name}
                            onChange={(e) => setNewDivision({ ...newDivision, name: e.target.value })}
                            placeholder="Auto-generated from Team Unit and Skill Level"
                            className="w-full border border-gray-300 rounded p-2 text-sm bg-gray-50"
                          />
                          <p className="text-xs text-gray-500 mt-1">Auto-generated when Team Unit and Skill Level are selected. You can edit if needed.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Max Teams</label>
                            <input
                              type="number"
                              min="1"
                              value={newDivision.maxTeams || ''}
                              onChange={(e) => setNewDivision({ ...newDivision, maxTeams: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Unlimited"
                              className="w-full border border-gray-300 rounded p-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Entry Fee ($)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={newDivision.entryFee || 0}
                              onChange={(e) => setNewDivision({ ...newDivision, entryFee: parseFloat(e.target.value) || 0 })}
                              className="w-full border border-gray-300 rounded p-2 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddDivision(false)}
                            className="flex-1 py-1.5 border border-gray-300 text-gray-700 rounded text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddDivision}
                            disabled={!newDivision.name.trim()}
                            className="flex-1 py-1.5 bg-orange-600 text-white rounded text-sm disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <button type="button" onClick={cancelEditing} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                      Cancel
                    </button>
                    <button type="button" onClick={saveEdit} disabled={savingEdit} className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50">
                      {savingEdit ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
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
                      {!event.isPublished ? (
                        <button
                          onClick={() => handlePublishToggle(true)}
                          disabled={publishing}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Publish Event
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublishToggle(false)}
                          disabled={publishing}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Unpublish
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowRegistrations(!showRegistrations)}
                        className="flex-1 flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-gray-600" />
                          <span className="font-medium text-gray-900">Manage Registrations ({allRegistrations.length})</span>
                        </div>
                        {showRegistrations ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                      </button>
                      {allRegistrations.length > 0 && (
                        <button
                          onClick={downloadRegistrationsCSV}
                          className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Download CSV"
                        >
                          <Download className="w-5 h-5 text-gray-600" />
                        </button>
                      )}
                    </div>

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
                                <div className="flex items-center gap-1 flex-shrink-0">
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
                                    onClick={() => handleChangeDivision(reg)}
                                    disabled={updatingRegistration === reg.id}
                                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Change Division"
                                  >
                                    <ArrowRightLeft className="w-4 h-4" />
                                  </button>
                                  <Link
                                    to={`/messages?userId=${reg.userId}`}
                                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    title="Send Message"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </Link>
                                  <button
                                    onClick={() => handleRemoveRegistration(reg)}
                                    disabled={updatingRegistration === reg.id}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Remove Registration"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
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

      {/* Venue Picker Modal */}
      {showCourtPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1010]">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Select Venue</h3>
              <button onClick={() => setShowCourtPicker(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search venues..."
                  value={courtSearchQuery}
                  onChange={(e) => setCourtSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {courtsLoading || searchingCourts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                </div>
              ) : (
                <div className="space-y-2">
                  {(courtSearchQuery ? searchedCourts : topCourts).map(court => (
                    <button
                      key={court.venueId || court.courtId || court.id}
                      onClick={() => {
                        handleSelectCourt(court);
                        setShowCourtPicker(false);
                        setCourtSearchQuery('');
                      }}
                      className={`w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors ${
                        selectedCourt?.courtId === (court.venueId || court.courtId || court.id) ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{court.venueName || court.courtName || court.name || 'UnNamed'}</div>
                      {(court.address || court.addr1) && (
                        <div className="text-sm text-gray-600">{court.address || court.addr1}</div>
                      )}
                      <div className="text-sm text-gray-500">
                        {court.city}{court.state && `, ${court.state}`}
                        {court.distanceMiles && <span className="ml-2">({court.distanceMiles.toFixed(1)} mi)</span>}
                      </div>
                    </button>
                  ))}
                  {!courtsLoading && !searchingCourts && (courtSearchQuery ? searchedCourts : topCourts).length === 0 && (
                    <p className="text-center text-gray-500 py-4">No venues found</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team Registration Modal */}
      {showTeamRegistration && selectedDivisionForRegistration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1010]">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Register for {selectedDivisionForRegistration.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedDivisionForRegistration.teamSize === 2 ? 'Doubles' : 'Team'} Division
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTeamRegistration(false);
                  setSelectedDivisionForRegistration(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Create New Team Option */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create New Team
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Register as team captain and find or invite a partner later.
                </p>
                <button
                  onClick={() => handleRegister(selectedDivisionForRegistration.id, -1)}
                  disabled={registeringDivision === selectedDivisionForRegistration.id}
                  className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {registeringDivision === selectedDivisionForRegistration.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Team & Find Partner Later
                    </>
                  )}
                </button>
              </div>

              {/* Join Existing Team */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Join Existing Team
                </h4>
                {loadingUnits ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                  </div>
                ) : unitsLookingForPartners.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No teams are currently looking for partners in this division.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {unitsLookingForPartners.map(unit => (
                      <div key={unit.id} className="border rounded-lg p-3 hover:border-orange-300 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {unit.captainProfileImageUrl ? (
                              <img
                                src={getSharedAssetUrl(unit.captainProfileImageUrl)}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">
                                {unit.captainName?.charAt(0) || '?'}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{unit.name}</div>
                              <div className="text-sm text-gray-500">
                                Captain: {unit.captainName || 'Unknown'}
                              </div>
                              <div className="text-xs text-gray-400">
                                {unit.members?.length || 1} / {unit.requiredPlayers} players
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleJoinUnit(unit.id)}
                            className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors"
                          >
                            Request to Join
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowTeamRegistration(false);
                  setSelectedDivisionForRegistration(null);
                }}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration Viewer Modal */}
      {showRegistrationViewer && selectedDivisionForViewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1010]">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedDivisionForViewing.name} Registrations</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {divisionRegistrations.length} {
                    (() => {
                      const teamSize = divisionRegistrations[0]?.requiredPlayers || selectedDivisionForViewing.teamSize || 1;
                      return teamSize > 2 ? 'team' : teamSize === 2 ? 'pair' : 'player';
                    })()
                  }{divisionRegistrations.length !== 1 ? 's' : ''} registered
                </p>
              </div>
              <button
                onClick={() => {
                  setShowRegistrationViewer(false);
                  setSelectedDivisionForViewing(null);
                  setDivisionRegistrations([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingRegistrations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : divisionRegistrations.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No registrations yet</p>
              ) : (
                <div className="space-y-3">
                  {divisionRegistrations.map((unit, index) => {
                    const teamSize = unit.requiredPlayers || 1;
                    const isComplete = unit.isComplete;
                    const acceptedMembers = unit.members?.filter(m => m.inviteStatus === 'Accepted') || [];

                    return (
                      <div
                        key={unit.id}
                        className={`p-3 rounded-lg border ${isComplete ? 'bg-white border-gray-200' : 'bg-yellow-50 border-yellow-200'}`}
                      >
                        {/* Singles display */}
                        {teamSize === 1 && acceptedMembers[0] && (
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 font-medium w-6">{index + 1}.</span>
                            <img
                              src={acceptedMembers[0].profileImageUrl || '/default-avatar.png'}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div>
                              <p className="font-medium text-gray-900">
                                {acceptedMembers[0].firstName} {acceptedMembers[0].lastName}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Doubles display */}
                        {teamSize === 2 && (
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 font-medium w-6">{index + 1}.</span>
                            <div className="flex items-center gap-2">
                              {acceptedMembers.map((member, mIndex) => (
                                <div key={member.id} className="flex items-center gap-2">
                                  {mIndex > 0 && <span className="text-gray-400">&</span>}
                                  <img
                                    src={member.profileImageUrl || '/default-avatar.png'}
                                    alt=""
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                  <span className="text-gray-900">
                                    {member.firstName} {member.lastName}
                                  </span>
                                </div>
                              ))}
                              {!isComplete && (
                                <span className="text-yellow-600 text-sm ml-2">(looking for partner)</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Team display (3+ players) */}
                        {teamSize > 2 && (
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-gray-400 font-medium w-6">{index + 1}.</span>
                              <span className="font-medium text-gray-900">{unit.name}</span>
                              {!isComplete && (
                                <span className="text-yellow-600 text-sm">
                                  ({acceptedMembers.length}/{teamSize} players)
                                </span>
                              )}
                            </div>
                            <div className="ml-9 flex flex-wrap gap-2">
                              {acceptedMembers.map((member) => (
                                <div key={member.id} className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1">
                                  <img
                                    src={member.profileImageUrl || '/default-avatar.png'}
                                    alt=""
                                    className="w-5 h-5 rounded-full object-cover"
                                  />
                                  <span className="text-sm text-gray-700">
                                    {member.firstName} {member.lastName}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowRegistrationViewer(false);
                  setSelectedDivisionForViewing(null);
                  setDivisionRegistrations([]);
                }}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Division Modal */}
      {showEditDivision && editingDivision && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1010]">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Edit Division</h3>
              <button
                onClick={() => {
                  setShowEditDivision(false);
                  setEditingDivision(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Division Name</label>
                <input
                  type="text"
                  value={editingDivision.name || ''}
                  onChange={(e) => setEditingDivision({ ...editingDivision, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editingDivision.description || ''}
                  onChange={(e) => setEditingDivision({ ...editingDivision, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Teams</label>
                  <input
                    type="number"
                    min="1"
                    value={editingDivision.maxUnits || ''}
                    onChange={(e) => setEditingDivision({ ...editingDivision, maxUnits: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division Fee ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingDivision.divisionFee || ''}
                    onChange={(e) => setEditingDivision({ ...editingDivision, divisionFee: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>

              {/* Schedule Configuration */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-gray-900 mb-3">Schedule Configuration</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Type</label>
                  <select
                    value={editingDivision.scheduleType || ''}
                    onChange={(e) => setEditingDivision({ ...editingDivision, scheduleType: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="">Select schedule type...</option>
                    <option value="RoundRobin">Round Robin</option>
                    <option value="RoundRobinPlayoff">Round Robin + Playoff</option>
                    <option value="SingleElimination">Single Elimination</option>
                    <option value="DoubleElimination">Double Elimination</option>
                    <option value="RandomPairing">Random Pairing</option>
                  </select>
                </div>

                {(editingDivision.scheduleType === 'RoundRobin' || editingDivision.scheduleType === 'RoundRobinPlayoff') && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Pools</label>
                      <input
                        type="number"
                        min="1"
                        value={editingDivision.poolCount || ''}
                        onChange={(e) => setEditingDivision({ ...editingDivision, poolCount: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pool Size</label>
                      <input
                        type="number"
                        min="2"
                        value={editingDivision.poolSize || ''}
                        onChange={(e) => setEditingDivision({ ...editingDivision, poolSize: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2"
                        placeholder="Auto"
                      />
                    </div>
                  </div>
                )}

                {editingDivision.scheduleType === 'RoundRobinPlayoff' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teams Advancing per Pool</label>
                    <input
                      type="number"
                      min="1"
                      value={editingDivision.playoffFromPools || ''}
                      onChange={(e) => setEditingDivision({ ...editingDivision, playoffFromPools: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2"
                      placeholder="2"
                    />
                  </div>
                )}

                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Games per Match</label>
                  <select
                    value={editingDivision.gamesPerMatch || 1}
                    onChange={(e) => setEditingDivision({ ...editingDivision, gamesPerMatch: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="1">Single Game</option>
                    <option value="3">Best of 3</option>
                    <option value="5">Best of 5</option>
                  </select>
                </div>
              </div>

              {/* Schedule Status Display */}
              {editingDivision.scheduleStatus && editingDivision.scheduleStatus !== 'NotGenerated' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm text-blue-700">
                    Schedule Status: <strong>{editingDivision.scheduleStatus}</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditDivision(false);
                  setEditingDivision(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDivision}
                disabled={savingDivision}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingDivision && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      <QrCodeModal
        url={`${window.location.origin}/events?id=${event.id}`}
        title={`Share: ${event.name}`}
        isOpen={showEventQrModal}
        onClose={() => setShowEventQrModal(false)}
      />
    </div>
  );
}

function CreateEventModal({ eventTypes, teamUnits = [], skillLevels = [], courtId, courtName, onClose, onCreate, userLocation }) {
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
    posterImageUrl: '',
    divisions: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
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
      courtId: court.venueId || court.courtId || court.id,
      courtName: court.venueName || court.courtName || court.name,
      city: court.city,
      state: court.state,
      country: court.country,
      address: court.address || court.addr1
    });
    // Auto-fill location fields
    setFormData(prev => ({
      ...prev,
      venueName: court.venueName || court.courtName || court.name || '',
      address: court.address || court.addr1 || '',
      city: court.city || '',
      state: court.state || '',
      country: court.country || 'USA'
    }));
  };

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    setError(null);
    try {
      const response = await sharedAssetApi.upload(file, 'image', 'event');
      if (response?.data?.url) {
        setFormData({ ...formData, posterImageUrl: response.data.url });
      } else if (response?.url) {
        setFormData({ ...formData, posterImageUrl: response.url });
      } else {
        setError(response.message || 'Upload failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
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
      // Combine date and time directly without timezone conversion
      const startDateTime = `${formData.startDate}T${formData.startTime}:00`;
      const endDateTime = formData.endDate
        ? `${formData.endDate}T${formData.endTime}:00`
        : `${formData.startDate}T${formData.endTime}:00`;

      const response = await eventsApi.create({
        ...formData,
        startDate: startDateTime,
        endDate: endDateTime,
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

  // Helper to generate division name from team unit and skill level
  const generateDivisionName = (teamUnitId, skillLevelId) => {
    const teamUnit = teamUnits.find(t => t.id === teamUnitId);
    const skillLevel = skillLevels.find(s => s.id === skillLevelId);
    if (teamUnit && skillLevel) {
      return `${teamUnit.name} - ${skillLevel.name}`;
    } else if (teamUnit) {
      return teamUnit.name;
    } else if (skillLevel) {
      return skillLevel.name;
    }
    return '';
  };

  const addDivision = () => {
    setFormData({
      ...formData,
      divisions: [
        ...formData.divisions,
        { name: '', teamSize: 2, teamUnitId: null, skillLevelId: null, maxTeams: null, entryFee: 0 }
      ]
    });
  };

  const updateDivision = (index, field, value) => {
    const updated = [...formData.divisions];
    updated[index][field] = value;

    // Auto-generate name when team unit or skill level changes
    if (field === 'teamUnitId' || field === 'skillLevelId') {
      const teamUnitId = field === 'teamUnitId' ? (value ? parseInt(value) : null) : updated[index].teamUnitId;
      const skillLevelId = field === 'skillLevelId' ? (value ? parseInt(value) : null) : updated[index].skillLevelId;
      updated[index].name = generateDivisionName(teamUnitId, skillLevelId);

      // Also set team size from team unit
      if (field === 'teamUnitId' && value) {
        const teamUnit = teamUnits.find(t => t.id === parseInt(value));
        if (teamUnit) {
          updated[index].teamSize = teamUnit.totalPlayers || 2;
        }
      }
    }

    setFormData({ ...formData, divisions: updated });
  };

  const removeDivision = (index) => {
    setFormData({
      ...formData,
      divisions: formData.divisions.filter((_, i) => i !== index)
    });
  };

  const stepLabels = ['Venue', 'Event Info', 'Date & Time', 'Fees', 'Divisions'];
  const totalSteps = 5;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000] overflow-y-auto">
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

          {/* Step 1: Venue Selection */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-2 text-gray-700 mb-4">
                <Building2 className="w-5 h-5 text-orange-600" />
                <span className="font-medium">Select a Venue for Your Event</span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search venues by name or location..."
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
                        <div className="font-medium text-gray-900 truncate">{court.name || 'UnNamed'}</div>
                        {court.addr1 && (
                          <div className="text-sm text-gray-600 truncate">{court.addr1}</div>
                        )}
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
                          key={court.venueId || court.courtId || court.id}
                          type="button"
                          onClick={() => handleSelectCourt(court)}
                          className={`w-full p-3 text-left hover:bg-orange-50 flex items-center gap-3 ${
                            selectedCourt?.courtId === (court.venueId || court.courtId) ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''
                          }`}
                        >
                          <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {court.venueName || court.courtName || 'UnNamed'}
                            </div>
                            {court.address && (
                              <div className="text-sm text-gray-600 truncate">{court.address}</div>
                            )}
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
                        <div className="font-medium text-gray-900">{selectedCourt.courtName || 'UnNamed'}</div>
                        {selectedCourt.address && (
                          <div className="text-sm text-gray-600">{selectedCourt.address}</div>
                        )}
                        <div className="text-sm text-gray-500">
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

              {/* Event Thumbnail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Thumbnail</label>
                <div className="flex items-center gap-4">
                  {formData.posterImageUrl ? (
                    <div className="relative">
                      <img
                        src={getSharedAssetUrl(formData.posterImageUrl)}
                        alt="Event thumbnail"
                        className="w-24 h-24 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, posterImageUrl: '' })}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 hover:bg-orange-50">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                      {uploadingImage ? (
                        <Loader2 className="w-6 h-6 text-orange-600 animate-spin" />
                      ) : (
                        <>
                          <Image className="w-6 h-6 text-gray-400" />
                          <span className="text-xs text-gray-500 mt-1">Upload</span>
                        </>
                      )}
                    </label>
                  )}
                  <p className="text-xs text-gray-500">Max 5MB. JPG or PNG recommended.</p>
                </div>
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
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex justify-between">
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
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Team Unit *</label>
                          <select
                            value={div.teamUnitId || ''}
                            onChange={(e) => updateDivision(index, 'teamUnitId', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                          >
                            <option value="">Select team unit...</option>
                            {teamUnits.map(unit => (
                              <option key={unit.id} value={unit.id}>
                                {unit.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Skill Level *</label>
                          <select
                            value={div.skillLevelId || ''}
                            onChange={(e) => updateDivision(index, 'skillLevelId', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                          >
                            <option value="">Select skill level...</option>
                            {skillLevels.map(level => (
                              <option key={level.id} value={level.id}>
                                {level.name}{level.description ? ` - ${level.description}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Division Name</label>
                        <input
                          type="text"
                          placeholder="Auto-generated from Team Unit and Skill Level"
                          value={div.name}
                          onChange={(e) => updateDivision(index, 'name', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-gray-50"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Max Teams</label>
                          <input
                            type="number"
                            min="1"
                            placeholder="Unlimited"
                            value={div.maxTeams || ''}
                            onChange={(e) => updateDivision(index, 'maxTeams', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Entry Fee ($)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={div.entryFee || 0}
                            onChange={(e) => updateDivision(index, 'entryFee', parseFloat(e.target.value) || 0)}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                          />
                        </div>
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
