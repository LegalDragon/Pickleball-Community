import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Sun, Moon, Phone, Globe, ExternalLink } from 'lucide-react';

// Dynamically import leaflet to avoid SSR issues
let L = null;
if (typeof window !== 'undefined') {
  L = require('leaflet');
}

export default function CourtMap({
  courts,
  center,
  zoom = 10,
  onCourtClick,
  userLocation,
  fitBounds = true
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [isClient, setIsClient] = useState(false);

  // Filter courts with valid coordinates
  const courtsWithCoords = useMemo(() => {
    if (!courts) return [];
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

  // Default center
  const defaultCenter = useMemo(() => {
    if (userLocation) {
      return [userLocation.lat, userLocation.lng];
    }
    if (courtsWithCoords.length > 0) {
      return [courtsWithCoords[0].lat, courtsWithCoords[0].lng];
    }
    return [39.8283, -98.5795]; // Center of US
  }, [userLocation, courtsWithCoords]);

  // Set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isClient || !mapRef.current || !L) return;
    if (mapInstanceRef.current) return; // Already initialized

    // Fix default icon paths
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    // Create map
    const map = L.map(mapRef.current).setView(center || defaultCenter, zoom);
    mapInstanceRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isClient]);

  // Update markers when courts change
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Create court icon
    const courtIcon = L.icon({
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add court markers
    courtsWithCoords.forEach(court => {
      const popupContent = createPopupContent(court);
      const marker = L.marker([court.lat, court.lng], { icon: courtIcon })
        .addTo(map)
        .bindPopup(popupContent, { maxWidth: 300 });

      marker.on('click', () => {
        if (onCourtClick) onCourtClick(court);
      });

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
    if (fitBounds && courtsWithCoords.length > 0) {
      const bounds = L.latLngBounds(courtsWithCoords.map(c => [c.lat, c.lng]));
      if (userLocation) {
        bounds.extend([userLocation.lat, userLocation.lng]);
      }
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [courtsWithCoords, userLocation, fitBounds, onCourtClick]);

  // Create popup HTML content
  const createPopupContent = (court) => {
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

    let actions = `<a href="https://www.google.com/maps/search/?api=1&query=${court.lat},${court.lng}" target="_blank" rel="noopener" style="color: #2563eb; font-size: 11px; text-decoration: none; margin-right: 8px;">📍 Directions</a>`;
    if (court.phone) {
      actions += `<a href="tel:${court.phone}" style="color: #16a34a; font-size: 11px; text-decoration: none; margin-right: 8px;">📞 Call</a>`;
    }
    if (court.website) {
      actions += `<a href="${court.website}" target="_blank" rel="noopener" style="color: #7c3aed; font-size: 11px; text-decoration: none;">🌐 Website</a>`;
    }

    return `
      <div style="min-width: 180px;">
        <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #111;">${court.name || 'Unnamed Court'}</h3>
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">${address}</p>
        ${courtTypes ? `<div style="margin-bottom: 8px;">${courtTypes}</div>` : ''}
        ${lights}
        <div style="padding-top: 8px; border-top: 1px solid #eee;">
          ${actions}
        </div>
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
    <div
      ref={mapRef}
      className="h-full w-full rounded-lg"
      style={{ minHeight: '400px' }}
    />
  );
}
