import { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, Users, Filter, Search, ChevronDown } from 'lucide-react';
import Navigation from '../components/ui/Navigation';
import { useAuth } from '../contexts/AuthContext';

const DISTANCE_OPTIONS = [
  { value: 10, label: '10 miles' },
  { value: 25, label: '25 miles' },
  { value: 50, label: '50 miles' },
  { value: 100, label: '100 miles' },
  { value: 250, label: '250 miles' },
  { value: 500, label: '500+ miles' },
];

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [distanceFilter, setDistanceFilter] = useState(100); // Default 100 miles
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [eventType, setEventType] = useState('all');

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
          setLocationError('Unable to get your location. Showing all events.');
        }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser.');
    }
  }, []);

  // Load events (placeholder for now - will connect to API when schema is provided)
  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API call when schema is provided
        // const response = await eventsApi.getEvents({
        //   lat: userLocation?.lat,
        //   lng: userLocation?.lng,
        //   distance: distanceFilter,
        //   type: eventType
        // });

        // Placeholder events for now
        setEvents([]);
      } catch (err) {
        console.error('Error loading events:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [userLocation, distanceFilter, eventType]);

  const filteredEvents = events.filter(event => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        event.title?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Calendar className="w-12 h-12" />
            <div>
              <h1 className="text-3xl font-bold">Pickleball Events</h1>
              <p className="text-primary-100 mt-1">
                Find tournaments, open play, and community events near you
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Location Notice */}
        {locationError && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {locationError}
          </div>
        )}

        {userLocation && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Showing events within {distanceFilter} miles of your location
          </div>
        )}

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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Distance Filter */}
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-500" />
              <select
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(parseInt(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {DISTANCE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Event Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Events</option>
                <option value="tournament">Tournaments</option>
                <option value="open_play">Open Play</option>
                <option value="clinic">Clinics</option>
                <option value="social">Social Events</option>
                <option value="league">Leagues</option>
              </select>
            </div>
          </div>
        </div>

        {/* Events List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Events Found</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery
                ? 'No events match your search criteria.'
                : 'No events are currently scheduled in your area.'}
            </p>
            <p className="text-sm text-gray-400">
              Check back soon or expand your search radius to find more events.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event }) {
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
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-40 object-cover"
        />
      )}
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            event.type === 'tournament' ? 'bg-purple-100 text-purple-700' :
            event.type === 'open_play' ? 'bg-green-100 text-green-700' :
            event.type === 'clinic' ? 'bg-blue-100 text-blue-700' :
            event.type === 'league' ? 'bg-orange-100 text-orange-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {event.type?.replace('_', ' ')}
          </span>
          {event.distance && (
            <span className="text-sm text-gray-500">{event.distance} mi</span>
          )}
        </div>

        <h3 className="font-semibold text-gray-900 mb-2">{event.title}</h3>

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
            <span className="truncate">{event.location}</span>
          </div>
          {event.spotsRemaining !== undefined && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{event.spotsRemaining} spots remaining</span>
            </div>
          )}
        </div>

        <button className="mt-4 w-full py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
          View Details
        </button>
      </div>
    </div>
  );
}
