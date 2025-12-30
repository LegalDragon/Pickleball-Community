import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Star, Sun, Moon, Phone, Globe, ExternalLink } from 'lucide-react';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icon for courts
const courtIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map center changes
function MapCenterHandler({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  return null;
}

// Component to fit bounds to all markers
function FitBoundsHandler({ courts }) {
  const map = useMap();

  useEffect(() => {
    if (courts && courts.length > 0) {
      const validCourts = courts.filter(c => c.latitude && c.longitude);
      if (validCourts.length > 0) {
        const bounds = L.latLngBounds(
          validCourts.map(c => [parseFloat(c.latitude), parseFloat(c.longitude)])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    }
  }, [courts, map]);

  return null;
}

export default function CourtMap({
  courts,
  center,
  zoom = 10,
  onCourtClick,
  userLocation,
  fitBounds = true
}) {
  // Filter courts with valid coordinates
  const courtsWithCoords = useMemo(() => {
    return courts.filter(court => {
      const lat = parseFloat(court.latitude || court.gpsLat);
      const lng = parseFloat(court.longitude || court.gpsLng);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    }).map(court => ({
      ...court,
      lat: parseFloat(court.latitude || court.gpsLat),
      lng: parseFloat(court.longitude || court.gpsLng)
    }));
  }, [courts]);

  // Default center (US center) if no courts or user location
  const defaultCenter = useMemo(() => {
    if (userLocation) {
      return [userLocation.lat, userLocation.lng];
    }
    if (courtsWithCoords.length > 0) {
      // Center on first court
      return [courtsWithCoords[0].lat, courtsWithCoords[0].lng];
    }
    // Default to center of US
    return [39.8283, -98.5795];
  }, [userLocation, courtsWithCoords]);

  const getTotalCourts = (court) => {
    return (court.indoorNum || 0) + (court.outdoorNum || 0) + (court.coveredNum || 0);
  };

  const formatAddress = (court) => {
    const parts = [court.city, court.state].filter(Boolean);
    return parts.join(', ');
  };

  if (courtsWithCoords.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center p-8">
          <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Courts with Coordinates</h3>
          <p className="text-gray-500">
            The courts matching your filters don't have GPS coordinates yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={center || defaultCenter}
      zoom={zoom}
      className="h-full w-full rounded-lg"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {fitBounds && <FitBoundsHandler courts={courtsWithCoords} />}
      {center && <MapCenterHandler center={center} zoom={zoom} />}

      {/* User location marker */}
      {userLocation && (
        <Marker
          position={[userLocation.lat, userLocation.lng]}
          icon={new L.Icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3B82F6" width="32" height="32">
                <circle cx="12" cy="12" r="10" fill="#3B82F6" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="white"/>
              </svg>
            `),
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })}
        >
          <Popup>
            <div className="text-center">
              <strong>Your Location</strong>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Court markers */}
      {courtsWithCoords.map(court => (
        <Marker
          key={court.courtId}
          position={[court.lat, court.lng]}
          icon={courtIcon}
          eventHandlers={{
            click: () => onCourtClick && onCourtClick(court)
          }}
        >
          <Popup>
            <div className="min-w-[200px] max-w-[280px]">
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">
                {court.name || 'Unnamed Court'}
              </h3>

              <p className="text-xs text-gray-500 mb-2">
                {formatAddress(court)}
              </p>

              {/* Court counts */}
              <div className="flex flex-wrap gap-1 mb-2">
                {court.indoorNum > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                    {court.indoorNum} Indoor
                  </span>
                )}
                {court.outdoorNum > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                    {court.outdoorNum} Outdoor
                  </span>
                )}
                {court.coveredNum > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                    {court.coveredNum} Covered
                  </span>
                )}
              </div>

              {/* Lights */}
              {court.lights && (
                <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                  {court.lights.toLowerCase() === 'yes' ? (
                    <>
                      <Sun className="w-3 h-3 text-yellow-500" />
                      <span>Lights available</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3 h-3 text-gray-400" />
                      <span>No lights</span>
                    </>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${court.lat},${court.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="w-3 h-3" />
                  Directions
                </a>
                {court.phone && (
                  <a
                    href={`tel:${court.phone}`}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800"
                  >
                    <Phone className="w-3 h-3" />
                    Call
                  </a>
                )}
                {court.website && (
                  <a
                    href={court.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
                  >
                    <Globe className="w-3 h-3" />
                    Website
                  </a>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
