import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Search, Filter, MapPin, Plus, Globe, Mail, Phone, ChevronLeft, ChevronRight, X, Copy, Check, Bell, UserPlus, Settings, Crown, Shield, Clock, DollarSign, Calendar, Upload, Image, Edit3, RefreshCw, Trash2, MessageCircle, List, Map, Loader2, Star, Heart, Award, Briefcase, ClipboardList, Flag, Key, Medal, Trophy, Wrench, Zap, Megaphone, UserCog, FileText, Download, File, Video, Table, Presentation, Eye, EyeOff, Lock, GripVertical } from 'lucide-react';

// Icon mapping for role icons
const ROLE_ICON_MAP = {
  Crown, Shield, DollarSign, Users, Star, Heart, Award, Medal, Trophy,
  Briefcase, Calendar, ClipboardList, Flag, Key, Settings, Wrench, Zap, Megaphone, UserCog
};

const getRoleIcon = (iconName) => {
  return ROLE_ICON_MAP[iconName] || null;
};
import { useAuth } from '../contexts/AuthContext';
import { clubsApi, sharedAssetApi, clubMemberRolesApi, venuesApi, getSharedAssetUrl, SHARED_AUTH_URL } from '../services/api';
import PublicProfileModal from '../components/ui/PublicProfileModal';
import VenueMap from '../components/ui/VenueMap';

export default function Clubs() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite');

  const [clubs, setClubs] = useState([]);
  const [myClubs, setMyClubs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [countries, setCountries] = useState([]);
  const [statesWithCounts, setStatesWithCounts] = useState([]);
  const [citiesWithCounts, setCitiesWithCounts] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(100);
  const [selectedClub, setSelectedClub] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteClub, setInviteClub] = useState(null);
  const [activeTab, setActiveTab] = useState(isAuthenticated ? 'my-clubs' : 'search'); // my-clubs, search
  const [joinMessage, setJoinMessage] = useState(null); // { type: 'success'|'error', text: string }
  const [memberRoles, setMemberRoles] = useState([]);
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const pageSize = 20;

  // View mode: 'list' or 'map'
  const [viewMode, setViewMode] = useState('list');

  // Sorting
  const [sortBy, setSortBy] = useState('distance'); // distance, name
  const [sortOrder, setSortOrder] = useState('asc');

  // Location state
  const [locationError, setLocationError] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);

  // For map view hover
  const [hoveredClubId, setHoveredClubId] = useState(null);

  // Load available member roles on mount
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await clubMemberRolesApi.getAll();
        if (response.success) {
          setMemberRoles(response.data || []);
        }
      } catch (err) {
        console.error('Error loading member roles:', err);
      }
    };
    loadRoles();
  }, []);

  // Load countries on mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await clubsApi.getCountries();
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
        const response = await clubsApi.getStatesByCountry(country);
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
        const response = await clubsApi.getCitiesByState(country, state);
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

  // Get user's location on mount with improved two-stage approach
  const getLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setSortBy('name');
      return;
    }

    // Check permission state first if available
    if (navigator.permissions) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          setLocationBlocked(true);
          setLocationError('Location access is blocked. Enable location in browser settings to sort by distance.');
          setSortBy('name');
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
          setSortBy('name');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('Location unavailable.');
          setSortBy('name');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Location request timed out.');
          setSortBy('name');
        } else {
          setLocationError('Unable to get your location.');
          setSortBy('name');
        }
        setGettingLocation(false);
      }
    }
  }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  // Check invite code on mount
  useEffect(() => {
    if (inviteCode) {
      loadInviteClub(inviteCode);
    }
  }, [inviteCode]);

  const loadInviteClub = async (code) => {
    try {
      const response = await clubsApi.getByInviteCode(code);
      if (response.success) {
        setInviteClub(response.data);
      }
    } catch (err) {
      console.error('Invalid invite code:', err);
    }
  };

  // Load my clubs when authenticated, set appropriate tab
  useEffect(() => {
    if (isAuthenticated) {
      loadMyClubs();
      setActiveTab('my-clubs');
    } else {
      setActiveTab('search');
    }
  }, [isAuthenticated]);

  const loadMyClubs = async () => {
    try {
      const response = await clubsApi.getMyClubs();
      if (response.success) {
        setMyClubs(response.data);
      }
    } catch (err) {
      console.error('Error loading my clubs:', err);
    }
  };

  // Load clubs
  const loadClubs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize,
        query: searchQuery || undefined,
        country: country || undefined,
        state: state || undefined,
        city: city || undefined,
        latitude: userLocation?.lat,
        longitude: userLocation?.lng,
        radiusMiles: userLocation ? radiusMiles : undefined,
        sortBy: sortBy,
        sortOrder: sortOrder
      };

      const response = await clubsApi.search(params);
      if (response.success && response.data) {
        setClubs(response.data.items || []);
        setTotalPages(response.data.totalPages || 1);
        setTotalCount(response.data.totalCount || 0);
      }
    } catch (err) {
      console.error('Error loading clubs:', err);
      setClubs([]);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, country, state, city, userLocation, radiusMiles, sortBy, sortOrder]);

  useEffect(() => {
    if (activeTab === 'search') {
      loadClubs();
    }
  }, [loadClubs, activeTab]);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState(null);
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      setPage(1);
    }, 500));
  };

  const handleViewDetails = async (club) => {
    try {
      const response = await clubsApi.getClub(club.id);
      if (response.success) {
        setSelectedClub(response.data);
      }
    } catch (err) {
      console.error('Error loading club details:', err);
    }
  };

  const handleJoinClub = async (clubId, code = null) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setJoinMessage(null);
    try {
      const response = await clubsApi.join(clubId, code ? { inviteCode: code } : {});
      if (response.success) {
        setJoinMessage({ type: 'success', text: response.message || 'Successfully joined the club!' });
        loadMyClubs();
        if (selectedClub) {
          const updated = await clubsApi.getClub(clubId);
          if (updated.success) setSelectedClub(updated.data);
        }
        setInviteClub(null);
      } else {
        setJoinMessage({ type: 'error', text: response.message || 'Failed to join club' });
      }
    } catch (err) {
      console.error('Error joining club:', err);
      // err could be the API response data or an error message
      const message = err?.message || (typeof err === 'string' ? err : 'An error occurred while joining the club');
      setJoinMessage({ type: 'error', text: message });
    }
    // Auto-clear message after 5 seconds
    setTimeout(() => setJoinMessage(null), 5000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Users className="w-12 h-12" />
              <div>
                <h1 className="text-3xl font-bold">Pickleball Clubs</h1>
                <p className="text-purple-100 mt-1">
                  Find and join local clubs or create your own
                </p>
              </div>
            </div>
            {isAuthenticated && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Club
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Join Message Toast */}
        {joinMessage && (
          <div className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
            joinMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <span>{joinMessage.text}</span>
            <button
              onClick={() => setJoinMessage(null)}
              className="ml-4 text-current opacity-60 hover:opacity-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Invite Banner */}
        {inviteClub && (
          <div className="mb-6 p-6 bg-purple-50 border border-purple-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {inviteClub.logoUrl ? (
                  <img src={getSharedAssetUrl(inviteClub.logoUrl)} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-purple-200 flex items-center justify-center">
                    <Users className="w-8 h-8 text-purple-600" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">You've been invited to join {inviteClub.name}!</h3>
                  <p className="text-gray-600">{inviteClub.memberCount} members • {inviteClub.city}{inviteClub.state && `, ${inviteClub.state}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleJoinClub(inviteClub.id, inviteCode)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  Join Club
                </button>
                <button
                  onClick={() => { setInviteClub(null); navigate('/clubs', { replace: true }); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        {isAuthenticated && (
          <div className="mb-6 border-b">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('my-clubs')}
                className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'my-clubs'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                My Clubs
                {myClubs && (myClubs.clubsIManage.length + myClubs.clubsIBelong.length) > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-600 rounded-full">
                    {myClubs.clubsIManage.length + myClubs.clubsIBelong.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'search'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Search Clubs
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
                <div className="flex-1 min-w-[250px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search clubs..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Country Filter */}
                <select
                  value={country}
                  onChange={(e) => { setCountry(e.target.value); setPage(1); }}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">All Countries</option>
                  {countries.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count})
                    </option>
                  ))}
                </select>

                {/* State Filter */}
                <select
                  value={state}
                  onChange={(e) => { setState(e.target.value); setPage(1); }}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={!country}
                >
                  <option value="">All States</option>
                  {statesWithCounts.map(s => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.count})
                    </option>
                  ))}
                </select>

                {/* City Filter */}
                <select
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setPage(1); }}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={!state}
                >
                  <option value="">All Cities</option>
                  {citiesWithCounts.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count})
                    </option>
                  ))}
                </select>

                {/* Distance Filter (only if location available) */}
                {userLocation && (
                  <select
                    value={radiusMiles}
                    onChange={(e) => { setRadiusMiles(parseInt(e.target.value)); setPage(1); }}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value={10}>Within 10 miles</option>
                    <option value={25}>Within 25 miles</option>
                    <option value={50}>Within 50 miles</option>
                    <option value={100}>Within 100 miles</option>
                    <option value={250}>Within 250 miles</option>
                    <option value={500}>Within 500 miles</option>
                  </select>
                )}
              </div>

              {/* Second row: Sort, View Mode */}
              <div className="flex flex-wrap gap-4 items-center mt-4 pt-4 border-t border-gray-100">
                {/* Sort By */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                  >
                    {userLocation && <option value="distance">Distance</option>}
                    <option value="name">Name</option>
                    <option value="memberCount">Members</option>
                  </select>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 flex items-center gap-1 ${
                      viewMode === 'list'
                        ? 'bg-purple-600 text-white'
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
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Map className="w-4 h-4" />
                    <span className="text-sm">Map</span>
                  </button>
                </div>

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

            {/* Clubs Results */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
              </div>
            ) : clubs.length > 0 ? (
              <>
                {viewMode === 'map' ? (
                  /* Map View with Side List */
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="flex h-[600px]">
                      {/* Compact Club List */}
                      <div className="w-80 border-r border-gray-200 flex flex-col">
                        <div className="p-3 border-b bg-gray-50">
                          <p className="text-sm font-medium text-gray-700">
                            {clubs.filter(c => c.latitude || c.gpsLat).length} clubs on map
                          </p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          {clubs.filter(c => c.latitude || c.gpsLat).map((club, index) => {
                            const clubId = club.id;
                            const isSelected = hoveredClubId === clubId;
                            return (
                              <div
                                key={clubId}
                                className={`p-3 border-b border-gray-100 cursor-pointer transition-colors ${
                                  isSelected ? 'bg-purple-50 border-l-4 border-l-purple-500' : 'hover:bg-gray-50'
                                }`}
                                onClick={() => handleViewDetails(club)}
                                onMouseEnter={() => setHoveredClubId(clubId)}
                                onMouseLeave={() => setHoveredClubId(null)}
                              >
                                <div className="flex items-start gap-2">
                                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                                    isSelected ? 'bg-purple-600' : 'bg-blue-600'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 text-sm truncate">
                                      {club.name}
                                    </h4>
                                    <p className="text-xs text-gray-500 truncate">
                                      {[club.city, club.state].filter(Boolean).join(', ')}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {club.distance && (
                                        <span className="text-xs text-purple-600 font-medium">
                                          {club.distance.toFixed(1)} mi
                                        </span>
                                      )}
                                      <span className="text-xs text-gray-400">
                                        {club.memberCount} members
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {clubs.filter(c => !(c.latitude || c.gpsLat)).length > 0 && (
                            <div className="p-3 text-xs text-gray-400 text-center">
                              {clubs.filter(c => !(c.latitude || c.gpsLat)).length} clubs without coordinates
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Map */}
                      <div className="flex-1">
                        <VenueMap
                          venues={clubs.map(c => ({
                            ...c,
                            id: c.id,
                            name: c.name,
                            latitude: c.latitude,
                            longitude: c.longitude
                          }))}
                          userLocation={userLocation}
                          onVenueClick={(club) => handleViewDetails(club)}
                          onMarkerSelect={(club) => setHoveredClubId(club.id)}
                          selectedVenueId={hoveredClubId}
                          showNumbers={true}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* List View */
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {clubs.map(club => (
                      <ClubCard
                        key={club.id}
                        club={club}
                        onViewDetails={() => handleViewDetails(club)}
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
                    <span className="text-gray-600">
                      Page {page} of {totalPages}
                    </span>
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
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Clubs Found</h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery || state || city
                    ? 'No clubs match your search criteria. Try adjusting your filters.'
                    : 'No clubs have been created in this area yet.'}
                </p>
                {isAuthenticated && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Create the First Club
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'my-clubs' && myClubs && (
          <div className="space-y-8">
            {/* Clubs I Manage */}
            {myClubs.clubsIManage.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  Clubs I Manage
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {myClubs.clubsIManage.map(club => (
                    <ClubCard
                      key={club.id}
                      club={club}
                      onViewDetails={() => handleViewDetails(club)}
                      showManageButton
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Clubs I Belong To */}
            {myClubs.clubsIBelong.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  Clubs I'm a Member Of
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {myClubs.clubsIBelong.map(club => (
                    <ClubCard
                      key={club.id}
                      club={club}
                      onViewDetails={() => handleViewDetails(club)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pending Requests */}
            {myClubs.pendingRequests.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  Pending Join Requests
                </h2>
                <div className="space-y-3">
                  {myClubs.pendingRequests.map(request => (
                    <div key={request.id} className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{request.clubName}</h3>
                        <p className="text-sm text-gray-500">Requested {new Date(request.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {myClubs.clubsIManage.length === 0 && myClubs.clubsIBelong.length === 0 && myClubs.pendingRequests.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">You're Not in Any Clubs Yet</h3>
                <p className="text-gray-500 mb-6">
                  Join an existing club or create your own!
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => setActiveTab('search')}
                    className="px-6 py-2 border border-purple-600 text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
                  >
                    Search Clubs
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Create Club
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Club Detail Modal */}
      {selectedClub && (
        <ClubDetailModal
          club={selectedClub}
          isAuthenticated={isAuthenticated}
          currentUserId={user?.id}
          onClose={() => setSelectedClub(null)}
          onJoin={() => handleJoinClub(selectedClub.id)}
          onUpdate={() => {
            loadMyClubs();
            loadClubs();
          }}
          memberRoles={memberRoles}
        />
      )}

      {/* Create Club Modal */}
      {showCreateModal && (
        <CreateClubModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(newClub) => {
            setShowCreateModal(false);
            loadMyClubs();
            handleViewDetails(newClub);
          }}
        />
      )}

      {/* Public Profile Modal */}
      {profileModalUserId && (
        <PublicProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
    </div>
  );
}

function ClubCard({ club, onViewDetails, showManageButton = false }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {club.logoUrl && (
        <div className="h-32 bg-purple-100 relative">
          <img
            src={getSharedAssetUrl(club.logoUrl)}
            alt={club.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900">{club.name}</h3>
          <div className="flex items-center gap-1 text-purple-600">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">{club.memberCount}</span>
          </div>
        </div>

        {club.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{club.description}</p>
        )}

        <div className="space-y-2 text-sm text-gray-600">
          {club.homeVenueId && club.homeVenueName ? (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <Link
                to={`/venues?venueId=${club.homeVenueId}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate text-purple-600 hover:text-purple-700 hover:underline"
              >
                {club.homeVenueName}
              </Link>
            </div>
          ) : (club.city || club.state) && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {club.city}{club.state && `, ${club.state}`}{club.country && club.country !== 'USA' && `, ${club.country}`}
              </span>
            </div>
          )}
          {club.distance && (
            <div className="flex items-center gap-2 text-purple-600">
              <MapPin className="w-4 h-4" />
              <span>{club.distance.toFixed(1)} miles away</span>
            </div>
          )}
          {club.hasMembershipFee && (
            <div className="flex items-center gap-2 text-green-600">
              <DollarSign className="w-4 h-4" />
              <span>Membership Fee{club.membershipFeeAmount && `: ${club.membershipFeeAmount}`}</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onViewDetails}
            className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            View Details
          </button>
          {showManageButton && (
            <button
              onClick={onViewDetails}
              className="p-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ClubDetailModal({ club, isAuthenticated, currentUserId, onClose, onJoin, onUpdate, memberRoles }) {
  const [activeTab, setActiveTab] = useState('about');
  const [members, setMembers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [newNotification, setNewNotification] = useState({ title: '', message: '' });
  const [sendingNotification, setSendingNotification] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberEditData, setMemberEditData] = useState({ title: '', membershipValidTo: '', membershipNotes: '' });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [clubData, setClubData] = useState(club);
  const [chatEnabled, setChatEnabled] = useState(club.chatEnabled || false);
  const [togglingChat, setTogglingChat] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [savingInfo, setSavingInfo] = useState(false);
  const [venueSearch, setVenueSearch] = useState('');
  const [venueResults, setVenueResults] = useState([]);
  const [searchingVenues, setSearchingVenues] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState(null);

  // Documents state
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocument, setNewDocument] = useState({ title: '', description: '', visibility: 'Member', fileUrl: '', fileName: '', mimeType: '', fileSizeBytes: 0 });
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const documentInputRef = useRef(null);

  const logoInputRef = useRef(null);
  const navigate = useNavigate();

  const isAdmin = clubData.isAdmin;
  const isModerator = clubData.isModerator;
  const isMember = clubData.isMember;
  const canManage = isAdmin || isModerator;
  const isCreator = clubData.createdByUserId === currentUserId;
  const canEdit = isAdmin || isCreator;

  useEffect(() => {
    if (activeTab === 'members') loadMembers();
    if (activeTab === 'requests' && canManage) loadJoinRequests();
    if (activeTab === 'notifications') loadNotifications();
    if (activeTab === 'documents') loadDocuments();
  }, [activeTab]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const response = await clubsApi.getMembers(club.id);
      if (response.success) {
        setMembers(response.data || []);
      }
    } catch (err) {
      console.error('Error loading members:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadJoinRequests = async () => {
    setLoading(true);
    try {
      const response = await clubsApi.getJoinRequests(club.id);
      if (response.success) {
        setJoinRequests(response.data || []);
      }
    } catch (err) {
      console.error('Error loading join requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await clubsApi.getNotifications(club.id);
      if (response.success) {
        setNotifications(response.data || []);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    setDocumentsLoading(true);
    try {
      const response = await clubsApi.getDocuments(club.id);
      if (response.success) {
        setDocuments(response.data || []);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);
    try {
      const response = await sharedAssetApi.upload(file);
      if (response.url) {
        setNewDocument({
          ...newDocument,
          fileUrl: response.url,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size
        });
      }
    } catch (err) {
      console.error('Error uploading document:', err);
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleCreateDocument = async () => {
    if (!newDocument.title.trim() || !newDocument.fileUrl) return;

    try {
      const response = await clubsApi.createDocument(club.id, {
        title: newDocument.title,
        description: newDocument.description,
        fileUrl: newDocument.fileUrl,
        fileName: newDocument.fileName,
        mimeType: newDocument.mimeType,
        fileSizeBytes: newDocument.fileSizeBytes,
        visibility: newDocument.visibility,
        sortOrder: documents.length
      });
      if (response.success) {
        setDocuments([...documents, response.data]);
        setNewDocument({ title: '', description: '', visibility: 'Member', fileUrl: '', fileName: '', mimeType: '', fileSizeBytes: 0 });
        setShowAddDocument(false);
      }
    } catch (err) {
      console.error('Error creating document:', err);
    }
  };

  const handleUpdateDocument = async (documentId, updates) => {
    try {
      const response = await clubsApi.updateDocument(club.id, documentId, updates);
      if (response.success) {
        setDocuments(documents.map(d => d.id === documentId ? response.data : d));
        setEditingDocument(null);
      }
    } catch (err) {
      console.error('Error updating document:', err);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await clubsApi.deleteDocument(club.id, documentId);
      if (response.success) {
        setDocuments(documents.filter(d => d.id !== documentId));
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const getFileTypeIcon = (fileType) => {
    switch (fileType) {
      case 'Image': return Image;
      case 'Video': return Video;
      case 'PDF': return FileText;
      case 'Document': return File;
      case 'Spreadsheet': return Table;
      case 'Presentation': return Presentation;
      default: return File;
    }
  };

  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'Public': return Globe;
      case 'Member': return Users;
      case 'Admin': return Lock;
      default: return Eye;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleToggleChat = async () => {
    setTogglingChat(true);
    try {
      if (chatEnabled) {
        await clubsApi.disableChat(club.id);
        setChatEnabled(false);
      } else {
        await clubsApi.enableChat(club.id);
        setChatEnabled(true);
      }
    } catch (err) {
      console.error('Error toggling club chat:', err);
    } finally {
      setTogglingChat(false);
    }
  };

  const handleOpenChat = async () => {
    try {
      const response = await clubsApi.getChat(club.id);
      if (response.success && response.data) {
        navigate(`/messages?conversation=${response.data}`);
      }
    } catch (err) {
      console.error('Error opening club chat:', err);
    }
  };

  const handleGetInviteLink = async () => {
    try {
      const response = await clubsApi.getInviteLink(club.id);
      if (response.success) {
        setInviteCode(response.data);
      }
    } catch (err) {
      console.error('Error getting invite link:', err);
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/clubs?invite=${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle club logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Logo must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      // Upload to Funtime-Shared
      const response = await sharedAssetApi.upload(file, 'image', 'club');
      // Save only relative path to DB - use response.data.url directly
      // Response: { data: { success: true, url: "/asset/11", ... } }
      let logoUrl;
      if (response?.data?.url) {
        logoUrl = response.data.url;
      } else if (response?.url) {
        logoUrl = response.url;
      }

      if (logoUrl) {
        // Update club with new logo path (relative)
        const updateResponse = await clubsApi.update(clubData.id, { ...clubData, logoUrl });
        if (updateResponse.success) {
          setClubData(prev => ({ ...prev, logoUrl }));
          onUpdate();
        }
      }
    } catch (err) {
      console.error('Error uploading logo:', err);
      alert('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  // Handle logo removal
  const handleRemoveLogo = async () => {
    if (!confirm('Remove club logo?')) return;
    try {
      const updateResponse = await clubsApi.update(clubData.id, { ...clubData, logoUrl: null });
      if (updateResponse.success) {
        setClubData(prev => ({ ...prev, logoUrl: null }));
        onUpdate();
      }
    } catch (err) {
      console.error('Error removing logo:', err);
    }
  };

  const handleReviewRequest = async (requestId, approve) => {
    try {
      await clubsApi.reviewRequest(club.id, requestId, approve);
      loadJoinRequests();
      onUpdate();
    } catch (err) {
      console.error('Error reviewing request:', err);
    }
  };

  const handleUpdateRole = async (memberId, role) => {
    try {
      await clubsApi.updateMemberRole(club.id, memberId, role);
      loadMembers();
      onUpdate();
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await clubsApi.removeMember(club.id, memberId);
      loadMembers();
      onUpdate();
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const handleSendNotification = async () => {
    if (!newNotification.title || !newNotification.message) return;
    setSendingNotification(true);
    try {
      await clubsApi.sendNotification(club.id, newNotification.title, newNotification.message);
      setNewNotification({ title: '', message: '' });
      loadNotifications();
    } catch (err) {
      console.error('Error sending notification:', err);
    } finally {
      setSendingNotification(false);
    }
  };

  const handleLeaveClub = async () => {
    if (!confirm('Are you sure you want to leave this club?')) return;
    try {
      await clubsApi.leave(club.id);
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error leaving club:', err);
    }
  };

  // When editing a member, load their current data
  useEffect(() => {
    if (editingMember) {
      setMemberEditData({
        title: editingMember.title || '',
        membershipValidTo: editingMember.membershipValidTo ? editingMember.membershipValidTo.split('T')[0] : '',
        membershipNotes: editingMember.membershipNotes || ''
      });
    }
  }, [editingMember]);

  const handleSaveMemberDetails = async () => {
    if (!editingMember) return;
    try {
      const data = {
        title: memberEditData.title || null,
        membershipValidTo: memberEditData.membershipValidTo ? new Date(memberEditData.membershipValidTo).toISOString() : null,
        membershipNotes: memberEditData.membershipNotes || null
      };
      await clubsApi.updateMember(club.id, editingMember.id, data);
      setEditingMember(null);
      loadMembers();
    } catch (err) {
      console.error('Error updating member:', err);
    }
  };

  // Search venues for home venue selection
  useEffect(() => {
    if (!venueSearch || venueSearch.length < 2) {
      setVenueResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingVenues(true);
      try {
        const response = await venuesApi.search({ query: venueSearch, pageSize: 10 });
        if (response.success) {
          setVenueResults(response.data?.items || []);
        }
      } catch (err) {
        console.error('Error searching venues:', err);
      } finally {
        setSearchingVenues(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [venueSearch]);

  // Start editing club info
  const handleStartEditInfo = () => {
    setEditFormData({
      name: clubData.name || '',
      description: clubData.description || '',
      address: clubData.address || '',
      city: clubData.city || '',
      state: clubData.state || '',
      country: clubData.country || '',
      postalCode: clubData.postalCode || '',
      website: clubData.website || '',
      email: clubData.email || '',
      phone: clubData.phone || '',
      isPublic: clubData.isPublic ?? true,
      requiresApproval: clubData.requiresApproval ?? true,
      hasMembershipFee: clubData.hasMembershipFee ?? false,
      membershipFeeAmount: clubData.membershipFeeAmount || '',
      membershipFeePeriod: clubData.membershipFeePeriod || '',
      paymentInstructions: clubData.paymentInstructions || '',
      homeVenueId: clubData.homeVenueId || null,
    });
    setSelectedVenue(clubData.homeVenueName ? { id: clubData.homeVenueId, name: clubData.homeVenueName } : null);
    setVenueSearch('');
    setVenueResults([]);
    setIsEditingInfo(true);
  };

  // Save club info
  const handleSaveInfo = async () => {
    setSavingInfo(true);
    try {
      const dataToSave = {
        ...editFormData,
        homeVenueId: selectedVenue?.id || null,
      };
      const response = await clubsApi.update(clubData.id, dataToSave);
      if (response.success) {
        // Refresh club data
        const refreshed = await clubsApi.getClub(clubData.id);
        if (refreshed.success) {
          setClubData(refreshed.data);
        }
        setIsEditingInfo(false);
        onUpdate();
      }
    } catch (err) {
      console.error('Error saving club info:', err);
      alert('Failed to save club info');
    } finally {
      setSavingInfo(false);
    }
  };

  // Select a venue from search results
  const handleSelectVenue = (venue) => {
    setSelectedVenue(venue);
    setVenueSearch('');
    setVenueResults([]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            {club.logoUrl ? (
              <img src={getSharedAssetUrl(club.logoUrl)} alt="" className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{club.name}</h2>
              <p className="text-sm text-gray-500">
                {club.memberCount} member{club.memberCount !== 1 ? 's' : ''}
                {club.city && ` • ${club.city}${club.state ? `, ${club.state}` : ''}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('about')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'about'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              About
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'members'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Members
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'notifications'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'documents'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Documents
            </button>
            {canManage && (
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'requests'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Join Requests
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setActiveTab('manage')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'manage'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Manage
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              {/* Join/Leave Button */}
              {!isMember && !club.hasPendingRequest && (
                <button
                  onClick={onJoin}
                  disabled={!isAuthenticated}
                  className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {club.requiresApproval ? 'Request to Join' : 'Join Club'}
                </button>
              )}
              {club.hasPendingRequest && (
                <div className="p-4 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-center">
                  Your join request is pending approval
                </div>
              )}
              {isMember && !isAdmin && (
                <button
                  onClick={handleLeaveClub}
                  className="w-full py-3 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors"
                >
                  Leave Club
                </button>
              )}

              {/* Description */}
              {club.description && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">About</h3>
                  <p className="text-gray-600">{club.description}</p>
                </div>
              )}

              {/* Home Venue & Location */}
              {(club.homeVenueName || club.address || club.city) && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    {club.homeVenueName ? 'Home Venue' : 'Location'}
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm">
                    {club.homeVenueName && (
                      club.homeVenueId ? (
                        <Link
                          to={`/venues?venueId=${club.homeVenueId}`}
                          className="font-medium text-purple-600 hover:text-purple-700 hover:underline block mb-1"
                        >
                          {club.homeVenueName}
                        </Link>
                      ) : (
                        <p className="font-medium text-purple-700 mb-1">{club.homeVenueName}</p>
                      )
                    )}
                    {club.address && <p>{club.address}</p>}
                    <p>{club.city}{club.state && `, ${club.state}`} {club.postalCode}</p>
                    {club.country && <p>{club.country}</p>}
                  </div>
                </div>
              )}

              {/* Membership Fee */}
              {club.hasMembershipFee && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Membership Fee
                  </h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-semibold text-green-800">{club.membershipFeeAmount || 'Fee Required'}</span>
                      {club.membershipFeePeriod && (
                        <span className="text-sm text-green-600 capitalize">{club.membershipFeePeriod}</span>
                      )}
                    </div>
                    {(isMember || isAdmin) && club.paymentInstructions && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <h4 className="text-sm font-medium text-green-800 mb-1">Payment Instructions</h4>
                        <p className="text-sm text-green-700 whitespace-pre-wrap">{club.paymentInstructions}</p>
                      </div>
                    )}
                    {!isMember && !isAdmin && (
                      <p className="text-sm text-green-600 mt-2">Join to see payment instructions</p>
                    )}
                  </div>
                  {/* Show user's membership status */}
                  {isMember && club.myMembershipValidTo && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className={`${new Date(club.myMembershipValidTo) < new Date() ? 'text-red-600' : 'text-gray-600'}`}>
                        Membership valid until: {new Date(club.myMembershipValidTo).toLocaleDateString()}
                        {new Date(club.myMembershipValidTo) < new Date() && ' (Expired)'}
                      </span>
                    </div>
                  )}
                  {isMember && club.myTitle && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      <span className="text-gray-600">Title: {club.myTitle}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Contact */}
              {(club.website || club.email || club.phone) && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Contact</h3>
                  <div className="space-y-2 text-sm">
                    {club.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <a href={club.website} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                          {club.website}
                        </a>
                      </div>
                    )}
                    {club.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <a href={`mailto:${club.email}`} className="text-purple-600 hover:underline">
                          {club.email}
                        </a>
                      </div>
                    )}
                    {club.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{club.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Members */}
              {club.recentMembers?.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Recent Members</h3>
                  <div className="flex flex-wrap gap-2">
                    {club.recentMembers.slice(0, 8).map(member => (
                      <div key={member.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        {member.profileImageUrl ? (
                          <img src={getSharedAssetUrl(member.profileImageUrl)} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <span className="text-purple-600 text-sm font-medium">
                              {member.name?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                        <span className="text-sm text-gray-700">{member.name}</span>
                        {(() => {
                          const roleData = memberRoles.find(r => r.name === member.role);
                          const IconComponent = roleData?.icon ? getRoleIcon(roleData.icon) : null;
                          if (IconComponent) {
                            const colorClass = roleData.color === 'yellow' ? 'text-yellow-500' :
                                               roleData.color === 'blue' ? 'text-blue-500' :
                                               roleData.color === 'green' ? 'text-green-500' :
                                               roleData.color === 'red' ? 'text-red-500' :
                                               roleData.color === 'purple' ? 'text-purple-500' :
                                               roleData.color === 'orange' ? 'text-orange-500' :
                                               'text-gray-500';
                            return <IconComponent className={`w-4 h-4 ${colorClass}`} />;
                          }
                          return null;
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
                </div>
              ) : members.length > 0 ? (
                <div className="space-y-3">
                  {members.map(member => (
                    <div key={member.id} className={`flex items-center justify-between p-3 rounded-lg ${member.isMembershipExpired ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <div
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setProfileModalUserId(member.userId)}
                      >
                        {member.profileImageUrl ? (
                          <img src={getSharedAssetUrl(member.profileImageUrl)} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <span className="text-purple-600 font-medium">
                              {member.name?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 hover:text-purple-600">{member.name}</span>
                            {(() => {
                              const roleData = memberRoles.find(r => r.name === member.role);
                              const IconComponent = roleData?.icon ? getRoleIcon(roleData.icon) : null;
                              if (IconComponent) {
                                const colorClass = roleData.color === 'yellow' ? 'text-yellow-500' :
                                                   roleData.color === 'blue' ? 'text-blue-500' :
                                                   roleData.color === 'green' ? 'text-green-500' :
                                                   roleData.color === 'red' ? 'text-red-500' :
                                                   roleData.color === 'purple' ? 'text-purple-500' :
                                                   roleData.color === 'orange' ? 'text-orange-500' :
                                                   'text-gray-500';
                                return <IconComponent className={`w-4 h-4 ${colorClass}`} />;
                              }
                              return null;
                            })()}
                            {member.title && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{member.title}</span>
                            )}
                            {member.isMembershipExpired && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Expired</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                            {member.membershipValidTo && ` • Valid to ${new Date(member.membershipValidTo).toLocaleDateString()}`}
                          </p>
                          {isAdmin && member.membershipNotes && (
                            <p className="text-xs text-gray-400 mt-1 italic">Note: {member.membershipNotes}</p>
                          )}
                        </div>
                      </div>
                      {isAdmin && member.userId !== currentUserId && (
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            {memberRoles.length > 0 ? (
                              memberRoles.map(role => (
                                <option key={role.id} value={role.name}>{role.name}</option>
                              ))
                            ) : (
                              <>
                                <option value="Member">Member</option>
                                <option value="Moderator">Moderator</option>
                                <option value="Admin">Admin</option>
                              </>
                            )}
                          </select>
                          <button
                            onClick={() => setEditingMember(member)}
                            className="p-1 text-purple-500 hover:bg-purple-50 rounded"
                            title="Edit member details"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No members yet</p>
              )}
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              {/* Send Notification Form (for admins/mods) */}
              {canManage && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-purple-600" />
                    Send Notification to All Members
                  </h3>
                  <input
                    type="text"
                    placeholder="Title"
                    value={newNotification.title}
                    onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                  <textarea
                    placeholder="Message"
                    value={newNotification.message}
                    onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                  <button
                    onClick={handleSendNotification}
                    disabled={sendingNotification || !newNotification.title || !newNotification.message}
                    className="w-full py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
                  >
                    {sendingNotification ? 'Sending...' : 'Send Notification'}
                  </button>
                </div>
              )}

              {/* Notifications List */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
                </div>
              ) : notifications.length > 0 ? (
                <div className="space-y-4">
                  {notifications.map(notification => (
                    <div key={notification.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{notification.title}</h4>
                        <span className="text-sm text-gray-500">
                          {new Date(notification.sentAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm">{notification.message}</p>
                      <p className="text-xs text-gray-400 mt-2">by {notification.sentByUserName}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No notifications yet</p>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div>
              {/* Add Document Button (Admin only) */}
              {isAdmin && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowAddDocument(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Document
                  </button>
                </div>
              )}

              {/* Add Document Form */}
              {showAddDocument && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-medium text-gray-900 mb-4">Add New Document</h3>
                  <div className="space-y-4">
                    {/* File Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                      <input
                        type="file"
                        ref={documentInputRef}
                        onChange={handleDocumentUpload}
                        className="hidden"
                      />
                      {newDocument.fileUrl ? (
                        <div className="flex items-center gap-3 p-3 bg-white rounded border">
                          {(() => {
                            const FileIcon = getFileTypeIcon(newDocument.mimeType?.startsWith('image') ? 'Image' :
                              newDocument.mimeType?.startsWith('video') ? 'Video' :
                              newDocument.mimeType === 'application/pdf' ? 'PDF' : 'Document');
                            return <FileIcon className="w-8 h-8 text-purple-600" />;
                          })()}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{newDocument.fileName}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(newDocument.fileSizeBytes)}</p>
                          </div>
                          <button
                            onClick={() => setNewDocument({ ...newDocument, fileUrl: '', fileName: '', mimeType: '', fileSizeBytes: 0 })}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => documentInputRef.current?.click()}
                          disabled={uploadingDocument}
                          className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-purple-400 hover:bg-purple-50 transition-colors"
                        >
                          {uploadingDocument ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                              <span className="text-gray-600">Uploading...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Upload className="w-8 h-8 text-gray-400" />
                              <span className="text-sm text-gray-600">Click to upload a file</span>
                              <span className="text-xs text-gray-400">Images, PDFs, Documents, Videos</span>
                            </div>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={newDocument.title}
                        onChange={(e) => setNewDocument({ ...newDocument, title: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2"
                        placeholder="Document title"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                      <textarea
                        value={newDocument.description}
                        onChange={(e) => setNewDocument({ ...newDocument, description: e.target.value })}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg p-2"
                        placeholder="Brief description of the document"
                      />
                    </div>

                    {/* Visibility */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Who can view this?</label>
                      <select
                        value={newDocument.visibility}
                        onChange={(e) => setNewDocument({ ...newDocument, visibility: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2"
                      >
                        <option value="Public">Public - Anyone can view</option>
                        <option value="Member">Members Only</option>
                        <option value="Admin">Admins Only</option>
                      </select>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowAddDocument(false);
                          setNewDocument({ title: '', description: '', visibility: 'Member', fileUrl: '', fileName: '', mimeType: '', fileSizeBytes: 0 });
                        }}
                        className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateDocument}
                        disabled={!newDocument.title.trim() || !newDocument.fileUrl}
                        className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        Add Document
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Documents List */}
              {documentsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
                </div>
              ) : documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map(doc => {
                    const FileIcon = getFileTypeIcon(doc.fileType);
                    const VisibilityIcon = getVisibilityIcon(doc.visibility);
                    const isEditing = editingDocument === doc.id;

                    return (
                      <div key={doc.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                        {/* File Icon */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                          <FileIcon className="w-6 h-6 text-purple-600" />
                        </div>

                        {/* Document Info */}
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                defaultValue={doc.title}
                                className="w-full border border-gray-300 rounded p-1 text-sm"
                                id={`edit-title-${doc.id}`}
                              />
                              <textarea
                                defaultValue={doc.description || ''}
                                className="w-full border border-gray-300 rounded p-1 text-sm"
                                rows={2}
                                id={`edit-desc-${doc.id}`}
                              />
                              <select
                                defaultValue={doc.visibility}
                                className="border border-gray-300 rounded p-1 text-sm"
                                id={`edit-visibility-${doc.id}`}
                              >
                                <option value="Public">Public</option>
                                <option value="Member">Members</option>
                                <option value="Admin">Admins</option>
                              </select>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    handleUpdateDocument(doc.id, {
                                      title: document.getElementById(`edit-title-${doc.id}`).value,
                                      description: document.getElementById(`edit-desc-${doc.id}`).value,
                                      visibility: document.getElementById(`edit-visibility-${doc.id}`).value
                                    });
                                  }}
                                  className="px-3 py-1 bg-purple-600 text-white rounded text-sm"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingDocument(null)}
                                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <h4 className="font-medium text-gray-900 truncate">{doc.title}</h4>
                              {doc.description && (
                                <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <VisibilityIcon className="w-3 h-3" />
                                  {doc.visibility}
                                </span>
                                {doc.fileName && (
                                  <span>{doc.fileName}</span>
                                )}
                                {doc.fileSizeBytes && (
                                  <span>{formatFileSize(doc.fileSizeBytes)}</span>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <a
                            href={getSharedAssetUrl(doc.fileUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                            title="Download/View"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                          {isAdmin && !isEditing && (
                            <>
                              <button
                                onClick={() => setEditingDocument(doc.id)}
                                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                                title="Edit"
                              >
                                <Edit3 className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  {isAdmin ? 'No documents yet. Click "Add Document" to upload one.' : 'No documents available.'}
                </p>
              )}
            </div>
          )}

          {/* Join Requests Tab */}
          {activeTab === 'requests' && canManage && (
            <div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
                </div>
              ) : joinRequests.length > 0 ? (
                <div className="space-y-3">
                  {joinRequests.map(request => (
                    <div key={request.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {request.userProfileImageUrl ? (
                          <img src={getSharedAssetUrl(request.userProfileImageUrl)} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <span className="text-purple-600 font-medium">
                              {request.userName?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-900">{request.userName}</span>
                          <p className="text-sm text-gray-500">{request.userLocation || request.userExperienceLevel}</p>
                          {request.message && (
                            <p className="text-sm text-gray-600 mt-1 italic">"{request.message}"</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReviewRequest(request.id, true)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReviewRequest(request.id, false)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No pending join requests</p>
              )}
            </div>
          )}

          {/* Manage Tab */}
          {activeTab === 'manage' && canEdit && (
            <div className="space-y-6">
              {/* Invite Link */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-purple-600" />
                  Invite Link
                </h3>
                {inviteCode ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/clubs?invite=${inviteCode}`}
                      className="flex-1 border border-gray-300 rounded-lg p-2 bg-gray-50 text-sm"
                    />
                    <button
                      onClick={copyInviteLink}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-2"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGetInviteLink}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg"
                  >
                    Generate Invite Link
                  </button>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  Share this link to invite people to join your club directly
                </p>
              </div>

              {/* Club Logo */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Image className="w-5 h-5 text-purple-600" />
                  Club Logo
                </h3>
                <div className="flex items-start gap-4">
                  {clubData.logoUrl ? (
                    <div className="relative">
                      <img
                        src={getSharedAssetUrl(clubData.logoUrl)}
                        alt="Club logo"
                        className="w-24 h-24 rounded-lg object-cover border border-gray-200"
                      />
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      {uploadingLogo ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          {clubData.logoUrl ? 'Change Logo' : 'Upload Logo'}
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                      PNG, JPG up to 5MB. Recommended: 200x200px
                    </p>
                  </div>
                </div>
              </div>

              {/* Club Settings */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-purple-600" />
                    Club Info & Settings
                  </h3>
                  {!isEditingInfo && (
                    <button
                      onClick={handleStartEditInfo}
                      className="px-3 py-1 text-sm text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                </div>

                {isEditingInfo ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    {/* Edit Form */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Club Name</label>
                      <input
                        type="text"
                        value={editFormData.name || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={editFormData.description || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>

                    {/* Home Venue Search */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Home Venue</label>
                      {selectedVenue ? (
                        <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <div>
                            <span className="font-medium text-purple-700">{selectedVenue.name}</span>
                            {selectedVenue.city && <span className="text-sm text-gray-500 ml-2">({selectedVenue.city})</span>}
                          </div>
                          <button
                            onClick={() => setSelectedVenue(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="text"
                            value={venueSearch}
                            onChange={(e) => setVenueSearch(e.target.value)}
                            placeholder="Search for a venue..."
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          {searchingVenues && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            </div>
                          )}
                          {venueResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {venueResults.map(venue => (
                                <button
                                  key={venue.venueId || venue.id}
                                  onClick={() => handleSelectVenue({ id: venue.venueId || venue.id, name: venue.name, city: venue.city })}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex flex-col"
                                >
                                  <span className="font-medium">{venue.name}</span>
                                  <span className="text-xs text-gray-500">{[venue.city, venue.state].filter(Boolean).join(', ')}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">The club's home venue location will be used for the club address</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          value={editFormData.city || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                          type="text"
                          value={editFormData.state || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                        <input
                          type="text"
                          value={editFormData.country || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                        <input
                          type="url"
                          value={editFormData.website || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={editFormData.email || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={editFormData.phone || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                    </div>

                    {/* Checkboxes */}
                    <div className="space-y-2 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editFormData.isPublic ?? true}
                          onChange={(e) => setEditFormData({ ...editFormData, isPublic: e.target.checked })}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Public Club (visible in search)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editFormData.requiresApproval ?? true}
                          onChange={(e) => setEditFormData({ ...editFormData, requiresApproval: e.target.checked })}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Require Approval to Join</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editFormData.hasMembershipFee ?? false}
                          onChange={(e) => setEditFormData({ ...editFormData, hasMembershipFee: e.target.checked })}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Has Membership Fee</span>
                      </label>
                    </div>

                    {/* Membership Fee Details */}
                    {editFormData.hasMembershipFee && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fee Amount</label>
                            <input
                              type="text"
                              value={editFormData.membershipFeeAmount || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, membershipFeeAmount: e.target.value })}
                              placeholder="$25"
                              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fee Period</label>
                            <select
                              value={editFormData.membershipFeePeriod || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, membershipFeePeriod: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                            >
                              <option value="">Select...</option>
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="yearly">Yearly</option>
                              <option value="one-time">One-time</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Instructions</label>
                          <textarea
                            value={editFormData.paymentInstructions || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, paymentInstructions: e.target.value })}
                            rows={2}
                            placeholder="Venmo, PayPal, etc."
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Save/Cancel buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setIsEditingInfo(false)}
                        className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveInfo}
                        disabled={savingInfo}
                        className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {savingInfo && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                    {clubData.homeVenueName && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Home Venue</span>
                        <span className="font-medium text-purple-700">{clubData.homeVenueName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Visibility</span>
                      <span className="font-medium">{clubData.isPublic ? 'Public' : 'Private'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Approval Required</span>
                      <span className="font-medium">{clubData.requiresApproval ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Membership Fee</span>
                      <span className="font-medium">{clubData.hasMembershipFee ? (clubData.membershipFeeAmount || 'Yes') : 'No'}</span>
                    </div>
                    {clubData.hasMembershipFee && clubData.membershipFeePeriod && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fee Period</span>
                        <span className="font-medium capitalize">{clubData.membershipFeePeriod}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Club Chat Section */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                  Club Chat
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  {isAdmin ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-gray-700 font-medium">Enable Club Chat</span>
                          <p className="text-sm text-gray-500">Allow members to chat within the club</p>
                        </div>
                        <button
                          onClick={handleToggleChat}
                          disabled={togglingChat}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            chatEnabled ? 'bg-blue-600' : 'bg-gray-300'
                          } ${togglingChat ? 'opacity-50' : ''}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              chatEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      {chatEnabled && (
                        <button
                          onClick={handleOpenChat}
                          className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Open Club Chat
                        </button>
                      )}
                    </div>
                  ) : isMember && chatEnabled ? (
                    <button
                      onClick={handleOpenChat}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Open Club Chat
                    </button>
                  ) : isMember ? (
                    <p className="text-sm text-gray-500">Club chat is not enabled</p>
                  ) : (
                    <p className="text-sm text-gray-500">Join the club to access chat</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Member Modal */}
        {editingMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Edit Member Details</h3>
                <button onClick={() => setEditingMember(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  {editingMember.profileImageUrl ? (
                    <img src={getSharedAssetUrl(editingMember.profileImageUrl)} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-purple-600 font-medium text-lg">{editingMember.name?.charAt(0) || '?'}</span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{editingMember.name}</p>
                    <p className="text-sm text-gray-500">{editingMember.role}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={memberEditData.title}
                    onChange={(e) => setMemberEditData({ ...memberEditData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="e.g., Treasurer, Secretary, Tournament Director"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Membership Valid To</label>
                  <input
                    type="date"
                    value={memberEditData.membershipValidTo}
                    onChange={(e) => setMemberEditData({ ...memberEditData, membershipValidTo: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Admin Only)</label>
                  <textarea
                    value={memberEditData.membershipNotes}
                    onChange={(e) => setMemberEditData({ ...memberEditData, membershipNotes: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="Payment status, notes about member..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingMember(null)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMemberDetails}
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateClubModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    website: '',
    email: '',
    phone: '',
    isPublic: true,
    requiresApproval: true,
    hasMembershipFee: false,
    membershipFeeAmount: '',
    membershipFeePeriod: '',
    paymentInstructions: '',
    homeVenueId: null
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [venueSearch, setVenueSearch] = useState('');
  const [venueResults, setVenueResults] = useState([]);
  const [searchingVenues, setSearchingVenues] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState(null);

  // Search venues for home venue selection
  useEffect(() => {
    if (!venueSearch || venueSearch.length < 2) {
      setVenueResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingVenues(true);
      try {
        const response = await venuesApi.search({ query: venueSearch, pageSize: 10 });
        if (response.success) {
          setVenueResults(response.data?.items || []);
        }
      } catch (err) {
        console.error('Error searching venues:', err);
      } finally {
        setSearchingVenues(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [venueSearch]);

  const handleSelectVenue = (venue) => {
    setSelectedVenue(venue);
    setFormData({ ...formData, homeVenueId: venue.id });
    setVenueSearch('');
    setVenueResults([]);
  };

  const handleClearVenue = () => {
    setSelectedVenue(null);
    setFormData({ ...formData, homeVenueId: null });
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    setError(null);
    try {
      // Upload to Funtime-Shared asset service
      const response = await sharedAssetApi.upload(file, 'image', 'club');
      // Save only relative path to DB - use response.data.url directly
      // Response: { data: { success: true, url: "/asset/11", ... } }
      if (response?.data?.url) {
        setFormData({ ...formData, logoUrl: response.data.url });
      } else if (response?.url) {
        setFormData({ ...formData, logoUrl: response.url });
      } else {
        setError(response.message || 'Upload failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Club name is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await clubsApi.create(formData);
      if (response.success) {
        onCreate(response.data);
      } else {
        setError(response.message || 'Failed to create club');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">Create New Club</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Club Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="My Pickleball Club"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Tell people about your club..."
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Club Logo</label>
            <div className="flex items-center gap-4">
              {formData.logoUrl ? (
                <div className="relative">
                  <img src={getSharedAssetUrl(formData.logoUrl)} alt="Club logo" className="w-20 h-20 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, logoUrl: '' })}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                  {uploadingLogo ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-600"></div>
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

          {/* Home Venue Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Home Venue (Optional)</label>
            {selectedVenue ? (
              <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div>
                  <span className="font-medium text-purple-700">{selectedVenue.name}</span>
                  {selectedVenue.city && <span className="text-sm text-gray-500 ml-2">({selectedVenue.city})</span>}
                </div>
                <button
                  type="button"
                  onClick={handleClearVenue}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                  placeholder="Search for a venue..."
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                />
                {searchingVenues && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                )}
                {venueResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {venueResults.map(venue => (
                      <button
                        key={venue.venueId || venue.id}
                        type="button"
                        onClick={() => handleSelectVenue({ id: venue.venueId || venue.id, name: venue.name, city: venue.city })}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex flex-col"
                      >
                        <span className="font-medium">{venue.name}</span>
                        <span className="text-xs text-gray-500">{[venue.city, venue.state].filter(Boolean).join(', ')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">Select a home venue for the club. The venue's address will be used as the club location.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="USA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="https://"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <div>
                <span className="font-medium text-gray-900">Public Club</span>
                <p className="text-sm text-gray-500">Anyone can find this club in search</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requiresApproval}
                onChange={(e) => setFormData({ ...formData, requiresApproval: e.target.checked })}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <div>
                <span className="font-medium text-gray-900">Require Approval</span>
                <p className="text-sm text-gray-500">New members need approval to join</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasMembershipFee}
                onChange={(e) => setFormData({ ...formData, hasMembershipFee: e.target.checked })}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <div>
                <span className="font-medium text-gray-900">Membership Fee</span>
                <p className="text-sm text-gray-500">This club has a membership fee</p>
              </div>
            </label>
          </div>

          {/* Membership Fee Details */}
          {formData.hasMembershipFee && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-4">
              <h4 className="font-medium text-green-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Membership Fee Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fee Amount</label>
                  <input
                    type="text"
                    value={formData.membershipFeeAmount}
                    onChange={(e) => setFormData({ ...formData, membershipFeeAmount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="$25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fee Period</label>
                  <select
                    value={formData.membershipFeePeriod}
                    onChange={(e) => setFormData({ ...formData, membershipFeePeriod: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Select period...</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one-time">One-time</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Instructions</label>
                <textarea
                  value={formData.paymentInstructions}
                  onChange={(e) => setFormData({ ...formData, paymentInstructions: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Venmo: @clubname, PayPal: club@email.com, or cash at meetings..."
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Club'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
