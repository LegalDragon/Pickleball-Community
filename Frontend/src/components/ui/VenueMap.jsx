import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import L from 'leaflet';

// Detect if user is likely in China based on timezone
const isLikelyInChina = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === 'Asia/Shanghai' || tz === 'Asia/Chongqing' || tz === 'Asia/Harbin' || tz === 'Asia/Urumqi';
  } catch {
    return false;
  }
};

// Tile providers that work in different regions
const TILE_PROVIDERS = {
  // Default: OpenStreetMap (works most places)
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  // CartoDB (good worldwide availability, cleaner style)
  cartodb: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
  },
  // OSM China-friendly mirror
  osmChina: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }
};

// Get directions URL based on region
const getDirectionsUrl = (lat, lng, inChina) => {
  if (inChina) {
    // Amap/Gaode Maps for China
    return `https://uri.amap.com/marker?position=${lng},${lat}&callnative=0`;
  }
  // Google Maps for everywhere else
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
};

export default function VenueMap({
  venues,
  courts, // Backward compatibility alias for venues
  center,
  zoom = 10,
  onVenueClick,
  onCourtClick, // Backward compatibility
  onMarkerSelect,
  selectedVenueId,
  selectedCourtId, // Backward compatibility
  userLocation,
  fitBounds = true,
  showNumbers = false
}) {
  // Support both venues and courts props for backward compatibility
  const items = venues || courts || [];
  const selectedId = selectedVenueId || selectedCourtId;
  const handleItemClick = onVenueClick || onCourtClick;
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [isClient, setIsClient] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [inChina] = useState(() => isLikelyInChina());

  // Filter venues with valid coordinates
  const venuesWithCoords = useMemo(() => {
    if (!items) return [];
    return items.filter(venue => {
      const lat = parseFloat(venue.latitude || venue.gpsLat);
      const lng = parseFloat(venue.longitude || venue.gpsLng);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    }).map((venue, index) => ({
      ...venue,
      lat: parseFloat(venue.latitude || venue.gpsLat),
      lng: parseFloat(venue.longitude || venue.gpsLng),
      listIndex: index + 1
    }));
  }, [items]);

  // Default center
  const defaultCenter = useMemo(() => {
    if (userLocation) {
      return [userLocation.lat, userLocation.lng];
    }
    if (venuesWithCoords.length > 0) {
      return [venuesWithCoords[0].lat, venuesWithCoords[0].lng];
    }
    return [39.8283, -98.5795]; // Center of US
  }, [userLocation, venuesWithCoords]);

  // Set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isClient || !mapRef.current) return;
    if (mapInstanceRef.current) return; // Already initialized

    // Fix default icon paths - use local assets that work in all regions
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: '/markers/marker-icon.svg',
      iconRetinaUrl: '/markers/marker-icon.svg',
      shadowUrl: null, // SVG doesn't need shadow
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });

    // Create map
    const map = L.map(mapRef.current).setView(center || defaultCenter, zoom);
    mapInstanceRef.current = map;

    // Select tile provider based on region (CartoDB works well globally including China)
    const tileProvider = inChina ? TILE_PROVIDERS.cartodb : TILE_PROVIDERS.osm;
    L.tileLayer(tileProvider.url, {
      attribution: tileProvider.attribution,
      maxZoom: 19
    }).addTo(map);

    // Handle clicks on "View Details" button in popups
    const handlePopupClick = (e) => {
      const btn = e.target.closest('.venue-detail-btn');
      if (btn) {
        const venueId = parseInt(btn.dataset.venueId, 10);
        const venue = items.find(v => (v.id || v.courtId) === venueId);
        if (venue) {
          if (onMarkerSelect) onMarkerSelect(venue);
          if (handleItemClick) handleItemClick(venue);
        }
      }
    };
    mapRef.current.addEventListener('click', handlePopupClick);

    // Mark map as ready so markers can be added
    setMapReady(true);

    return () => {
      if (mapRef.current) {
        mapRef.current.removeEventListener('click', handlePopupClick);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapReady(false);
      }
    };
  }, [isClient, inChina, items, onMarkerSelect, handleItemClick]);

  // Create numbered marker icon
  const createNumberedIcon = (number, isSelected) => {
    const bgColor = isSelected ? '#16a34a' : '#2563eb';
    const size = isSelected ? 32 : 28;

    return L.divIcon({
      html: `<div style="
        width: ${size}px;
        height: ${size}px;
        background: ${bgColor};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: ${isSelected ? '14px' : '12px'};
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ${isSelected ? 'transform: scale(1.1);' : ''}
      ">${number}</div>`,
      className: 'numbered-marker',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2]
    });
  };

  // Update markers when courts change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add court markers
    venuesWithCoords.forEach((court, index) => {
      const number = index + 1;
      const isSelected = selectedCourtId === court.courtId || selectedCourtId === court.id;

      let marker;

      if (showNumbers) {
        // Numbered marker
        const icon = createNumberedIcon(number, isSelected);
        marker = L.marker([court.lat, court.lng], { icon })
          .addTo(map);
      } else {
        // Default marker - use local SVG icons
        const courtIcon = L.icon({
          iconUrl: '/markers/marker-icon.svg',
          iconRetinaUrl: '/markers/marker-icon.svg',
          shadowUrl: null,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        });
        marker = L.marker([court.lat, court.lng], { icon: courtIcon })
          .addTo(map);
      }

      // Bind popup
      const popupContent = createPopupContent(court, number);
      marker.bindPopup(popupContent, { maxWidth: 300 });

      marker.on('click', () => {
        if (onMarkerSelect) onMarkerSelect(court);
        if (onCourtClick) onCourtClick(court);
      });

      // Store court reference for later
      marker.courtData = court;
      markersRef.current.push(marker);
    });

    // Add user location marker
    if (userLocation) {
      const userIcon = L.divIcon({
        html: `<div style="width: 20px; height: 20px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        className: 'user-location-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<strong>Your Location</strong>');

      markersRef.current.push(userMarker);
    }

    // Fit bounds if requested
    if (fitBounds && venuesWithCoords.length > 0) {
      const bounds = L.latLngBounds(venuesWithCoords.map(c => [c.lat, c.lng]));
      if (userLocation) {
        bounds.extend([userLocation.lat, userLocation.lng]);
      }
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [mapReady, venuesWithCoords, userLocation, fitBounds, onCourtClick, onMarkerSelect, selectedCourtId, showNumbers]);

  // Update marker styles when selection changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !showNumbers) return;

    markersRef.current.forEach((marker, index) => {
      if (!marker.courtData) return; // Skip user location marker

      const court = marker.courtData;
      const isSelected = selectedCourtId === court.courtId || selectedCourtId === court.id;
      const number = index + 1;

      const icon = createNumberedIcon(number, isSelected);
      marker.setIcon(icon);

      // Open popup if selected
      if (isSelected && mapInstanceRef.current) {
        marker.openPopup();
        mapInstanceRef.current.panTo([court.lat, court.lng]);
      }
    });
  }, [selectedCourtId, showNumbers]);

  // Create popup HTML content
  const createPopupContent = (court, number) => {
    const address = [court.city, court.state].filter(Boolean).join(', ');

    let courtTypes = '';
    if (court.indoorNum > 0) {
      courtTypes += `<span style="display: inline-block; padding: 2px 6px; background: #dbeafe; color: #1d4ed8; border-radius: 4px; font-size: 11px; margin-right: 4px;">${court.indoorNum} Indoor</span>`;
    }
    if (court.outdoorNum > 0) {
      courtTypes += `<span style="display: inline-block; padding: 2px 6px; background: #dcfce7; color: #15803d; border-radius: 4px; font-size: 11px; margin-right: 4px;">${court.outdoorNum} Outdoor</span>`;
    }
    if (court.coveredNum > 0) {
      courtTypes += `<span style="display: inline-block; padding: 2px 6px; background: #f3e8ff; color: #7c3aed; border-radius: 4px; font-size: 11px;">${court.coveredNum} Covered</span>`;
    }

    let lights = '';
    if (court.lights) {
      const hasLights = court.lights.toLowerCase() === 'yes';
      lights = `<div style="font-size: 11px; color: #666; margin-bottom: 8px;">
        ${hasLights ? '☀️ Lights available' : '🌙 No lights'}
      </div>`;
    }

    // Use region-appropriate map service for directions (Amap for China, Google Maps elsewhere)
    const directionsUrl = getDirectionsUrl(court.lat, court.lng, inChina);
    const venueId = court.id || court.courtId;

    let actions = `<a href="${directionsUrl}" target="_blank" rel="noopener" style="color: #2563eb; font-size: 11px; text-decoration: none; margin-right: 8px;">📍 Directions</a>`;
    if (court.phone) {
      actions += `<a href="tel:${court.phone}" style="color: #16a34a; font-size: 11px; text-decoration: none; margin-right: 8px;">📞 Call</a>`;
    }
    if (court.website) {
      actions += `<a href="${court.website}" target="_blank" rel="noopener" style="color: #7c3aed; font-size: 11px; text-decoration: none;">🌐 Website</a>`;
    }

    return `
      <div style="min-width: 180px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          ${number ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #2563eb; color: white; border-radius: 50%; font-size: 12px; font-weight: 600;">${number}</span>` : ''}
          <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #111;">${court.name || 'Unnamed Venue'}</h3>
        </div>
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">${address}</p>
        ${courtTypes ? `<div style="margin-bottom: 8px;">${courtTypes}</div>` : ''}
        ${lights}
        <div style="padding-top: 8px; border-top: 1px solid #eee; display: flex; flex-wrap: wrap; gap: 4px;">
          ${actions}
        </div>
        <button
          data-venue-id="${venueId}"
          class="venue-detail-btn"
          style="width: 100%; margin-top: 8px; padding: 8px 12px; background: #16a34a; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;"
        >
          View Details
        </button>
      </div>
    `;
  };

  if (!isClient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (venuesWithCoords.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center p-8">
          <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Venues with Coordinates</h3>
          <p className="text-gray-500">
            The venues matching your filters don't have GPS coordinates yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="h-full w-full rounded-lg"
      style={{ minHeight: '400px' }}
    />
  );
}
