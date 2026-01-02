import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Search, Filter, Star, Clock, Plus, Phone, Globe, CheckCircle, X, Sun, DollarSign, Layers, ThumbsUp, ThumbsDown, MessageSquare, ChevronLeft, ChevronRight, ExternalLink, Calendar, Navigation, List, Map, ArrowUpDown, SortAsc, SortDesc, Locate, Image, Video, Upload, Trash2, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { venuesApi, venueTypesApi, sharedAssetApi, getSharedAssetUrl } from '../services/api';
import VenueMap from '../components/ui/VenueMap';
import L from 'leaflet';

const SURFACE_TYPES = [
  { value: 'all', label: 'All Surfaces' },
  { value: 'concrete', label: 'Concrete' },
  { value: 'asphalt', label: 'Asphalt' },
  { value: 'sport_court', label: 'Sport Court' },
  { value: 'wood', label: 'Wood (Indoor)' },
];

const AMENITY_OPTIONS = [
  'restrooms', 'water', 'benches', 'shade', 'parking', 'pro_shop', 'lessons', 'equipment_rental'
];

export default function Venues() {
  const { user, isAuthenticated } = useAuth();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add Court Modal
  const [showAddCourtModal, setShowAddCourtModal] = useState(false);

  // Search mode: 'distance' or 'full'
  const [searchMode, setSearchMode] = useState('distance');

  // View mode: 'list' or 'map'
  const [viewMode, setViewMode] = useState('list');

  // Sorting
  const [sortBy, setSortBy] = useState('distance'); // distance, name, rating
  const [sortOrder, setSortOrder] = useState('asc');

  // Distance search state
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(50);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Full search state
  const [countries, setCountries] = useState([]);
  const [statesWithCounts, setStatesWithCounts] = useState([]);
  const [citiesWithCounts, setCitiesWithCounts] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [courtNameSearch, setCourtNameSearch] = useState('');

  // Legacy state for old endpoint
  const [states, setStates] = useState([]);

  // Common filters
  const [hasLights, setHasLights] = useState(false);
  const [isIndoor, setIsIndoor] = useState(false);
  const [courtTypes, setCourtTypes] = useState([]);
  const [selectedCourtType, setSelectedCourtType] = useState('');

  // Results
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [hoveredCourtId, setHoveredCourtId] = useState(null); // For map list highlight
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Check if location permission is blocked
  const [locationBlocked, setLocationBlocked] = useState(false);

  // Get user's location on mount
  const getLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setSearchMode('search'); // Auto-switch to Full Search
      setSortBy('name'); // Fall back to name sort
      return;
    }

    // Check permission state first if available
    if (navigator.permissions) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          setLocationBlocked(true);
          setLocationError('Location access is blocked. Use Full Search or enable location in browser settings.');
          setSearchMode('search'); // Auto-switch to Full Search
          setSortBy('name'); // Fall back to name sort
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
      setSortBy('distance'); // Default to distance sort when location is available
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
        setSortBy('distance'); // Default to distance sort when location is available
      } catch (error) {
        console.warn('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationBlocked(true);
          setLocationError('Location access was denied. Use Full Search or allow location in browser settings.');
          setSortBy('name'); // Fall back to name sort
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('Location unavailable. Use Full Search to find courts by address.');
          setSortBy('name'); // Fall back to name sort
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Location request timed out. Use Full Search to find courts by address.');
          setSortBy('name'); // Fall back to name sort
        } else {
          setLocationError('Unable to get your location. Use Full Search to find courts by address.');
          setSortBy('name'); // Fall back to name sort
        }
        setGettingLocation(false);
      }
    }
  }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  // Load countries for full search
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await venuesApi.getCountries();
        if (response.success) {
          setCountries(response.data || []);
        }
      } catch (err) {
        console.error('Error loading countries:', err);
      }
    };
    loadCountries();
  }, []);

  // Load court types
  useEffect(() => {
    const loadCourtTypes = async () => {
      try {
        const response = await venueTypesApi.getAll();
        if (response.success) {
          setCourtTypes(response.data || []);
        }
      } catch (err) {
        console.error('Error loading court types:', err);
      }
    };
    loadCourtTypes();
  }, []);

  // Load states when country is selected
  useEffect(() => {
    if (!selectedCountry) {
      setStatesWithCounts([]);
      setSelectedState('');
      setCitiesWithCounts([]);
      setSelectedCity('');
      return;
    }

    const loadStates = async () => {
      try {
        const response = await venuesApi.getStatesByCountry(selectedCountry);
        if (response.success) {
          // Sort alphabetically by name
          const sorted = (response.data || []).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          setStatesWithCounts(sorted);
        }
      } catch (err) {
        console.error('Error loading states:', err);
      }
    };
    loadStates();
  }, [selectedCountry]);

  // Load cities when state is selected
  useEffect(() => {
    if (!selectedCountry || !selectedState) {
      setCitiesWithCounts([]);
      setSelectedCity('');
      return;
    }

    const loadCities = async () => {
      try {
        const response = await venuesApi.getCitiesByState(selectedCountry, selectedState);
        if (response.success) {
          // Sort alphabetically by name
          const sorted = (response.data || []).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          setCitiesWithCounts(sorted);
        }
      } catch (err) {
        console.error('Error loading cities:', err);
      }
    };
    loadCities();
  }, [selectedCountry, selectedState]);

  // Legacy: Load states list for backwards compatibility
  useEffect(() => {
    const loadStates = async () => {
      try {
        const response = await venuesApi.getStates();
        if (response.success) {
          setStates(response.data || []);
        }
      } catch (err) {
        console.error('Error loading states:', err);
      }
    };
    loadStates();
  }, []);

  // Load courts
  const loadCourts = useCallback(async () => {
    setLoading(true);
    try {
      let params = {
        page,
        pageSize,
        hasLights: hasLights || undefined,
        isIndoor: isIndoor || undefined,
        courtTypeId: selectedCourtType || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
      };

      if (searchMode === 'distance') {
        // Distance-based search
        if (userLocation) {
          params.latitude = userLocation.lat;
          params.longitude = userLocation.lng;
          params.radiusMiles = radiusMiles;
        }
      } else {
        // Full search mode
        if (selectedCountry) params.country = selectedCountry;
        if (selectedState) params.state = selectedState;
        if (selectedCity) params.city = selectedCity;
        if (courtNameSearch) params.query = courtNameSearch;
      }

      const response = await venuesApi.search(params);
      if (response.success && response.data) {
        let items = response.data.items || [];

        // Client-side sorting if needed
        if (sortBy === 'name') {
          items = [...items].sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
          });
        } else if (sortBy === 'rating') {
          items = [...items].sort((a, b) => {
            const ratingA = a.aggregatedInfo?.averageRating || 0;
            const ratingB = b.aggregatedInfo?.averageRating || 0;
            return sortOrder === 'asc' ? ratingA - ratingB : ratingB - ratingA;
          });
        } else if (sortBy === 'distance' && userLocation) {
          items = [...items].sort((a, b) => {
            const distA = a.distance || 999999;
            const distB = b.distance || 999999;
            return sortOrder === 'asc' ? distA - distB : distB - distA;
          });
        }

        setCourts(items);
        setTotalPages(response.data.totalPages || 1);
        setTotalCount(response.data.totalCount || 0);
      }
    } catch (err) {
      console.error('Error loading courts:', err);
      setCourts([]);
    } finally {
      setLoading(false);
    }
  }, [page, searchMode, userLocation, radiusMiles, selectedCountry, selectedState, selectedCity, courtNameSearch, hasLights, isIndoor, selectedCourtType, sortBy, sortOrder]);

  useEffect(() => {
    loadCourts();
  }, [loadCourts]);

  // Debounced search for court name
  const [searchTimeout, setSearchTimeout] = useState(null);
  const handleCourtNameSearch = (value) => {
    setCourtNameSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      setPage(1);
    }, 500));
  };

  // Handle sort change
  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      // Toggle order if same sort field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder(newSortBy === 'rating' ? 'desc' : 'asc'); // Default to desc for rating
    }
    setPage(1);
  };

  // Reset search when switching modes
  const handleSearchModeChange = (mode) => {
    setSearchMode(mode);
    setPage(1);
    // Reset sort to appropriate default
    if (mode === 'distance' && userLocation) {
      setSortBy('distance');
    } else {
      setSortBy('name');
    }
    setSortOrder('asc');
  };

  const handleViewDetails = async (court) => {
    try {
      const response = await venuesApi.getCourt(court.id, userLocation?.lat, userLocation?.lng);
      if (response.success) {
        setSelectedCourt(response.data);
      }
    } catch (err) {
      console.error('Error loading court details:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <MapPin className="w-12 h-12" />
              <div>
                <h1 className="text-3xl font-bold">Find Pickleball Courts</h1>
                <p className="text-green-100 mt-1">
                  Search {totalCount.toLocaleString()} courts and help keep information up to date
                </p>
              </div>
            </div>
            {isAuthenticated && (
              <button
                onClick={() => setShowAddCourtModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-green-700 rounded-lg font-medium hover:bg-green-50 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Court
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Mode Toggle */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Search Mode Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => handleSearchModeChange('distance')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  searchMode === 'distance'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Navigation className="w-5 h-5" />
                Find Near Me
              </button>
              <button
                onClick={() => handleSearchModeChange('full')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  searchMode === 'full'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Search className="w-5 h-5" />
                Full Search
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-2 lg:ml-auto">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <List className="w-5 h-5" />
                List
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'map'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Map className="w-5 h-5" />
                Map
              </button>
            </div>
          </div>
        </div>

        {/* Search Options */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          {searchMode === 'distance' ? (
            /* Distance Search Mode */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Current Location */}
                <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 flex-1 min-w-[250px]">
                  <Locate className={`w-5 h-5 ${userLocation ? 'text-green-600' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    {gettingLocation ? (
                      <span className="text-gray-500">Getting your location...</span>
                    ) : userLocation ? (
                      <div>
                        <span className="text-sm font-medium text-gray-900">Your Location</span>
                        <span className="text-sm text-gray-500 ml-2">
                          ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-500">Location not available</span>
                    )}
                  </div>
                  <button
                    onClick={getLocation}
                    disabled={gettingLocation}
                    className="text-sm text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                  >
                    {gettingLocation ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {/* Distance Radius */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Within</span>
                  <select
                    value={radiusMiles}
                    onChange={(e) => { setRadiusMiles(parseInt(e.target.value)); setPage(1); }}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    disabled={!userLocation}
                  >
                    <option value={5}>5 miles</option>
                    <option value={10}>10 miles</option>
                    <option value={25}>25 miles</option>
                    <option value={50}>50 miles</option>
                    <option value={100}>100 miles</option>
                    <option value={250}>250 miles</option>
                    <option value={500}>500 miles</option>
                  </select>
                </div>
              </div>

              {locationError && (
                <div className={`p-3 rounded-lg flex items-start gap-3 text-sm ${
                  locationBlocked
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                }`}>
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p>{locationError}</p>
                    {locationBlocked && (
                      <div className="mt-2 text-xs opacity-80">
                        <p className="font-medium">To enable location:</p>
                        <ol className="list-decimal ml-4 mt-1 space-y-0.5">
                          <li>Click the lock/tune icon in your browser's address bar</li>
                          <li>Find "Location" and change it to "Allow"</li>
                          <li>Refresh the page</li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Full Search Mode */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Country Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select
                    value={selectedCountry}
                    onChange={(e) => { setSelectedCountry(e.target.value); setPage(1); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">All Countries</option>
                    {countries.map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.count.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* State Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
                  <select
                    value={selectedState}
                    onChange={(e) => { setSelectedState(e.target.value); setPage(1); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    disabled={!selectedCountry}
                  >
                    <option value="">All States</option>
                    {statesWithCounts.map(s => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.count.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* City Dropdown/Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <select
                    value={selectedCity}
                    onChange={(e) => { setSelectedCity(e.target.value); setPage(1); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    disabled={!selectedState}
                  >
                    <option value="">All Cities</option>
                    {citiesWithCounts.map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.count.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Court Name/Address Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name or Address</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name or address..."
                      value={courtNameSearch}
                      onChange={(e) => handleCourtNameSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Common Filters */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t">
            <span className="text-sm text-gray-500">Filters:</span>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasLights}
                onChange={(e) => { setHasLights(e.target.checked); setPage(1); }}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <Sun className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-gray-700">Has Lights</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isIndoor}
                onChange={(e) => { setIsIndoor(e.target.checked); setPage(1); }}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <Layers className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-700">Indoor</span>
            </label>

            {/* Court Type Filter */}
            {courtTypes.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedCourtType}
                  onChange={(e) => { setSelectedCourtType(e.target.value); setPage(1); }}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">All Types</option>
                  {courtTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Options (for list view) */}
            {viewMode === 'list' && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-gray-500">Sort by:</span>
                <button
                  onClick={() => handleSortChange('distance')}
                  disabled={searchMode !== 'distance' || !userLocation}
                  className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                    sortBy === 'distance'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } ${searchMode !== 'distance' || !userLocation ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Navigation className="w-3 h-3" />
                  Distance
                  {sortBy === 'distance' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button
                  onClick={() => handleSortChange('name')}
                  className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                    sortBy === 'name'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Name
                  {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button
                  onClick={() => handleSortChange('rating')}
                  className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                    sortBy === 'rating'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Star className="w-3 h-3" />
                  Rating
                  {sortBy === 'rating' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results Count */}
        {!loading && courts.length > 0 && (
          <div className="mb-4 text-sm text-gray-600">
            Showing {courts.length} of {totalCount.toLocaleString()} courts
            {searchMode === 'distance' && userLocation && ` within ${radiusMiles} miles`}
            {searchMode === 'full' && selectedCountry && ` in ${selectedCountry}`}
            {searchMode === 'full' && selectedState && `, ${selectedState}`}
            {searchMode === 'full' && selectedCity && `, ${selectedCity}`}
          </div>
        )}

        {/* Courts Results */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : courts.length > 0 ? (
          <>
            {viewMode === 'map' ? (
              /* Map View with Side List */
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="flex h-[600px]">
                  {/* Compact Court List */}
                  <div className="w-80 border-r border-gray-200 flex flex-col">
                    <div className="p-3 border-b bg-gray-50">
                      <p className="text-sm font-medium text-gray-700">
                        {courts.filter(c => c.latitude || c.gpsLat).length} courts on map
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {courts.filter(c => c.latitude || c.gpsLat).map((court, index) => {
                        const courtId = court.courtId || court.id;
                        const isSelected = hoveredCourtId === courtId;
                        return (
                          <div
                            key={courtId}
                            className={`p-3 border-b border-gray-100 cursor-pointer transition-colors ${
                              isSelected ? 'bg-green-50 border-l-4 border-l-green-500' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => handleViewDetails(court)}
                            onMouseEnter={() => setHoveredCourtId(courtId)}
                            onMouseLeave={() => setHoveredCourtId(null)}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                                isSelected ? 'bg-green-600' : 'bg-blue-600'
                              }`}>
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 text-sm truncate">
                                  {court.name || 'Unnamed Court'}
                                </h4>
                                <p className="text-xs text-gray-500 truncate">
                                  {[court.city, court.state].filter(Boolean).join(', ')}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {court.distance && (
                                    <span className="text-xs text-green-600 font-medium">
                                      {court.distance.toFixed(1)} mi
                                    </span>
                                  )}
                                  {(court.indoorNum > 0 || court.outdoorNum > 0) && (
                                    <span className="text-xs text-gray-400">
                                      {(court.indoorNum || 0) + (court.outdoorNum || 0) + (court.coveredNum || 0)} courts
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {courts.filter(c => !(c.latitude || c.gpsLat)).length > 0 && (
                        <div className="p-3 text-xs text-gray-400 text-center">
                          {courts.filter(c => !(c.latitude || c.gpsLat)).length} courts without coordinates
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Map */}
                  <div className="flex-1">
                    <VenueMap
                      courts={courts}
                      userLocation={userLocation}
                      onCourtClick={(court) => handleViewDetails(court)}
                      onMarkerSelect={(court) => setHoveredCourtId(court.courtId || court.id)}
                      selectedCourtId={hoveredCourtId}
                      showNumbers={true}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* List View */
              <div className="grid gap-6 md:grid-cols-2">
                {courts.map(court => (
                  <CourtCard
                    key={court.id}
                    court={court}
                    onViewDetails={() => handleViewDetails(court)}
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
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Courts Found</h3>
            <p className="text-gray-500 mb-6">
              {searchMode === 'distance' && !userLocation
                ? 'Enable location access to find courts near you, or use Full Search.'
                : searchMode === 'distance' && userLocation
                ? `No courts found within ${radiusMiles} miles. Try increasing the distance.`
                : selectedCountry || selectedState || courtNameSearch
                ? 'No courts match your search criteria. Try adjusting your filters.'
                : 'Select a country to start searching for courts.'}
            </p>
          </div>
        )}
      </div>

      {/* Court Detail Modal */}
      {selectedCourt && (
        <CourtDetailModal
          court={selectedCourt}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedCourt(null)}
          onConfirmationSubmitted={(updatedCourt) => {
            setSelectedCourt(updatedCourt);
            loadCourts();
          }}
        />
      )}

      {/* Add Court Modal */}
      {showAddCourtModal && (
        <AddCourtModal
          onClose={() => setShowAddCourtModal(false)}
          onCourtAdded={(newCourt) => {
            setShowAddCourtModal(false);
            loadCourts();
            handleViewDetails(newCourt);
          }}
          userLocation={userLocation}
          courtTypes={courtTypes}
        />
      )}
    </div>
  );
}

function CourtCard({ court, onViewDetails }) {
  const totalCourts = (court.indoorNum || 0) + (court.outdoorNum || 0) + (court.coveredNum || 0);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex gap-2 flex-wrap">
            {court.indoorNum > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                Indoor ({court.indoorNum})
              </span>
            )}
            {court.outdoorNum > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                Outdoor ({court.outdoorNum})
              </span>
            )}
            {court.hasLights && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                <Sun className="w-3 h-3 inline mr-1" />
                Lights
              </span>
            )}
          </div>
          {court.aggregatedInfo?.averageRating && (
            <div className="flex items-center gap-1 text-yellow-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-sm font-medium">{court.aggregatedInfo.averageRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        <h3 className="font-semibold text-gray-900 mb-2">{court.name || 'Unnamed Court'}</h3>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {court.address && `${court.address}, `}
              {court.city}{court.state && `, ${court.state}`}
            </span>
          </div>
          {court.distance && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>{court.distance.toFixed(1)} miles away</span>
            </div>
          )}
          {totalCourts > 0 && (
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>{totalCourts} court{totalCourts !== 1 ? 's' : ''}</span>
            </div>
          )}
          {court.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>{court.phone}</span>
            </div>
          )}
          {court.website && (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <a href={court.website} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline truncate">
                {court.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>

        {court.aggregatedInfo?.confirmationCount > 0 && (
          <div className="mt-3 pt-3 border-t text-xs text-gray-500 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {court.aggregatedInfo.confirmationCount} user confirmation{court.aggregatedInfo.confirmationCount !== 1 ? 's' : ''}
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={onViewDetails}
            className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            View Details & Confirm Info
          </button>
        </div>
      </div>
    </div>
  );
}

function CourtDetailModal({ court, isAuthenticated, onClose, onConfirmationSubmitted }) {
  const [activeTab, setActiveTab] = useState('details');
  const [submitting, setSubmitting] = useState(false);

  // Asset state
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    nameConfirmed: court.myConfirmation?.nameConfirmed ?? null,
    suggestedName: court.myConfirmation?.suggestedName || '',
    notACourt: court.myConfirmation?.notACourt ?? null,
    confirmedIndoorCount: court.myConfirmation?.confirmedIndoorCount ?? '',
    confirmedOutdoorCount: court.myConfirmation?.confirmedOutdoorCount ?? '',
    confirmedCoveredCount: court.myConfirmation?.confirmedCoveredCount ?? '',
    hasLights: court.myConfirmation?.hasLights ?? null,
    hasFee: court.myConfirmation?.hasFee ?? null,
    feeAmount: court.myConfirmation?.feeAmount || '',
    feeNotes: court.myConfirmation?.feeNotes || '',
    hours: court.myConfirmation?.hours || '',
    rating: court.myConfirmation?.rating ?? null,
    surfaceType: court.myConfirmation?.surfaceType || '',
    amenities: court.myConfirmation?.amenities || [],
    notes: court.myConfirmation?.notes || '',
    confirmedAddress: court.myConfirmation?.confirmedAddress || '',
    confirmedCity: court.myConfirmation?.confirmedCity || '',
    confirmedState: court.myConfirmation?.confirmedState || '',
    confirmedCountry: court.myConfirmation?.confirmedCountry || ''
  });

  // Load assets when modal opens
  useEffect(() => {
    const loadAssets = async () => {
      setAssetsLoading(true);
      try {
        const response = await venuesApi.getAssets(court.id);
        if (response.success) {
          setAssets(response.data || []);
        }
      } catch (err) {
        console.error('Error loading court assets:', err);
      } finally {
        setAssetsLoading(false);
      }
    };
    loadAssets();
  }, [court.id]);

  // Handle asset vote (like/dislike)
  const handleAssetVote = async (assetId, isLike) => {
    if (!isAuthenticated) return;
    try {
      const asset = assets.find(a => a.id === assetId);
      if (!asset) return;

      // If user already has the same vote, remove it
      if (asset.userLiked === isLike) {
        const response = await venuesApi.removeAssetVote(assetId);
        if (response.success) {
          setAssets(prev => prev.map(a => a.id === assetId ? response.data : a));
        }
      } else {
        // Add or change vote
        const response = await venuesApi.voteOnAsset(assetId, isLike);
        if (response.success) {
          setAssets(prev => prev.map(a => a.id === assetId ? response.data : a));
        }
      }
    } catch (err) {
      console.error('Error voting on asset:', err);
    }
  };

  // Handle asset upload
  const handleAssetUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      setUploadError('Please select an image or video file');
      return;
    }

    // Validate file size (50MB for videos, 10MB for images)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError(`File too large. Maximum size is ${isVideo ? '50MB' : '10MB'}`);
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      // Upload file to Funtime-Shared asset service
      const assetType = isVideo ? 'video' : 'image';
      const uploadResponse = await sharedAssetApi.upload(file, assetType, 'court');

      // Save only relative path to DB - use response.data.url directly
      // Response: { data: { success: true, url: "/asset/11", ... } }
      let assetUrl;
      if (uploadResponse?.data?.url) {
        assetUrl = uploadResponse.data.url;
      } else if (uploadResponse?.url) {
        assetUrl = uploadResponse.url;
      } else {
        throw new Error(uploadResponse.message || 'Upload failed');
      }

      // Create court asset record with relative path
      const assetData = {
        assetType: isVideo ? 'video' : 'image',
        assetUrl: assetUrl,
        thumbnailUrl: isVideo ? null : assetUrl,
        width: null,
        height: null,
        fileSizeBytes: file.size,
        mimeType: file.type
      };

      const response = await venuesApi.uploadAsset(court.id, assetData);
      if (response.success) {
        setAssets(prev => [response.data, ...prev]);
      }
    } catch (err) {
      console.error('Error uploading asset:', err);
      setUploadError(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Handle asset delete
  const handleDeleteAsset = async (assetId) => {
    if (!confirm('Are you sure you want to delete this photo/video?')) return;

    try {
      const response = await venuesApi.deleteAsset(assetId);
      if (response.success) {
        setAssets(prev => prev.filter(a => a.id !== assetId));
      }
    } catch (err) {
      console.error('Error deleting asset:', err);
    }
  };

  const handleSubmitConfirmation = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return;

    setSubmitting(true);
    try {
      const submitData = {
        ...formData,
        confirmedIndoorCount: formData.confirmedIndoorCount !== '' ? parseInt(formData.confirmedIndoorCount) : null,
        confirmedOutdoorCount: formData.confirmedOutdoorCount !== '' ? parseInt(formData.confirmedOutdoorCount) : null,
        confirmedCoveredCount: formData.confirmedCoveredCount !== '' ? parseInt(formData.confirmedCoveredCount) : null,
      };

      const response = await venuesApi.submitConfirmation(court.id, submitData);
      if (response.success) {
        // Reload court details
        const updatedCourt = await venuesApi.getCourt(court.id);
        if (updatedCourt.success) {
          onConfirmationSubmitted(updatedCourt.data);
        }
        setActiveTab('details');
      }
    } catch (err) {
      console.error('Error submitting confirmation:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAmenity = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const totalCourts = (court.indoorNum || 0) + (court.outdoorNum || 0) + (court.coveredNum || 0);
  const agg = court.aggregatedInfo || {};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000] overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{court.name || 'Unnamed Court'}</h2>
            <p className="text-sm text-gray-500">
              {court.city}{court.state && `, ${court.state}`}
              {court.distance && ` - ${court.distance.toFixed(1)} miles away`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('confirm')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'confirm'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {court.myConfirmation ? 'Update My Info' : 'Confirm Info'}
            </button>
            <button
              onClick={() => setActiveTab('confirmations')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'confirmations'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              User Reports ({agg.confirmationCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('photos')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-1 ${
                activeTab === 'photos'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Image className="w-4 h-4" />
              Photos ({assets.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Action Buttons */}
              <div className="flex gap-3">
                {court.latitude && court.longitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${court.latitude},${court.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Open in Google Maps
                  </a>
                )}
                <Link
                  to={`/events?courtId=${court.id}&courtName=${encodeURIComponent(court.name || 'Court')}`}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  <Calendar className="w-5 h-5" />
                  Schedule Event Here
                </Link>
              </div>

              {/* Location Info */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  Location
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  {court.address && <p>{court.address}</p>}
                  <p>{court.city}{court.state && `, ${court.state}`} {court.zip}</p>
                  {court.country && court.country !== 'USA' && <p>{court.country}</p>}
                </div>
              </div>

              {/* Court Info */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-green-600" />
                  Court Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoBox label="Indoor Courts" value={agg.mostConfirmedIndoorCount ?? court.indoorNum ?? 'Unknown'} />
                  <InfoBox label="Outdoor Courts" value={agg.mostConfirmedOutdoorCount ?? court.outdoorNum ?? 'Unknown'} />
                  <InfoBox label="Has Lights" value={agg.mostConfirmedHasLights !== null ? (agg.mostConfirmedHasLights ? 'Yes' : 'No') : (court.hasLights ? 'Yes' : 'Unknown')} />
                  <InfoBox label="Surface Type" value={agg.commonSurfaceType || 'Unknown'} />
                </div>
              </div>

              {/* Fee Info */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Fees & Hours
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoBox label="Has Fee" value={agg.mostConfirmedHasFee !== null ? (agg.mostConfirmedHasFee ? 'Yes' : 'No') : 'Unknown'} />
                  <InfoBox label="Fee Amount" value={agg.commonFeeAmount || 'Unknown'} />
                  <InfoBox label="Hours" value={agg.commonHours || 'Unknown'} className="col-span-2" />
                </div>
              </div>

              {/* Contact */}
              {(court.phone || court.website || court.email) && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-green-600" />
                    Contact
                  </h3>
                  <div className="space-y-2 text-sm">
                    {court.phone && <p><span className="text-gray-500">Phone:</span> {court.phone}</p>}
                    {court.email && <p><span className="text-gray-500">Email:</span> {court.email}</p>}
                    {court.website && (
                      <p>
                        <span className="text-gray-500">Website:</span>{' '}
                        <a href={court.website} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                          {court.website}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Amenities */}
              {agg.commonAmenities?.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {agg.commonAmenities.map(amenity => (
                      <span key={amenity} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm capitalize">
                        {amenity.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rating */}
              {agg.averageRating && (
                <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-6 h-6 ${star <= Math.round(agg.averageRating) ? 'text-yellow-500 fill-current' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  <div>
                    <span className="font-semibold text-lg">{agg.averageRating.toFixed(1)}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      based on {agg.confirmationCount} rating{agg.confirmationCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'confirm' && (
            <div>
              {!isAuthenticated ? (
                <div className="text-center py-8">
                  <ThumbsUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign in to Confirm Court Info</h3>
                  <p className="text-gray-500">Help keep court information accurate by confirming or updating details.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitConfirmation} className="space-y-6">
                  {/* Not A Court Flag */}
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.notACourt === true}
                        onChange={(e) => setFormData({ ...formData, notACourt: e.target.checked || null })}
                        className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                      />
                      <div>
                        <span className="font-medium text-red-700">This is not a pickleball court anymore</span>
                        <p className="text-sm text-red-600">Check this if the location no longer has pickleball courts (closed, converted, etc.)</p>
                      </div>
                    </label>
                    {agg.notACourtCount > 0 && (
                      <p className="mt-2 text-sm text-red-500">
                        {agg.notACourtCount} user{agg.notACourtCount !== 1 ? 's have' : ' has'} flagged this as not a court
                      </p>
                    )}
                  </div>

                  {/* Name Confirmation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Is the court name "{court.name || 'Unnamed'}" correct?
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={formData.nameConfirmed === true}
                          onChange={() => setFormData({ ...formData, nameConfirmed: true, suggestedName: '' })}
                          className="text-green-600"
                        />
                        <span>Yes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={formData.nameConfirmed === false}
                          onChange={() => setFormData({ ...formData, nameConfirmed: false })}
                          className="text-green-600"
                        />
                        <span>No, suggest different name</span>
                      </label>
                    </div>
                    {formData.nameConfirmed === false && (
                      <input
                        type="text"
                        placeholder="Enter the correct name..."
                        value={formData.suggestedName}
                        onChange={(e) => setFormData({ ...formData, suggestedName: e.target.value })}
                        className="mt-2 w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                      />
                    )}
                    {agg.mostSuggestedName && (
                      <p className="mt-2 text-sm text-gray-500">
                        Most suggested name: <span className="font-medium text-gray-700">{agg.mostSuggestedName}</span>
                      </p>
                    )}
                  </div>

                  {/* Court Count */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Number of Courts</label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Indoor</label>
                        <input
                          type="number"
                          min="0"
                          placeholder={court.indoorNum?.toString() || '0'}
                          value={formData.confirmedIndoorCount}
                          onChange={(e) => setFormData({ ...formData, confirmedIndoorCount: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Outdoor</label>
                        <input
                          type="number"
                          min="0"
                          placeholder={court.outdoorNum?.toString() || '0'}
                          value={formData.confirmedOutdoorCount}
                          onChange={(e) => setFormData({ ...formData, confirmedOutdoorCount: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Covered</label>
                        <input
                          type="number"
                          min="0"
                          placeholder={court.coveredNum?.toString() || '0'}
                          value={formData.confirmedCoveredCount}
                          onChange={(e) => setFormData({ ...formData, confirmedCoveredCount: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address Confirmation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Address</label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder={court.address || 'Street address...'}
                        value={formData.confirmedAddress}
                        onChange={(e) => setFormData({ ...formData, confirmedAddress: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder={court.city || 'City...'}
                          value={formData.confirmedCity}
                          onChange={(e) => setFormData({ ...formData, confirmedCity: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                        <input
                          type="text"
                          placeholder={court.state || 'State...'}
                          value={formData.confirmedState}
                          onChange={(e) => setFormData({ ...formData, confirmedState: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                        <input
                          type="text"
                          placeholder={court.country || 'Country...'}
                          value={formData.confirmedCountry}
                          onChange={(e) => setFormData({ ...formData, confirmedCountry: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lights & Fee */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Has Lights?</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={formData.hasLights === true}
                            onChange={() => setFormData({ ...formData, hasLights: true })}
                            className="text-green-600"
                          />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={formData.hasLights === false}
                            onChange={() => setFormData({ ...formData, hasLights: false })}
                            className="text-green-600"
                          />
                          <span>No</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Has Fee?</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={formData.hasFee === true}
                            onChange={() => setFormData({ ...formData, hasFee: true })}
                            className="text-green-600"
                          />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={formData.hasFee === false}
                            onChange={() => setFormData({ ...formData, hasFee: false })}
                            className="text-green-600"
                          />
                          <span>No</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {formData.hasFee && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fee Amount</label>
                        <input
                          type="text"
                          placeholder="e.g., $5/hour"
                          value={formData.feeAmount}
                          onChange={(e) => setFormData({ ...formData, feeAmount: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fee Notes</label>
                        <input
                          type="text"
                          placeholder="e.g., Free for members"
                          value={formData.feeNotes}
                          onChange={(e) => setFormData({ ...formData, feeNotes: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Hours */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                    <input
                      type="text"
                      placeholder="e.g., Dawn to Dusk, 6AM-10PM"
                      value={formData.hours}
                      onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  {/* Surface Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Surface Type</label>
                    <select
                      value={formData.surfaceType}
                      onChange={(e) => setFormData({ ...formData, surfaceType: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Select surface type...</option>
                      {SURFACE_TYPES.filter(s => s.value !== 'all').map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Amenities */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
                    <div className="flex flex-wrap gap-2">
                      {AMENITY_OPTIONS.map(amenity => (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => toggleAmenity(amenity)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            formData.amenities.includes(amenity)
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {amenity.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormData({ ...formData, rating: star })}
                          className="p-1"
                        >
                          <Star
                            className={`w-8 h-8 ${
                              star <= (formData.rating || 0)
                                ? 'text-yellow-500 fill-current'
                                : 'text-gray-300 hover:text-yellow-400'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      placeholder="Any other information about this court..."
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : court.myConfirmation ? 'Update My Info' : 'Submit Confirmation'}
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === 'confirmations' && (
            <div>
              {court.recentConfirmations?.length > 0 ? (
                <div className="space-y-4">
                  {court.recentConfirmations.map(conf => (
                    <div key={conf.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {conf.userProfileImageUrl ? (
                            <img src={getSharedAssetUrl(conf.userProfileImageUrl)} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-green-600 font-medium text-sm">
                                {conf.userName?.charAt(0) || '?'}
                              </span>
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{conf.userName || 'Anonymous'}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(conf.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {conf.notACourt && (
                        <div className="mb-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm inline-block">
                          Flagged as not a court
                        </div>
                      )}
                      {conf.suggestedName && (
                        <div className="mb-2 text-sm">
                          <span className="text-gray-500">Suggested name:</span>{' '}
                          <span className="font-medium text-gray-700">{conf.suggestedName}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {conf.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span>{conf.rating}/5</span>
                          </div>
                        )}
                        {conf.confirmedIndoorCount !== null && (
                          <div><span className="text-gray-500">Indoor:</span> {conf.confirmedIndoorCount}</div>
                        )}
                        {conf.confirmedOutdoorCount !== null && (
                          <div><span className="text-gray-500">Outdoor:</span> {conf.confirmedOutdoorCount}</div>
                        )}
                        {conf.hasLights !== null && (
                          <div><span className="text-gray-500">Lights:</span> {conf.hasLights ? 'Yes' : 'No'}</div>
                        )}
                        {conf.hasFee !== null && (
                          <div><span className="text-gray-500">Fee:</span> {conf.hasFee ? (conf.feeAmount || 'Yes') : 'No'}</div>
                        )}
                        {conf.surfaceType && (
                          <div><span className="text-gray-500">Surface:</span> {conf.surfaceType}</div>
                        )}
                      </div>
                      {conf.notes && (
                        <p className="mt-2 text-sm text-gray-600 italic">"{conf.notes}"</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>No user confirmations yet. Be the first to confirm info about this court!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'photos' && (
            <div>
              {/* Upload Section */}
              {isAuthenticated && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-green-600" />
                    Share a Photo or Video
                  </h3>
                  <div className="flex items-center gap-4">
                    <label className="flex-1">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleAssetUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                      <div className={`flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors ${uploading ? 'opacity-50 cursor-wait' : ''}`}>
                        {uploading ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-green-600"></div>
                            <span className="text-gray-600">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-5 h-5 text-gray-400" />
                            <span className="text-gray-600">Click to upload photo or video</span>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                  {uploadError && (
                    <p className="mt-2 text-sm text-red-600">{uploadError}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    Images up to 10MB, videos up to 50MB. Accepted formats: JPG, PNG, GIF, MP4, WebM
                  </p>
                </div>
              )}

              {/* Assets Gallery */}
              {assetsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
                </div>
              ) : assets.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {assets.map(asset => (
                    <div key={asset.id} className="relative group">
                      {/* Asset Preview */}
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        {asset.assetType === 'video' ? (
                          <div className="relative w-full h-full">
                            <video
                              src={getSharedAssetUrl(asset.assetUrl)}
                              className="w-full h-full object-cover"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play className="w-12 h-12 text-white" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={getSharedAssetUrl(asset.assetUrl)}
                            alt={asset.description || 'Court photo'}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>

                      {/* Overlay with user info and actions */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          {/* User info */}
                          <div className="flex items-center gap-2 mb-2">
                            {asset.userProfileImageUrl ? (
                              <img src={getSharedAssetUrl(asset.userProfileImageUrl)} alt="" className="w-6 h-6 rounded-full" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                <span className="text-green-600 text-xs font-medium">
                                  {asset.userName?.charAt(0) || '?'}
                                </span>
                              </div>
                            )}
                            <span className="text-white text-sm truncate">{asset.userName || 'Anonymous'}</span>
                          </div>

                          {/* Like/Dislike actions */}
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleAssetVote(asset.id, true)}
                              disabled={!isAuthenticated}
                              className={`flex items-center gap-1 text-sm transition-colors ${
                                asset.userLiked === true
                                  ? 'text-green-400'
                                  : 'text-white/80 hover:text-green-400'
                              } ${!isAuthenticated ? 'cursor-not-allowed opacity-50' : ''}`}
                              title={isAuthenticated ? 'Like' : 'Sign in to like'}
                            >
                              <ThumbsUp className="w-4 h-4" />
                              <span>{asset.likeCount || 0}</span>
                            </button>
                            <button
                              onClick={() => handleAssetVote(asset.id, false)}
                              disabled={!isAuthenticated}
                              className={`flex items-center gap-1 text-sm transition-colors ${
                                asset.userLiked === false
                                  ? 'text-red-400'
                                  : 'text-white/80 hover:text-red-400'
                              } ${!isAuthenticated ? 'cursor-not-allowed opacity-50' : ''}`}
                              title={isAuthenticated ? 'Dislike' : 'Sign in to dislike'}
                            >
                              <ThumbsDown className="w-4 h-4" />
                              <span>{asset.dislikeCount || 0}</span>
                            </button>

                            {/* Delete button (owner only) */}
                            {asset.isOwner && (
                              <button
                                onClick={() => handleDeleteAsset(asset.id)}
                                className="ml-auto text-white/80 hover:text-red-400 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Video badge */}
                      {asset.assetType === 'video' && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-white text-xs flex items-center gap-1">
                          <Video className="w-3 h-3" />
                          Video
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="font-medium text-gray-900 mb-2">No Photos Yet</h3>
                  <p className="text-sm">
                    {isAuthenticated
                      ? 'Be the first to share a photo of this court!'
                      : 'Sign in to share photos of this court.'}
                  </p>
                </div>
              )}

              {!isAuthenticated && assets.length > 0 && (
                <p className="mt-4 text-center text-sm text-gray-500">
                  Sign in to like photos or share your own
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, className = '' }) {
  return (
    <div className={`bg-gray-50 rounded-lg p-3 ${className}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="font-medium text-gray-900 capitalize">{value?.toString().replace(/_/g, ' ') || 'Unknown'}</div>
    </div>
  );
}

function AddCourtModal({ onClose, onCourtAdded, userLocation, courtTypes }) {
  const [step, setStep] = useState('location'); // 'location', 'duplicates', 'details'
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [nearbyCourts, setNearbyCourts] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    addr1: '',
    addr2: '',
    city: '',
    state: '',
    zip: '',
    country: 'USA',
    phone: '',
    website: '',
    email: '',
    indoorNum: 0,
    outdoorNum: 0,
    coveredNum: 0,
    hasLights: false,
    courtTypeId: '',
    latitude: userLocation?.lat || 0,
    longitude: userLocation?.lng || 0
  });

  // Map for location selection
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map for location selection
  useEffect(() => {
    if (step !== 'location' || !mapRef.current || mapInstanceRef.current) return;

    // Fix default icon paths
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    const center = userLocation ? [userLocation.lat, userLocation.lng] : [39.8283, -98.5795];
    const map = L.map(mapRef.current).setView(center, userLocation ? 13 : 4);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add draggable marker
    const marker = L.marker(center, { draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setFormData(prev => ({
        ...prev,
        latitude: pos.lat,
        longitude: pos.lng
      }));
    });

    // Click on map to move marker
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      setFormData(prev => ({
        ...prev,
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      }));
    });

    setMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [step, userLocation]);

  // Check for nearby courts
  const checkForDuplicates = async () => {
    if (!formData.latitude || !formData.longitude) {
      setError('Please select a location on the map');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await venuesApi.checkNearby(formData.latitude, formData.longitude, 200);
      if (response.success) {
        setNearbyCourts(response.data.nearbyCourts || []);
        if (response.data.nearbyCourts?.length > 0) {
          setStep('duplicates');
        } else {
          setStep('details');
        }
      } else {
        setError(response.message || 'Failed to check for nearby courts');
      }
    } catch (err) {
      console.error('Error checking nearby courts:', err);
      setError('Failed to check for nearby courts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Submit new court
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Please enter a court name');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await venuesApi.addCourt(formData);
      if (response.success) {
        onCourtAdded(response.data);
      } else {
        setError(response.message || 'Failed to add court');
      }
    } catch (err) {
      console.error('Error adding court:', err);
      setError(err.message || 'Failed to add court. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000] overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add New Court</h2>
              <p className="text-sm text-gray-500">
                {step === 'location' && 'Step 1: Select location'}
                {step === 'duplicates' && 'Possible duplicates found'}
                {step === 'details' && 'Step 2: Enter court details'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {step === 'location' && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                Click on the map or drag the marker to select the exact location of the court.
              </div>

              {/* Use My Location button */}
              {userLocation && (
                <button
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      latitude: userLocation.lat,
                      longitude: userLocation.lng
                    }));
                    // Update marker and map if initialized
                    if (markerRef.current && mapInstanceRef.current) {
                      markerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
                      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 16);
                    }
                  }}
                  className="w-full py-3 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Locate className="w-5 h-5" />
                  I'm at the court - Use my current location
                </button>
              )}

              {/* Map */}
              <div
                ref={mapRef}
                className="h-[400px] rounded-lg border border-gray-200"
              />

              {/* Coordinates display */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600">
                    {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                  </span>
                </div>
              </div>

              <button
                onClick={checkForDuplicates}
                disabled={loading || !formData.latitude || !formData.longitude}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    Checking for nearby courts...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Check Location & Continue
                  </>
                )}
              </button>
            </div>
          )}

          {step === 'duplicates' && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-yellow-800">
                      {nearbyCourts.length} court{nearbyCourts.length !== 1 ? 's' : ''} found within 200 yards
                    </h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Please check if your court already exists below. If it does, you can update its information instead of adding a duplicate.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {nearbyCourts.map(court => (
                  <div
                    key={court.id}
                    className="p-4 border rounded-lg hover:border-green-500 cursor-pointer transition-colors"
                    onClick={() => {
                      // Close modal and let parent handle viewing the court
                      onClose();
                      // The court will be viewed via the onCourtAdded callback with an existing court
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{court.name || 'Unnamed Court'}</h4>
                        <p className="text-sm text-gray-500">{court.address}</p>
                        <p className="text-sm text-gray-500">{court.city}, {court.state}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          {Math.round(court.distanceYards)} yards
                        </span>
                        <div className="mt-2 text-xs text-gray-500">
                          {court.indoorNum > 0 && `${court.indoorNum} indoor`}
                          {court.indoorNum > 0 && court.outdoorNum > 0 && ', '}
                          {court.outdoorNum > 0 && `${court.outdoorNum} outdoor`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setStep('location')}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Change Location
                </button>
                <button
                  onClick={() => setStep('details')}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  This is a New Court
                </button>
              </div>
            </div>
          )}

          {step === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Court Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Court Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Sunset Park Pickleball Courts"
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.addr1}
                  onChange={(e) => setFormData({ ...formData, addr1: e.target.value })}
                  placeholder="Street address"
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              {/* Court Numbers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Courts</label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Indoor</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.indoorNum}
                      onChange={(e) => setFormData({ ...formData, indoorNum: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Outdoor</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.outdoorNum}
                      onChange={(e) => setFormData({ ...formData, outdoorNum: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Covered</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.coveredNum}
                      onChange={(e) => setFormData({ ...formData, coveredNum: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Court Type */}
              {courtTypes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Court Type</label>
                  <select
                    value={formData.courtTypeId}
                    onChange={(e) => setFormData({ ...formData, courtTypeId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Select a type...</option>
                    {courtTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                  {formData.courtTypeId && courtTypes.find(t => t.id === parseInt(formData.courtTypeId))?.description && (
                    <p className="mt-1 text-xs text-gray-500">
                      {courtTypes.find(t => t.id === parseInt(formData.courtTypeId))?.description}
                    </p>
                  )}
                </div>
              )}

              {/* Has Lights */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasLights}
                  onChange={(e) => setFormData({ ...formData, hasLights: e.target.checked })}
                  className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <div className="flex items-center gap-2">
                  <Sun className="w-5 h-5 text-yellow-500" />
                  <span className="text-gray-700">Courts have lights for night play</span>
                </div>
              </label>

              {/* Contact Info (collapsed by default) */}
              <details className="border rounded-lg p-4">
                <summary className="cursor-pointer font-medium text-gray-700">
                  Contact Information (optional)
                </summary>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://"
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </details>

              {/* Location info */}
              <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-green-600" />
                <span>Location: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}</span>
                <button
                  type="button"
                  onClick={() => setStep('location')}
                  className="ml-auto text-green-600 hover:text-green-700 font-medium"
                >
                  Change
                </button>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(nearbyCourts.length > 0 ? 'duplicates' : 'location')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      Adding Court...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Add Court
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
