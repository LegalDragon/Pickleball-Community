import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Search, Filter, MapPin, Plus, Globe, Mail, Phone, ChevronLeft, ChevronRight, ChevronDown, X, Copy, Check, Bell, UserPlus, Settings, Crown, Shield, Clock, DollarSign, Calendar, Upload, Image, Edit3, RefreshCw, Trash2, MessageCircle, List, Map, Loader2, Star, Heart, Award, Briefcase, ClipboardList, Flag, Key, Medal, Trophy, Wrench, Zap, Megaphone, UserCog, FileText, Download, File, Video, Table, Presentation, Eye, EyeOff, Lock, GripVertical, Building2, Building, AlertCircle, Send, Network, ExternalLink, QrCode } from 'lucide-react';

// Icon mapping for role icons
const ROLE_ICON_MAP = {
  Crown, Shield, DollarSign, Users, Star, Heart, Award, Medal, Trophy,
  Briefcase, Calendar, ClipboardList, Flag, Key, Settings, Wrench, Zap, Megaphone, UserCog
};

const getRoleIcon = (iconName) => {
  return ROLE_ICON_MAP[iconName] || null;
};
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { clubsApi, sharedAssetApi, clubMemberRolesApi, venuesApi, leaguesApi, grantsApi, clubFinanceApi, getSharedAssetUrl, SHARED_AUTH_URL } from '../services/api';
import PublicProfileModal from '../components/ui/PublicProfileModal';
import VenueMap from '../components/ui/VenueMap';
import VenuePicker from '../components/ui/VenuePicker';
import ShareLink from '../components/ui/ShareLink';
import HelpIcon from '../components/ui/HelpIcon';
import AddressInput from '../components/ui/AddressInput';

export default function Clubs() {
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
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
  const [viewMode, setViewMode] = useState('map');

  // Sorting
  const [sortBy, setSortBy] = useState('name'); // name, distance (if location available)
  const [sortOrder, setSortOrder] = useState('asc');

  // Location state
  const [locationError, setLocationError] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);

  // For map view hover
  const [hoveredClubId, setHoveredClubId] = useState(null);

  // Geocoding cache for clubs without coordinates
  const [geocodeCache, setGeocodeCache] = useState({});

  // Geocode a single address using OpenStreetMap Nominatim
  const geocodeAddress = async (city, state, country) => {
    if (!city && !state) return null;

    const addressParts = [city, state, country].filter(Boolean);
    const addressKey = addressParts.join(',');

    // Check cache first
    if (geocodeCache[addressKey]) {
      return geocodeCache[addressKey];
    }

    try {
      const encodedAddress = encodeURIComponent(addressParts.join(', '));
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
        {
          headers: {
            'User-Agent': 'PickleballCommunity/1.0'
          }
        }
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const result = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
        // Update cache
        setGeocodeCache(prev => ({ ...prev, [addressKey]: result }));
        return result;
      }
    } catch (err) {
      console.error('Geocoding error for', addressKey, err);
    }
    return null;
  };

  // Geocode clubs that don't have coordinates and save to DB for faster future loads
  const geocodeClubsWithoutCoords = async (clubsList) => {
    const clubsToGeocode = clubsList.filter(c => !c.latitude && !c.gpsLat && (c.city || c.state));

    if (clubsToGeocode.length === 0) return clubsList;

    // Process in batches to avoid rate limiting (Nominatim allows 1 req/sec)
    const updatedClubs = [...clubsList];
    const geocodePromises = [];

    for (const club of clubsToGeocode) {
      // Add delay between requests to respect Nominatim rate limit
      const promise = (async () => {
        await new Promise(resolve => setTimeout(resolve, geocodePromises.length * 1100)); // 1.1s delay
        const coords = await geocodeAddress(club.city, club.state, club.country);
        if (coords) {
          const idx = updatedClubs.findIndex(c => c.id === club.id);
          if (idx !== -1) {
            updatedClubs[idx] = { ...updatedClubs[idx], latitude: coords.lat, longitude: coords.lng };
          }

          // Save coordinates to database for faster future loads
          try {
            await clubsApi.updateCoordinates(club.id, coords.lat, coords.lng);
          } catch (err) {
            // Silently fail - geocoding still works, just won't persist
            console.debug('Could not save coordinates for club', club.id, err);
          }
        }
      })();
      geocodePromises.push(promise);
    }

    // Wait for all geocoding to complete (but don't block UI - set state progressively)
    Promise.all(geocodePromises).then(() => {
      setClubs([...updatedClubs]);
    });

    return clubsList; // Return original list immediately, will update via state
  };

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
        const loadedClubs = response.data.items || [];
        setClubs(loadedClubs);
        setTotalPages(response.data.totalPages || 1);
        setTotalCount(response.data.totalCount || 0);

        // Geocode clubs without coordinates (runs asynchronously)
        if (viewMode === 'map') {
          geocodeClubsWithoutCoords(loadedClubs);
        }
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

  // Trigger geocoding when switching to map view with existing clubs
  useEffect(() => {
    if (viewMode === 'map' && clubs.length > 0) {
      const clubsWithoutCoords = clubs.filter(c => !c.latitude && !c.gpsLat && (c.city || c.state));
      if (clubsWithoutCoords.length > 0) {
        geocodeClubsWithoutCoords(clubs);
      }
    }
  }, [viewMode]);

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
    // Redirect unauthenticated users to login
    if (!isAuthenticated) {
      toast.info('Please log in to view club details');
      navigate('/login', { state: { from: '/clubs', clubId: club.id } });
      return;
    }

    try {
      const response = await clubsApi.getClub(club.id);
      if (response.success) {
        setSelectedClub(response.data);
      }
    } catch (err) {
      console.error('Error loading club details:', err);
      // Check if this is a 401 Unauthorized
      if (err?.status === 401 || err?.response?.status === 401) {
        toast.info('Please log in to view club details');
        navigate('/login', { state: { from: '/clubs', clubId: club.id } });
        return;
      }
      // Check if this is a profile completion requirement (403)
      if (err?.message?.toLowerCase().includes('complete your profile')) {
        toast.warning('Please complete your profile to view club details');
        navigate('/complete-profile');
      }
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
                  /* Map View - Mobile responsive */
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {/* Desktop: Side-by-side layout */}
                    <div className="hidden md:flex h-[600px]">
                      {/* Compact Club List - Desktop */}
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
                      {/* Map - Desktop */}
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

                    {/* Mobile: Stacked layout with horizontal scrollable list */}
                    <div className="md:hidden flex flex-col">
                      {/* Map - Mobile (takes most of the viewport) */}
                      <div className="h-[50vh] min-h-[300px]">
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

                      {/* Club count indicator */}
                      <div className="px-3 py-2 bg-gray-50 border-t border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-700">
                          {clubs.filter(c => c.latitude || c.gpsLat).length} clubs on map - scroll to browse
                        </p>
                      </div>

                      {/* Horizontal scrollable club cards - Mobile */}
                      <div className="overflow-x-auto">
                        <div className="flex gap-3 p-3" style={{ minWidth: 'min-content' }}>
                          {clubs.filter(c => c.latitude || c.gpsLat).map((club, index) => {
                            const clubId = club.id;
                            const isSelected = hoveredClubId === clubId;
                            return (
                              <div
                                key={clubId}
                                className={`flex-shrink-0 w-[200px] p-3 rounded-lg border cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-purple-50 border-purple-300 shadow-md'
                                    : 'bg-white border-gray-200 hover:border-purple-200'
                                }`}
                                onClick={() => handleViewDetails(club)}
                              >
                                <div className="flex items-start gap-2">
                                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                                    isSelected ? 'bg-purple-600' : 'bg-blue-600'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 text-sm line-clamp-2">
                                      {club.name}
                                    </h4>
                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                      {[club.city, club.state].filter(Boolean).join(', ')}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
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
                            <div className="flex-shrink-0 w-[150px] p-3 flex items-center justify-center text-xs text-gray-400 text-center">
                              +{clubs.filter(c => !(c.latitude || c.gpsLat)).length} clubs without location
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* List View - Row-based cards */
                  <div className="space-y-4">
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
                <div className="space-y-4">
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
                <div className="space-y-4">
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
                      <div className="flex items-center gap-3">
                        {request.clubLogoUrl ? (
                          <img
                            src={getSharedAssetUrl(request.clubLogoUrl)}
                            alt={request.clubName}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-medium text-gray-900">{request.clubName}</h3>
                          <p className="text-sm text-gray-500">Requested {new Date(request.createdAt).toLocaleDateString()}</p>
                        </div>
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
          onViewProfile={setProfileModalUserId}
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
    <div
      onClick={onViewDetails}
      className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all cursor-pointer group flex flex-col sm:flex-row"
    >
      {/* Logo/Image - Left side on desktop, top on mobile */}
      <div className="sm:w-48 sm:flex-shrink-0 h-32 sm:h-auto bg-purple-100 relative">
        {club.logoUrl ? (
          <img
            src={getSharedAssetUrl(club.logoUrl)}
            alt={club.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200">
            <Users className="w-12 h-12 text-purple-400" />
          </div>
        )}
      </div>

      {/* Content - Right side on desktop */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">{club.name}</h3>
            {club.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{club.description}</p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0 hidden sm:block" />
        </div>

        {/* Info row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-auto">
          {/* Members count */}
          <div className="flex items-center gap-1 text-purple-600">
            <Users className="w-4 h-4" />
            <span className="font-medium">{club.memberCount} member{club.memberCount !== 1 ? 's' : ''}</span>
          </div>

          {/* Location */}
          {club.homeVenueId && club.homeVenueName ? (
            <div className="flex items-center gap-1">
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
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {club.city}{club.state && `, ${club.state}`}{club.country && club.country !== 'USA' && `, ${club.country}`}
              </span>
            </div>
          )}

          {/* Distance */}
          {club.distance && (
            <div className="flex items-center gap-1 text-purple-600 font-medium">
              <MapPin className="w-4 h-4" />
              <span>{club.distance.toFixed(1)} mi</span>
            </div>
          )}

          {/* Membership fee */}
          {club.hasMembershipFee && (
            <div className="flex items-center gap-1 text-green-600">
              <DollarSign className="w-4 h-4" />
              <span>Fee{club.membershipFeeAmount && `: ${club.membershipFeeAmount}`}</span>
            </div>
          )}
        </div>

        {/* Action buttons - right aligned on desktop */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
          {showManageButton && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
              className="px-3 py-1.5 text-sm border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-1"
            >
              <Settings className="w-4 h-4" />
              Manage
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
            className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

function ClubDetailModal({ club, isAuthenticated, currentUserId, onClose, onJoin, onUpdate, memberRoles, onViewProfile }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('about');
  const [financeSubTab, setFinanceSubTab] = useState('internal'); // internal, league
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

  // Sync clubData when club prop changes (important for logo/avatar display)
  useEffect(() => {
    setClubData(club);
    setChatEnabled(club.chatEnabled || false);
  }, [club]);

  // Documents state
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocument, setNewDocument] = useState({ title: '', description: '', visibility: 'Member', fileUrl: '', fileName: '', mimeType: '', fileSizeBytes: 0 });
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const documentInputRef = useRef(null);

  // League affiliation state
  const [clubLeagues, setClubLeagues] = useState([]);
  const [availableLeagues, setAvailableLeagues] = useState([]);
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [showJoinLeagueModal, setShowJoinLeagueModal] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState('');
  const [leagueJoinMessage, setLeagueJoinMessage] = useState('');
  const [requestingLeague, setRequestingLeague] = useState(false);
  const [leagueTree, setLeagueTree] = useState([]);
  const [leagueTreeLoading, setLeagueTreeLoading] = useState(false);
  const [expandedLeagueNodes, setExpandedLeagueNodes] = useState(new Set());
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(true);
  const [selectedLeagueDetails, setSelectedLeagueDetails] = useState(null);
  const [loadingLeagueDetails, setLoadingLeagueDetails] = useState(false);

  // Grant balance state (for club admins)
  const [grantAccounts, setGrantAccounts] = useState([]);
  const [grantTransactions, setGrantTransactions] = useState([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantsSummary, setGrantsSummary] = useState(null);

  // Club Finance state (for all members)
  const [financeAccount, setFinanceAccount] = useState(null);
  const [financeTransactions, setFinanceTransactions] = useState([]);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [financePermissions, setFinancePermissions] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeMembers, setFinanceMembers] = useState([]);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    transactionType: 'Income',
    category: 'MembershipDue',
    amount: '',
    description: '',
    memberUserId: '',
    paymentMethod: '',
    paymentReference: '',
    vendor: '',
    periodStart: '',
    periodEnd: '',
    notes: ''
  });
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentDescription, setAttachmentDescription] = useState('');

  const logoInputRef = useRef(null);
  const navigate = useNavigate();

  const isAdmin = clubData.isAdmin;
  const isModerator = clubData.isModerator;
  const isMember = clubData.isMember;
  const canManage = isAdmin || isModerator;
  const isCreator = clubData.createdByUserId === currentUserId;
  const canEdit = isAdmin || isCreator;

  useEffect(() => {
    if (activeTab === 'members') {
      loadMembers();
      if (canManage) loadJoinRequests();
    }
    if (activeTab === 'notifications') loadNotifications();
    if (activeTab === 'documents') loadDocuments();
    if (activeTab === 'finances' && isMember && financeSubTab === 'internal') loadFinanceData();
    if (activeTab === 'finances' && isAdmin && financeSubTab === 'league') loadGrantsData();
  }, [activeTab, financeSubTab]);

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

  // Load leagues the club belongs to and available leagues to join
  const loadLeagueData = async () => {
    setLeaguesLoading(true);
    try {
      // Load club's current leagues (for all users - shown on About tab)
      const clubLeaguesRes = await leaguesApi.getClubLeagues(club.id);
      if (clubLeaguesRes.success) {
        setClubLeagues(clubLeaguesRes.data || []);
      }

      // Load available leagues to join (only for editors)
      if (canEdit) {
        const availableRes = await leaguesApi.search({ pageSize: 50 });
        if (availableRes.success) {
          setAvailableLeagues(availableRes.data?.items || []);
        }
      }
    } catch (err) {
      console.error('Error loading league data:', err);
    } finally {
      setLeaguesLoading(false);
    }
  };

  const handleRequestJoinLeague = async () => {
    if (!selectedLeagueId) return;
    setRequestingLeague(true);
    try {
      const response = await leaguesApi.requestToJoin(club.id, parseInt(selectedLeagueId), leagueJoinMessage || null);
      if (response.success) {
        setShowJoinLeagueModal(false);
        setSelectedLeagueId('');
        setLeagueJoinMessage('');
        loadLeagueData(); // Refresh
        toast.success('Request to join league submitted successfully!');
      } else {
        toast.error(response.message || response.Message || 'Failed to submit request');
      }
    } catch (err) {
      console.error('Error requesting to join league:', err);
      // API interceptor returns error.response.data directly, check both cases for message
      const errorMessage = err?.message || err?.Message || 'Failed to submit request. Please try again.';
      toast.error(errorMessage);
    } finally {
      setRequestingLeague(false);
    }
  };

  // Load league tree for join modal
  const loadLeagueTree = async () => {
    setLeagueTreeLoading(true);
    try {
      const response = await leaguesApi.getTree();
      if (response.success) {
        setLeagueTree(response.data || []);
        // Auto-expand top-level nodes
        const rootIds = new Set((response.data || []).map(n => n.id));
        setExpandedLeagueNodes(rootIds);
      }
    } catch (err) {
      console.error('Error loading league tree:', err);
    } finally {
      setLeagueTreeLoading(false);
    }
  };

  // Handle opening the join league modal
  const handleOpenJoinLeagueModal = () => {
    setShowJoinLeagueModal(true);
    setSelectedLeagueId('');
    setLeagueJoinMessage('');
    setLeagueDropdownOpen(true);
    setSelectedLeagueDetails(null);
    if (leagueTree.length === 0) {
      loadLeagueTree();
    }
  };

  // Toggle tree node expansion
  const toggleLeagueNode = (nodeId) => {
    setExpandedLeagueNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Check if a league is already joined or pending
  const isLeagueUnavailable = (leagueId) => {
    return clubLeagues.some(cl => cl.leagueId === leagueId);
  };

  // Handle selecting a league - fetch details and collapse dropdown
  const handleLeagueSelect = async (leagueId, hasChildren) => {
    // Only allow selecting end-node leagues (no children)
    if (hasChildren) {
      return;
    }

    setSelectedLeagueId(leagueId);
    setLeagueDropdownOpen(false);

    // Fetch league details to show documents
    setLoadingLeagueDetails(true);
    try {
      const response = await leaguesApi.getLeague(parseInt(leagueId));
      if (response.success) {
        setSelectedLeagueDetails(response.data);
      }
    } catch (err) {
      console.error('Error fetching league details:', err);
    } finally {
      setLoadingLeagueDetails(false);
    }
  };

  // Find league name from tree by ID
  const findLeagueName = (nodes, id) => {
    for (const node of nodes) {
      if (String(node.id) === String(id)) return node.name;
      if (node.children?.length) {
        const found = findLeagueName(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Load league data when about or manage tab is opened
  useEffect(() => {
    if (activeTab === 'about' || activeTab === 'manage') {
      loadLeagueData();
    }
  }, [activeTab, club.id]);

  // Load grant data for club admins
  const loadGrantsData = async () => {
    setGrantsLoading(true);
    try {
      // Load accounts and summary in parallel
      const [accountsRes, summaryRes] = await Promise.all([
        grantsApi.getClubAccounts(club.id),
        grantsApi.getClubSummary(club.id)
      ]);

      if (accountsRes.success) {
        setGrantAccounts(accountsRes.data || []);
      }
      if (summaryRes.success) {
        setGrantsSummary(summaryRes.data);
      }

      // Load recent transactions
      const transactionsRes = await grantsApi.getClubTransactions(club.id, { pageSize: 10 });
      if (transactionsRes.success) {
        setGrantTransactions(transactionsRes.data?.items || []);
      }
    } catch (err) {
      console.error('Error loading grant data:', err);
    } finally {
      setGrantsLoading(false);
    }
  };

  // Grants loading is now handled in the main tab useEffect above

  // Load finance data for club members
  const loadFinanceData = async () => {
    setFinanceLoading(true);
    try {
      const [permRes, accountRes, transRes, summaryRes] = await Promise.all([
        clubFinanceApi.getPermissions(club.id),
        clubFinanceApi.getAccount(club.id),
        clubFinanceApi.getTransactions(club.id, { pageSize: 50 }),
        clubFinanceApi.getSummary(club.id)
      ]);

      if (permRes.success) setFinancePermissions(permRes.data);
      if (accountRes.success) setFinanceAccount(accountRes.data);
      if (transRes.success) setFinanceTransactions(transRes.data?.transactions || []);
      if (summaryRes.success) setFinanceSummary(summaryRes.data);

      // Load members for dropdown if user can edit
      if (permRes.data?.canEdit) {
        const membersRes = await clubFinanceApi.getMembers(club.id);
        if (membersRes.success) setFinanceMembers(membersRes.data || []);
      }
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setFinanceLoading(false);
    }
  };

  const handleCreateFinanceTransaction = async () => {
    if (!newTransaction.amount || !newTransaction.description) return;

    setSavingTransaction(true);
    try {
      const response = await clubFinanceApi.createTransaction(club.id, {
        transactionType: newTransaction.transactionType,
        category: newTransaction.category,
        amount: parseFloat(newTransaction.amount),
        description: newTransaction.description,
        memberUserId: newTransaction.memberUserId ? parseInt(newTransaction.memberUserId) : null,
        paymentMethod: newTransaction.paymentMethod || null,
        paymentReference: newTransaction.paymentReference || null,
        vendor: newTransaction.vendor || null,
        periodStart: newTransaction.periodStart || null,
        periodEnd: newTransaction.periodEnd || null,
        notes: newTransaction.notes || null
      });

      if (response.success) {
        setShowAddTransaction(false);
        setNewTransaction({
          transactionType: 'Income',
          category: 'MembershipDue',
          amount: '',
          description: '',
          memberUserId: '',
          paymentMethod: '',
          paymentReference: '',
          vendor: '',
          periodStart: '',
          periodEnd: '',
          notes: ''
        });
        loadFinanceData();
        toast.success('Transaction recorded');
      } else {
        toast.error(response.message || 'Failed to create transaction');
      }
    } catch (err) {
      console.error('Error creating transaction:', err);
      toast.error('Failed to create transaction');
    } finally {
      setSavingTransaction(false);
    }
  };

  const handleVoidFinanceTransaction = async (transactionId) => {
    const reason = prompt('Enter reason for voiding this transaction:');
    if (!reason) return;

    try {
      const response = await clubFinanceApi.voidTransaction(club.id, transactionId, reason);
      if (response.success) {
        loadFinanceData();
        toast.success('Transaction voided');
      } else {
        toast.error(response.message || 'Failed to void transaction');
      }
    } catch (err) {
      console.error('Error voiding transaction:', err);
      toast.error('Failed to void transaction');
    }
  };

  const handleFinanceAttachmentUpload = async (transactionId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    try {
      const assetType = sharedAssetApi.getAssetType(file);
      const uploadRes = await sharedAssetApi.uploadViaProxy(file, assetType, 'finance-attachment');

      const fileUrl = uploadRes?.url || uploadRes?.data?.url;
      if (fileUrl) {
        const response = await clubFinanceApi.addAttachment(club.id, transactionId, {
          fileName: file.name,
          fileUrl: fileUrl,
          fileType: file.type,
          fileSize: file.size,
          description: attachmentDescription || null
        });

        if (response.success) {
          setAttachmentDescription('');
          loadFinanceData();
        } else {
          toast.error(response.message || 'Failed to add attachment');
        }
      }
    } catch (err) {
      console.error('Error uploading attachment:', err);
      toast.error('Failed to upload attachment');
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const handleDeleteFinanceAttachment = async (transactionId, attachmentId) => {
    if (!confirm('Delete this attachment?')) return;

    try {
      const response = await clubFinanceApi.deleteAttachment(club.id, transactionId, attachmentId);
      if (response.success) {
        loadFinanceData();
      } else {
        toast.error(response.message || 'Failed to delete attachment');
      }
    } catch (err) {
      console.error('Error deleting attachment:', err);
      toast.error('Failed to delete attachment');
    }
  };

  const toggleFinanceTransactionExpand = (transactionId) => {
    setExpandedTransactionId(prev => prev === transactionId ? null : transactionId);
    setAttachmentDescription('');
  };

  // Finance category options
  const incomeCategories = ['MembershipDue', 'EventFee', 'Sponsorship', 'Donation', 'Other'];
  const expenseCategories = ['Equipment', 'Venue', 'Supplies', 'Insurance', 'Marketing', 'Prize', 'Refund', 'Other'];
  const paymentMethods = ['Cash', 'Check', 'Card', 'Venmo', 'Zelle', 'PayPal', 'Other'];

  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);
    try {
      // Determine asset type based on file MIME type
      let assetType = 'document';
      if (file.type.startsWith('image/')) assetType = 'image';
      else if (file.type.startsWith('video/')) assetType = 'video';
      else if (file.type.startsWith('audio/')) assetType = 'audio';

      const response = await sharedAssetApi.uploadViaProxy(file, assetType, 'club-document');
      // Response: { success: true, url: "/asset/123", ... }
      const fileUrl = response?.url || response?.data?.url;
      if (fileUrl) {
        setNewDocument({
          ...newDocument,
          fileUrl: fileUrl,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size
        });
      }
    } catch (err) {
      console.error('Error uploading document:', err);
      toast.error('Failed to upload file. Please try again.');
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
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      // Upload to Funtime-Shared via local backend proxy (uses API key auth)
      const response = await sharedAssetApi.uploadViaProxy(file, 'image', 'club');
      // Response: { success: true, url: "/asset/11", ... }
      let logoUrl;
      if (response?.url) {
        logoUrl = response.url;
      } else if (response?.data?.url) {
        logoUrl = response.data.url;
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
      toast.error('Failed to upload logo');
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
      logoUrl: clubData.logoUrl || null,
      bannerUrl: clubData.bannerUrl || null,
      address: clubData.address || '',
      city: clubData.city || '',
      state: clubData.state || '',
      country: clubData.country || '',
      postalCode: clubData.postalCode || '',
      latitude: clubData.latitude || null,
      longitude: clubData.longitude || null,
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

      // Geocode address if we have city/state but no coordinates, or if address changed
      const addressChanged = editFormData.city !== clubData.city ||
                            editFormData.state !== clubData.state ||
                            editFormData.country !== clubData.country ||
                            editFormData.address !== clubData.address;

      const needsGeocode = (editFormData.city || editFormData.state) &&
                          (!editFormData.latitude || !editFormData.longitude || addressChanged);

      if (needsGeocode && !selectedVenue?.id) {
        // Only geocode if no home venue is selected (venue provides coordinates)
        const coords = await geocodeAddress(editFormData.city, editFormData.state, editFormData.country);
        if (coords) {
          dataToSave.latitude = coords.lat;
          dataToSave.longitude = coords.lng;
        }
      }

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
      toast.error('Failed to save club info');
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000] overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            {clubData.logoUrl ? (
              <img src={getSharedAssetUrl(clubData.logoUrl)} alt="" className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{clubData.name}</h2>
              <p className="text-sm text-gray-500">
                {club.memberCount} member{club.memberCount !== 1 ? 's' : ''}
                {club.city && ` • ${club.city}${club.state ? `, ${club.state}` : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* League Badge */}
            {clubLeagues.filter(l => l.status === 'Active' || !l.status).length > 0 && (() => {
              const activeLeague = clubLeagues.find(l => l.status === 'Active' || !l.status);
              const logoUrl = activeLeague?.rootLeagueAvatarUrl || activeLeague?.avatarUrl;
              const leagueId = activeLeague?.id || activeLeague?.leagueId;
              const leagueName = activeLeague?.name || activeLeague?.leagueName;
              return (
                <Link
                  to={`/leagues/${leagueId}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
                  title={leagueName}
                >
                  {logoUrl ? (
                    <img src={getSharedAssetUrl(logoUrl)} alt="" className="w-5 h-5 rounded object-cover" />
                  ) : (
                    <Building2 className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium max-w-[120px] truncate">
                    {leagueName}
                  </span>
                </Link>
              );
            })()}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
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
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'members'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Members
              {canManage && joinRequests.length > 0 && (
                <span className="px-1.5 py-0.5 bg-orange-500 text-white text-xs font-medium rounded-full">
                  {joinRequests.length}
                </span>
              )}
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
            {isMember && (
              <button
                onClick={() => setActiveTab('finances')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'finances'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Finances
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

              {/* Invite Link - For Members */}
              {isMember && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-purple-600" />
                    Invite Others
                  </h3>
                  {inviteCode ? (
                    <ShareLink
                      url={`${window.location.origin}/clubs?invite=${inviteCode}`}
                      title={`Invite to ${club.name}`}
                      buttonColor="bg-purple-600 hover:bg-purple-700"
                    />
                  ) : (
                    <button
                      onClick={handleGetInviteLink}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm"
                    >
                      Generate Invite Link
                    </button>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Share this link or QR code to invite friends to join the club
                  </p>
                </div>
              )}

              {/* Description */}
              {club.description && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">About</h3>
                  <p className="text-gray-600">{club.description}</p>
                </div>
              )}

              {/* Home Venue */}
              {club.homeVenueName && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    Home Venue
                  </h3>
                  {club.homeVenueId ? (
                    <Link
                      to={`/venues?venueId=${club.homeVenueId}`}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
                    >
                      <Building2 className="w-4 h-4" />
                      {club.homeVenueName}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-600">{club.homeVenueName}</span>
                  )}
                </div>
              )}

              {/* Membership Fee */}
              {club.hasMembershipFee && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Membership Fee
                    <HelpIcon topicCode="club.membership" size="sm" />
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

              {/* Contact & Address */}
              {(club.website || club.email || club.phone || club.address || club.city) && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Contact</h3>
                  <div className="space-y-2 text-sm">
                    {/* Address */}
                    {(club.address || club.city) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          {club.address && <p>{club.address}</p>}
                          <p>
                            {[club.city, club.state].filter(Boolean).join(', ')}
                            {club.postalCode && ` ${club.postalCode}`}
                          </p>
                          {club.country && <p>{club.country}</p>}
                        </div>
                      </div>
                    )}
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
              {/* Pending Join Requests - For Managers (at top) */}
              {canManage && (
                <div className="mb-6 pb-6 border-b">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-4">
                    <UserPlus className="w-5 h-5 text-orange-600" />
                    Pending Join Requests
                    {joinRequests.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                        {joinRequests.length}
                      </span>
                    )}
                  </h3>
                  {joinRequests.length > 0 ? (
                    <div className="space-y-3">
                      {joinRequests.map(request => (
                        <div key={request.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                          <div
                            className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                            onClick={() => onViewProfile(request.userId)}
                          >
                            {request.userProfileImageUrl ? (
                              <img src={getSharedAssetUrl(request.userProfileImageUrl)} alt="" className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <span className="text-orange-600 font-medium">
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
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReviewRequest(request.id, false)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No pending join requests</p>
                  )}
                </div>
              )}

              {/* Members List */}
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
                        onClick={() => onViewProfile(member.userId)}
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
                          <div className="flex items-center gap-1">
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
                            <HelpIcon topicCode="club.roles" size="sm" />
                          </div>
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

              {/* Send Notification Form (for admins/mods) */}
              {canManage && (
                <div className="mt-6 pt-6 border-t">
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
                </div>
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

          {/* Finances Tab - Combined Internal and League */}
          {activeTab === 'finances' && isMember && (
            <div className="space-y-6">
              {/* Sub-tabs for Internal / League */}
              <div className="flex gap-2 border-b pb-2">
                <button
                  onClick={() => setFinanceSubTab('internal')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                    financeSubTab === 'internal'
                      ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Internal
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setFinanceSubTab('league')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                      financeSubTab === 'league'
                        ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    League
                  </button>
                )}
              </div>

              {/* Internal Finance Sub-tab */}
              {financeSubTab === 'internal' && (
                <>
                  {financeLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    </div>
                  ) : (
                    <>
                      {/* Balance Summary Card */}
                  {financeSummary && (
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                      <h3 className="text-lg font-medium mb-4">Club Balance</h3>
                      <div className="text-4xl font-bold mb-2">
                        ${(financeSummary.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="flex flex-wrap gap-6 mt-4 text-sm opacity-90">
                        <div>
                          <span className="opacity-75">Total Income:</span>{' '}
                          <span className="font-medium">${(financeSummary.totalIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="opacity-75">Total Expenses:</span>{' '}
                          <span className="font-medium">${(financeSummary.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      {(financeSummary.incomeThisMonth > 0 || financeSummary.expensesThisMonth > 0) && (
                        <div className="flex flex-wrap gap-6 mt-2 text-xs opacity-75">
                          <div>This Month Income: ${financeSummary.incomeThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div>This Month Expenses: ${financeSummary.expensesThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add Transaction Button (Admin/Treasurer only) */}
                  {financePermissions?.canEdit && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setShowAddTransaction(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        <Plus className="w-4 h-4" />
                        Add Transaction
                      </button>
                    </div>
                  )}

                  {/* Add Transaction Modal */}
                  {showAddTransaction && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-4">New Transaction</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                          <select
                            value={newTransaction.transactionType}
                            onChange={(e) => setNewTransaction({
                              ...newTransaction,
                              transactionType: e.target.value,
                              category: e.target.value === 'Income' ? 'MembershipDue' : 'Equipment'
                            })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          >
                            <option value="Income">Income</option>
                            <option value="Expense">Expense</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                          <select
                            value={newTransaction.category}
                            onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          >
                            {(newTransaction.transactionType === 'Income' ? incomeCategories : expenseCategories).map(cat => (
                              <option key={cat} value={cat}>{cat.replace(/([A-Z])/g, ' $1').trim()}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newTransaction.amount}
                            onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            placeholder="0.00"
                          />
                        </div>
                        {newTransaction.transactionType === 'Income' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Member (optional)</label>
                            <select
                              value={newTransaction.memberUserId}
                              onChange={(e) => setNewTransaction({ ...newTransaction, memberUserId: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                              <option value="">-- Select Member --</option>
                              {financeMembers.map(m => (
                                <option key={m.userId} value={m.userId}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {newTransaction.transactionType === 'Income' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                            <select
                              value={newTransaction.paymentMethod}
                              onChange={(e) => setNewTransaction({ ...newTransaction, paymentMethod: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                              <option value="">-- Select Method --</option>
                              {paymentMethods.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {newTransaction.transactionType === 'Expense' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                            <input
                              type="text"
                              value={newTransaction.vendor}
                              onChange={(e) => setNewTransaction({ ...newTransaction, vendor: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                              placeholder="Vendor name"
                            />
                          </div>
                        )}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <input
                            type="text"
                            value={newTransaction.description}
                            onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            placeholder="Description"
                          />
                        </div>
                        {newTransaction.category === 'MembershipDue' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
                              <input
                                type="date"
                                value={newTransaction.periodStart}
                                onChange={(e) => setNewTransaction({ ...newTransaction, periodStart: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
                              <input
                                type="date"
                                value={newTransaction.periodEnd}
                                onChange={(e) => setNewTransaction({ ...newTransaction, periodEnd: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                              />
                            </div>
                          </>
                        )}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                          <textarea
                            value={newTransaction.notes}
                            onChange={(e) => setNewTransaction({ ...newTransaction, notes: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            rows={2}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          onClick={() => setShowAddTransaction(false)}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateFinanceTransaction}
                          disabled={savingTransaction || !newTransaction.amount || !newTransaction.description}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                          {savingTransaction ? 'Saving...' : 'Save Transaction'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Transactions List */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-purple-600" />
                      Transactions
                    </h3>
                    {financeTransactions.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="w-8"></th>
                              <th className="text-left p-3 font-medium text-gray-700">Date</th>
                              <th className="text-left p-3 font-medium text-gray-700">Type</th>
                              <th className="text-left p-3 font-medium text-gray-700">Description</th>
                              <th className="text-center p-3 font-medium text-gray-700">
                                <FileText className="w-4 h-4 mx-auto" />
                              </th>
                              <th className="text-right p-3 font-medium text-gray-700">Amount</th>
                              {financePermissions?.canVoid && (
                                <th className="w-10"></th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {financeTransactions.map(tx => (
                              <>
                                <tr key={tx.id} className={`hover:bg-gray-50 ${tx.isVoided ? 'opacity-50 bg-red-50' : ''}`}>
                                  <td className="p-2">
                                    <button
                                      onClick={() => toggleFinanceTransactionExpand(tx.id)}
                                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                    >
                                      {expandedTransactionId === tx.id ? (
                                        <ChevronDown className="w-4 h-4 rotate-180" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </button>
                                  </td>
                                  <td className="p-3 text-gray-600 whitespace-nowrap">
                                    {new Date(tx.createdAt).toLocaleDateString()}
                                  </td>
                                  <td className="p-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      tx.transactionType === 'Income'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {tx.category.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                  </td>
                                  <td className="p-3 text-gray-700 max-w-xs">
                                    <div className="truncate">{tx.description}</div>
                                    {tx.memberName && <div className="text-xs text-gray-500">From: {tx.memberName}</div>}
                                    {tx.vendor && <div className="text-xs text-gray-500">Vendor: {tx.vendor}</div>}
                                  </td>
                                  <td className="p-3 text-center">
                                    {tx.attachments?.length > 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                        <FileText className="w-3 h-3" />
                                        {tx.attachments.length}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`p-3 text-right font-medium whitespace-nowrap ${
                                    tx.transactionType === 'Income' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {tx.transactionType === 'Income' ? '+' : '-'}
                                    ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  {financePermissions?.canVoid && (
                                    <td className="p-3">
                                      {!tx.isVoided && (
                                        <button
                                          onClick={() => handleVoidFinanceTransaction(tx.id)}
                                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                                          title="Void Transaction"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                                {/* Expanded row for attachments */}
                                {expandedTransactionId === tx.id && (
                                  <tr key={`${tx.id}-expand`}>
                                    <td colSpan={financePermissions?.canVoid ? 7 : 6} className="bg-gray-50 p-4">
                                      <div className="space-y-3">
                                        <div className="text-sm text-gray-600">
                                          <p><strong>Recorded by:</strong> {tx.recordedByName}</p>
                                          {tx.paymentMethod && <p><strong>Payment:</strong> {tx.paymentMethod} {tx.paymentReference && `(${tx.paymentReference})`}</p>}
                                          {tx.periodStart && tx.periodEnd && <p><strong>Period:</strong> {new Date(tx.periodStart).toLocaleDateString()} - {new Date(tx.periodEnd).toLocaleDateString()}</p>}
                                          {tx.notes && <p><strong>Notes:</strong> {tx.notes}</p>}
                                          {tx.isVoided && <p className="text-red-600"><strong>Voided:</strong> {tx.voidReason} by {tx.voidedByName}</p>}
                                        </div>

                                        <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                          <FileText className="w-4 h-4" />
                                          Attachments
                                        </h5>

                                        {tx.attachments?.length > 0 ? (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {tx.attachments.map(att => (
                                              <div key={att.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200">
                                                <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                  {att.fileType?.startsWith('image/') ? (
                                                    <Image className="w-5 h-5 text-blue-600" />
                                                  ) : (
                                                    <FileText className="w-5 h-5 text-blue-600" />
                                                  )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-medium text-gray-900 truncate">{att.fileName}</p>
                                                  <p className="text-xs text-gray-500">{att.uploadedByName}</p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <a
                                                    href={getSharedAssetUrl(att.fileUrl)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                                                    title="Download"
                                                  >
                                                    <Download className="w-4 h-4" />
                                                  </a>
                                                  {financePermissions?.canEdit && (
                                                    <button
                                                      onClick={() => handleDeleteFinanceAttachment(tx.id, att.id)}
                                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                                      title="Delete"
                                                    >
                                                      <Trash2 className="w-4 h-4" />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-gray-500">No attachments</p>
                                        )}

                                        {financePermissions?.canEdit && !tx.isVoided && (
                                          <div className="pt-2 border-t border-gray-200">
                                            <p className="text-xs font-medium text-gray-600 mb-2">Add Attachment</p>
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="text"
                                                placeholder="Description (optional)"
                                                value={attachmentDescription}
                                                onChange={(e) => setAttachmentDescription(e.target.value)}
                                                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                                              />
                                              <label className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer ${uploadingAttachment ? 'opacity-50' : ''}`}>
                                                {uploadingAttachment ? (
                                                  <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <Upload className="w-4 h-4" />
                                                )}
                                                {uploadingAttachment ? 'Uploading...' : 'Upload'}
                                                <input
                                                  type="file"
                                                  onChange={(e) => handleFinanceAttachmentUpload(tx.id, e)}
                                                  className="hidden"
                                                  disabled={uploadingAttachment}
                                                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                                />
                                              </label>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No transactions recorded yet</p>
                      </div>
                    )}
                  </div>

                      <p className="text-sm text-gray-500 text-center pt-4">
                        {financePermissions?.canEdit
                          ? 'As Admin/Treasurer, you can record income and expenses for this club.'
                          : 'Only club Admin or Treasurer can record transactions.'}
                      </p>
                    </>
                  )}
                </>
              )}

              {/* League Grants Sub-tab */}
              {financeSubTab === 'league' && isAdmin && (
                <>
                  {grantsLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    </div>
                  ) : grantAccounts.length === 0 ? (
                    <div className="text-center py-12">
                      <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Grant Accounts</h3>
                      <p className="text-gray-500">
                        This club doesn't have any grant accounts with leagues yet.
                      </p>
                      <p className="text-sm text-gray-400 mt-2">
                        Grant accounts are created when a league assigns grants or records donations for your club.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Summary Card */}
                      {grantsSummary && (
                    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
                      <h3 className="text-lg font-medium mb-4">Total Grant Balance</h3>
                      <div className="text-4xl font-bold mb-2">
                        ${(grantsSummary.totalBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="flex gap-6 mt-4 text-sm opacity-90">
                        <div>
                          <span className="opacity-75">Total Credits:</span>{' '}
                          <span className="font-medium">${(grantsSummary.totalCreditsAllTime || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="opacity-75">Total Debits:</span>{' '}
                          <span className="font-medium">${(grantsSummary.totalDebitsAllTime || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Accounts by League */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-purple-600" />
                      Accounts by League
                    </h3>
                    <div className="space-y-3">
                      {grantAccounts.map(account => (
                        <div key={account.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">{account.leagueName}</p>
                              <p className="text-sm text-gray-500">
                                {account.transactionCount} transaction{account.transactionCount !== 1 ? 's' : ''}
                                {account.lastTransactionDate && (
                                  <span> · Last: {new Date(account.lastTransactionDate).toLocaleDateString()}</span>
                                )}
                              </p>
                            </div>
                            <div className={`text-xl font-bold ${account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${account.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>Credits: ${account.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span>Debits: ${account.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  {grantTransactions.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-purple-600" />
                        Recent Transactions
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left p-3 font-medium text-gray-700">Date</th>
                              <th className="text-left p-3 font-medium text-gray-700">Type</th>
                              <th className="text-left p-3 font-medium text-gray-700">Description</th>
                              <th className="text-right p-3 font-medium text-gray-700">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {grantTransactions.map(tx => (
                              <tr key={tx.id} className="hover:bg-gray-50">
                                <td className="p-3 text-gray-600 whitespace-nowrap">
                                  {new Date(tx.createdAt).toLocaleDateString()}
                                </td>
                                <td className="p-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    tx.transactionType === 'Credit'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {tx.category}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-700">
                                  {tx.description || tx.grantPurpose || tx.feeReason || (tx.donorName ? `Donation from ${tx.donorName}` : '-')}
                                </td>
                                <td className={`p-3 text-right font-medium whitespace-nowrap ${
                                  tx.transactionType === 'Credit' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {tx.transactionType === 'Credit' ? '+' : '-'}
                                  ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                      <p className="text-sm text-gray-500 text-center pt-4">
                        Grant accounts are managed by your league administrators. Contact your league for questions.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Manage Tab */}
          {activeTab === 'manage' && canEdit && (
            <div className="space-y-6">
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

                    {/* Home Venue */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Home Venue</label>
                      <VenuePicker
                        value={selectedVenue}
                        onChange={setSelectedVenue}
                        label="Select Home Venue"
                        placeholder="Choose a home venue..."
                      />
                      <p className="text-xs text-gray-500 mt-1">The club's home venue location will be used for the club address</p>
                    </div>

                    {/* Address fields using reusable component */}
                    <AddressInput
                      value={{
                        address: editFormData.address,
                        country: editFormData.country,
                        state: editFormData.state,
                        city: editFormData.city,
                        postalCode: editFormData.postalCode
                      }}
                      onChange={(addr) => setEditFormData({
                        ...editFormData,
                        address: addr.address,
                        country: addr.country,
                        state: addr.state,
                        city: addr.city,
                        postalCode: addr.postalCode
                      })}
                      showPostalCode={false}
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                      <input
                        type="url"
                        value={editFormData.website || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="https://example.com"
                      />
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

              {/* League Affiliation Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    League Affiliation
                  </h3>
                  <Link
                    to="/leagues/structure"
                    target="_blank"
                    className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <Network className="w-4 h-4" />
                    View Structure
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  {leaguesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clubLeagues.length > 0 ? (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Member of:</p>
                          <div className="space-y-2">
                            {clubLeagues.map(league => (
                              <div key={league.id} className="flex items-center bg-white p-3 rounded-lg border border-gray-200">
                                <div className="flex items-center gap-2">
                                  {(league.rootLeagueAvatarUrl || league.avatarUrl) && (
                                    <img
                                      src={getSharedAssetUrl(league.rootLeagueAvatarUrl || league.avatarUrl)}
                                      alt=""
                                      className="w-6 h-6 rounded object-cover"
                                    />
                                  )}
                                  <span className="font-medium text-gray-900">{league.name || league.leagueName}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <Building2 className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                          <p className="text-sm text-gray-500">Not affiliated with any leagues yet</p>
                        </div>
                      )}

                      {canManage && (
                        <button
                          onClick={handleOpenJoinLeagueModal}
                          className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Request to Join a League
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Join League Modal - Collapsible Tree Dropdown */}
        {showJoinLeagueModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1010]">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Request to Join League</h3>
                <button onClick={() => setShowJoinLeagueModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select a League</label>

                {/* Collapsible dropdown trigger */}
                <button
                  onClick={() => setLeagueDropdownOpen(!leagueDropdownOpen)}
                  className="w-full flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50 transition-colors"
                >
                  <span className={selectedLeagueId ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedLeagueId ? findLeagueName(leagueTree, selectedLeagueId) : 'Select a league...'}
                  </span>
                  {leagueDropdownOpen ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* Tree dropdown content */}
                {leagueDropdownOpen && (
                  <div className="mt-2 border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    {leagueTreeLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      </div>
                    ) : leagueTree.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Network className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No leagues available</p>
                      </div>
                    ) : (
                      leagueTree.map(node => (
                        <LeagueTreeSelectNode
                          key={node.id}
                          node={node}
                          level={0}
                          selectedId={selectedLeagueId}
                          onSelect={handleLeagueSelect}
                          expandedNodes={expandedLeagueNodes}
                          toggleNode={toggleLeagueNode}
                          isUnavailable={isLeagueUnavailable}
                        />
                      ))
                    )}
                  </div>
                )}

                {/* League Documents Section */}
                {selectedLeagueId && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      League Documents
                    </h4>
                    {loadingLeagueDetails ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                      </div>
                    ) : selectedLeagueDetails?.documents?.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedLeagueDetails.documents.filter(d => d.isPublic).map(doc => (
                          <a
                            key={doc.id}
                            href={doc.fileUrl?.startsWith('http') ? doc.fileUrl : getSharedAssetUrl(doc.fileUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                          >
                            <div className="p-1.5 bg-blue-50 rounded">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                              {doc.leagueName && doc.leagueId !== parseInt(selectedLeagueId) && (
                                <p className="text-xs text-gray-500">From: {doc.leagueName}</p>
                              )}
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-2">No public documents available</p>
                    )}
                  </div>
                )}

                {/* Message input */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
                  <textarea
                    value={leagueJoinMessage}
                    onChange={(e) => setLeagueJoinMessage(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="Tell the league why you want to join..."
                  />
                </div>
              </div>

              <div className="p-4 border-t bg-gray-50 flex gap-2">
                <button
                  onClick={() => setShowJoinLeagueModal(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestJoinLeague}
                  disabled={!selectedLeagueId || requestingLeague}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {requestingLeague ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Member Modal */}
        {editingMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1010]">
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

// Scope config for tree view styling
const LEAGUE_SCOPE_CONFIG = {
  National: { icon: Globe, color: 'text-purple-600', bg: 'bg-purple-100' },
  Regional: { icon: Network, color: 'text-blue-600', bg: 'bg-blue-100' },
  State: { icon: Building2, color: 'text-green-600', bg: 'bg-green-100' },
  District: { icon: Building, color: 'text-orange-600', bg: 'bg-orange-100' },
  Local: { icon: MapPin, color: 'text-gray-600', bg: 'bg-gray-100' }
};

// Tree node component for league selection
function LeagueTreeSelectNode({ node, level, selectedId, onSelect, expandedNodes, toggleNode, isUnavailable }) {
  const config = LEAGUE_SCOPE_CONFIG[node.scope] || LEAGUE_SCOPE_CONFIG.Local;
  const ScopeIcon = config.icon;
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === String(node.id);
  const unavailable = isUnavailable(node.id);
  const isEndNode = !hasChildren;
  const canSelect = isEndNode && !unavailable;

  const indentPx = level * 20;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2.5 px-3 border-b border-gray-100 transition-colors ${
          canSelect ? 'cursor-pointer hover:bg-indigo-50' : 'cursor-default'
        } ${isSelected ? 'bg-indigo-100 border-l-2 border-l-indigo-600' : ''} ${
          !isEndNode ? 'bg-gray-50' : ''
        }`}
        style={{ paddingLeft: `${12 + indentPx}px` }}
        onClick={() => {
          if (hasChildren) {
            toggleNode(node.id);
          } else if (!unavailable) {
            onSelect(String(node.id), hasChildren);
          }
        }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleNode(node.id);
            }}
            className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-5 h-5 flex-shrink-0" />
        )}

        {/* Scope icon */}
        <div className={`p-1 rounded ${config.bg} flex-shrink-0`}>
          <ScopeIcon className={`w-3.5 h-3.5 ${config.color}`} />
        </div>

        {/* League name */}
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${
            isSelected ? 'text-indigo-700' : unavailable ? 'text-gray-400' : !isEndNode ? 'text-gray-500' : 'text-gray-900'
          }`}>
            {node.name}
          </span>
          <span className={`ml-2 text-xs ${config.color}`}>
            {node.scope}
          </span>
          {unavailable && (
            <span className="ml-2 text-xs text-gray-400">(already joined)</span>
          )}
          {hasChildren && (
            <span className="ml-2 text-xs text-gray-400">(expand to select)</span>
          )}
        </div>

        {/* Selected checkmark */}
        {isSelected && (
          <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <LeagueTreeSelectNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              isUnavailable={isUnavailable}
            />
          ))}
        </div>
      )}
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
  const [selectedVenue, setSelectedVenue] = useState(null);

  const handleSelectVenue = (venue) => {
    setSelectedVenue(venue);
    setFormData({ ...formData, homeVenueId: venue?.id || null });
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
      // Upload to Funtime-Shared via local backend proxy (uses API key auth)
      const response = await sharedAssetApi.uploadViaProxy(file, 'image', 'club');
      // Response: { success: true, url: "/asset/11", ... }
      const logoUrl = response?.url || response?.data?.url;
      if (logoUrl) {
        setFormData({ ...formData, logoUrl: logoUrl });
      } else {
        setError(response?.message || 'Upload failed');
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000] overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            Create New Club
            <HelpIcon topicCode="club.create" size="sm" className="ml-2" />
          </h2>
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
            <VenuePicker
              value={selectedVenue}
              onChange={handleSelectVenue}
              label="Select Home Venue"
              placeholder="Choose a home venue..."
            />
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
