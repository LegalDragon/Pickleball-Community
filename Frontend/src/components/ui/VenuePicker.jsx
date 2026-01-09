import { useState, useEffect, useCallback } from 'react';
import { X, Search, MapPin, Building2, Check, Loader2, ChevronRight } from 'lucide-react';
import { venuesApi } from '../../services/api';

/**
 * VenuePicker - A user-friendly venue selection component
 * Shows a modal with search, recent venues, and a browsable list
 */
export default function VenuePicker({
  value, // { id, name, city, state } or null
  onChange, // (venue) => void
  label = "Select Venue",
  placeholder = "Choose a venue...",
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentVenues, setRecentVenues] = useState([]);

  // Load recent venues from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recent-venues');
    if (stored) {
      try {
        setRecentVenues(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading recent venues:', e);
      }
    }
  }, []);

  // Save venue to recent list
  const saveToRecent = useCallback((venue) => {
    const recent = [venue, ...recentVenues.filter(v => v.id !== venue.id)].slice(0, 5);
    setRecentVenues(recent);
    localStorage.setItem('recent-venues', JSON.stringify(recent));
  }, [recentVenues]);

  // Search venues with debounce
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Use stored procedure for match sorting
        const response = await venuesApi.search({
          query: search || '',
          sortBy: 'match',
          pageSize: 20
        });
        if (response.success) {
          const results = response.data?.items || [];
          // DEBUG: Log results from SP
          if (search) {
            console.log('VenuePicker search:', search);
            console.log('Sorted results from SP:', results.map(v => ({ name: v.name, address: v.address, city: v.city })));
          }
          setVenues(results);
        }
      } catch (err) {
        console.error('Error searching venues:', err);
      } finally {
        setLoading(false);
      }
    }, search ? 300 : 0);

    return () => clearTimeout(timer);
  }, [search, isOpen]);

  const handleSelect = (venue) => {
    const selected = {
      id: venue.venueId || venue.id,
      name: venue.name,
      city: venue.city,
      state: venue.state
    };
    onChange(selected);
    saveToRecent(selected);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full text-left border border-gray-300 rounded-lg p-3 hover:border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors ${className}`}
      >
        {value ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-600" />
              <div>
                <span className="font-medium text-gray-900">{value.name}</span>
                {(value.city || value.state) && (
                  <span className="text-sm text-gray-500 ml-2">
                    {[value.city, value.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <MapPin className="w-4 h-4" />
            <span>{placeholder}</span>
          </div>
        )}
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[1100]">
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search venues by name or location..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  autoFocus
                />
                {loading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Recent Venues */}
              {!search && recentVenues.length > 0 && (
                <div className="p-4 border-b">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Recent
                  </h3>
                  <div className="space-y-1">
                    {recentVenues.map((venue) => (
                      <VenueItem
                        key={venue.id}
                        venue={venue}
                        isSelected={value?.id === venue.id}
                        onSelect={() => handleSelect(venue)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Search Results / All Venues */}
              <div className="p-4">
                {!search && (
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {search ? 'Search Results' : 'All Venues'}
                  </h3>
                )}

                {loading && venues.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : venues.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {search ? `No venues found for "${search}"` : 'No venues available'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {venues.map((venue) => (
                      <VenueItem
                        key={venue.venueId || venue.id}
                        venue={venue}
                        isSelected={value?.id === (venue.venueId || venue.id)}
                        onSelect={() => handleSelect(venue)}
                        showDetails
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-3 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Individual venue item component
function VenueItem({ venue, isSelected, onSelect, showDetails = false }) {
  // Build location string
  const location = [venue.city, venue.state].filter(Boolean).join(', ');

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
        isSelected
          ? 'bg-purple-50 border border-purple-200'
          : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
        isSelected ? 'bg-purple-100' : 'bg-gray-100'
      }`}>
        <Building2 className={`w-5 h-5 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{venue.name}</div>
        {showDetails && venue.address && (
          <div className="text-sm text-gray-600 truncate">{venue.address}</div>
        )}
        <div className="text-sm text-gray-500 truncate">
          {location || 'Location not specified'}
          {showDetails && venue.numberOfCourts && (
            <span className="text-gray-400"> · {venue.numberOfCourts} court{venue.numberOfCourts !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {isSelected ? (
        <Check className="w-5 h-5 text-purple-600 flex-shrink-0" />
      ) : (
        <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
      )}
    </button>
  );
}
