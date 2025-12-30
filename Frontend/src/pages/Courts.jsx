import { useState, useEffect } from 'react';
import { MapPin, Search, Filter, Star, Clock, Edit2, Plus, Phone, Globe, CheckCircle, X } from 'lucide-react';
import Navigation from '../components/ui/Navigation';
import { useAuth } from '../contexts/AuthContext';

const COURT_TYPES = [
  { value: 'all', label: 'All Courts' },
  { value: 'public', label: 'Public Courts' },
  { value: 'private', label: 'Private/Club' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
];

const SURFACE_TYPES = [
  { value: 'all', label: 'All Surfaces' },
  { value: 'concrete', label: 'Concrete' },
  { value: 'asphalt', label: 'Asphalt' },
  { value: 'sport_court', label: 'Sport Court' },
  { value: 'wood', label: 'Wood (Indoor)' },
];

export default function Courts() {
  const { user, isAuthenticated } = useAuth();
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [courtType, setCourtType] = useState('all');
  const [surfaceType, setSurfaceType] = useState('all');
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCourt, setEditingCourt] = useState(null);

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
          setLocationError('Unable to get your location. Enter a location to search.');
        }
      );
    }
  }, []);

  // Load courts (placeholder for now - will connect to API when schema is provided)
  useEffect(() => {
    const loadCourts = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API call when schema is provided
        // const response = await courtsApi.getCourts({
        //   lat: userLocation?.lat,
        //   lng: userLocation?.lng,
        //   type: courtType,
        //   surface: surfaceType
        // });

        // Placeholder courts for now
        setCourts([]);
      } catch (err) {
        console.error('Error loading courts:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCourts();
  }, [userLocation, courtType, surfaceType]);

  const filteredCourts = courts.filter(court => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        court.name?.toLowerCase().includes(query) ||
        court.address?.toLowerCase().includes(query) ||
        court.city?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleEditCourt = (court) => {
    setEditingCourt(court);
    setShowAddModal(true);
  };

  const handleAddCourt = () => {
    setEditingCourt(null);
    setShowAddModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <MapPin className="w-12 h-12" />
              <div>
                <h1 className="text-3xl font-bold">Find Pickleball Courts</h1>
                <p className="text-green-100 mt-1">
                  Search for courts near you and help keep information up to date
                </p>
              </div>
            </div>
            {isAuthenticated && (
              <button
                onClick={handleAddCourt}
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
        {/* Location Notice */}
        {locationError && !userLocation && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {locationError}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, city, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            {/* Court Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={courtType}
                onChange={(e) => setCourtType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
              >
                {COURT_TYPES.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Surface Type Filter */}
            <select
              value={surfaceType}
              onChange={(e) => setSurfaceType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
            >
              {SURFACE_TYPES.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Courts List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : filteredCourts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {filteredCourts.map(court => (
              <CourtCard
                key={court.id}
                court={court}
                isAuthenticated={isAuthenticated}
                onEdit={() => handleEditCourt(court)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Courts Found</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery
                ? 'No courts match your search criteria.'
                : 'No courts have been added to this area yet.'}
            </p>
            {isAuthenticated && (
              <button
                onClick={handleAddCourt}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add a Court
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Court Modal */}
      {showAddModal && (
        <CourtModal
          court={editingCourt}
          onClose={() => {
            setShowAddModal(false);
            setEditingCourt(null);
          }}
          onSave={(data) => {
            // TODO: Implement save when API is ready
            console.log('Saving court:', data);
            setShowAddModal(false);
            setEditingCourt(null);
          }}
        />
      )}
    </div>
  );
}

function CourtCard({ court, isAuthenticated, onEdit }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {court.imageUrl && (
        <img
          src={court.imageUrl}
          alt={court.name}
          className="w-full h-40 object-cover"
        />
      )}
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              court.type === 'public' ? 'bg-green-100 text-green-700' :
              court.type === 'private' ? 'bg-purple-100 text-purple-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {court.type}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              court.indoor ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {court.indoor ? 'Indoor' : 'Outdoor'}
            </span>
          </div>
          {court.rating && (
            <div className="flex items-center gap-1 text-yellow-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-sm font-medium">{court.rating}</span>
            </div>
          )}
        </div>

        <h3 className="font-semibold text-gray-900 mb-2">{court.name}</h3>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{court.address}, {court.city}</span>
          </div>
          {court.numCourts && (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{court.numCourts} courts</span>
            </div>
          )}
          {court.hours && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{court.hours}</span>
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

        <div className="mt-4 flex gap-2">
          <button className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">
            View Details
          </button>
          {isAuthenticated && (
            <button
              onClick={onEdit}
              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Suggest Edit"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CourtModal({ court, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: court?.name || '',
    address: court?.address || '',
    city: court?.city || '',
    state: court?.state || '',
    zipCode: court?.zipCode || '',
    type: court?.type || 'public',
    indoor: court?.indoor || false,
    numCourts: court?.numCourts || 1,
    surface: court?.surface || 'concrete',
    lights: court?.lights || false,
    hours: court?.hours || '',
    phone: court?.phone || '',
    website: court?.website || '',
    notes: court?.notes || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {court ? 'Edit Court' : 'Add New Court'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Basic Information</h3>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Court Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Central Park Pickleball Courts"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private/Club</option>
                    <option value="recreation">Recreation Center</option>
                    <option value="school">School</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Courts</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.numCourts}
                    onChange={(e) => setFormData({ ...formData, numCourts: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.indoor}
                    onChange={(e) => setFormData({ ...formData, indoor: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Indoor</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.lights}
                    onChange={(e) => setFormData({ ...formData, lights: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Has Lights</span>
                </label>
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Location</h3>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-green-500 focus:border-green-500"
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Contact & Hours</h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-green-500 focus:border-green-500"
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-green-500 focus:border-green-500"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                <input
                  type="text"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Dawn to Dusk, or 6AM - 10PM"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-green-500 focus:border-green-500"
              placeholder="Any additional information about this location..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              {court ? 'Save Changes' : 'Add Court'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
