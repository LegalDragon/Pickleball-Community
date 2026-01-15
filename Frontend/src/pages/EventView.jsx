import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar, MapPin, Clock, Users, DollarSign, ChevronLeft,
  UserPlus, Building2, Phone, Mail, User, Image, ExternalLink,
  Loader2, AlertCircle, FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { eventsApi, objectAssetsApi, getSharedAssetUrl } from '../services/api';
import { getIconByName } from '../utils/iconMap';
import { getColorValues } from '../utils/colorMap';

export default function EventView() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [event, setEvent] = useState(null);
  const [adAssets, setAdAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load event data
  useEffect(() => {
    const loadEvent = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await eventsApi.getEventPublic(eventId);
        if (response.success && response.data) {
          setEvent(response.data);

          // Load ad assets for the event
          try {
            const assetsResponse = await objectAssetsApi.getAssets('Event', eventId);
            if (assetsResponse.success && assetsResponse.data) {
              // Filter for 'ad' type assets that are public
              const ads = assetsResponse.data.filter(a =>
                a.assetTypeName?.toLowerCase() === 'ad' && a.isPublic
              );
              setAdAssets(ads);
            }
          } catch (assetErr) {
            console.log('No ad assets found:', assetErr);
          }
        } else {
          setError('Event not found or not available');
        }
      } catch (err) {
        console.error('Error loading event:', err);
        setError(err?.message || 'Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      loadEvent();
    }
  }, [eventId]);

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

  const handleRegister = () => {
    if (isAuthenticated) {
      // Go to events page and open the event modal
      navigate('/events', { state: { openEventId: event.id } });
    } else {
      // Redirect to login with return path
      navigate('/login', { state: { from: `/events/${eventId}` } });
    }
  };

  const getEventTypeStyle = () => {
    if (event?.eventTypeIcon && event?.eventTypeColor) {
      const Icon = getIconByName(event.eventTypeIcon) || Calendar;
      const colorStyle = getColorValues(event.eventTypeColor) || { bg: 'bg-gray-100', text: 'text-gray-700' };
      return { color: `${colorStyle.bg} ${colorStyle.text}`, Icon };
    }
    return { color: 'bg-gray-100 text-gray-700', Icon: Calendar };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Event Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'This event is not available or may be private.'}</p>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  const typeStyle = getEventTypeStyle();
  const isRegistrationOpen = event.registrationOpenDate
    ? new Date(event.registrationOpenDate) <= new Date()
    : true;
  const isRegistrationClosed = event.registrationCloseDate
    ? new Date(event.registrationCloseDate) < new Date()
    : false;
  const isEventPast = new Date(event.endDate) < new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Banner */}
      <div className="relative">
        {/* Banner Image */}
        <div className="h-48 sm:h-64 bg-gradient-to-br from-orange-400 to-orange-600 relative overflow-hidden">
          {event.bannerImageUrl || event.posterImageUrl ? (
            <img
              src={getSharedAssetUrl(event.bannerImageUrl || event.posterImageUrl)}
              alt={event.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Calendar className="w-24 h-24 text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Back Button */}
        <Link
          to="/events"
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Events</span>
        </Link>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-10 pb-8">
        {/* Event Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Register Button - Sticky at top */}
          <div className="p-4 bg-orange-50 border-b border-orange-100">
            {isEventPast ? (
              <div className="text-center text-gray-600">
                <p className="font-medium">This event has ended</p>
              </div>
            ) : isRegistrationClosed ? (
              <div className="text-center text-gray-600">
                <p className="font-medium">Registration is closed</p>
              </div>
            ) : !isRegistrationOpen ? (
              <div className="text-center text-gray-600">
                <p className="font-medium">Registration opens {formatDate(event.registrationOpenDate)}</p>
              </div>
            ) : (
              <button
                onClick={handleRegister}
                className="w-full py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                {isAuthenticated ? 'Register for Event' : 'Login to Register'}
              </button>
            )}
          </div>

          {/* Event Header */}
          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full ${typeStyle.color}`}>
                <typeStyle.Icon className="w-4 h-4" />
                {event.eventTypeName || 'Event'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              {event.name}
            </h1>

            {/* Quick Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date & Time</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(event.startDate)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatTime(event.startDate)}
                    {event.endDate !== event.startDate && (
                      <> - {formatDate(event.endDate) !== formatDate(event.startDate)
                        ? formatDate(event.endDate)
                        : formatTime(event.endDate)}</>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  {event.venueName ? (
                    event.courtId ? (
                      <Link
                        to={`/venues?venueId=${event.courtId}`}
                        className="font-medium text-orange-600 hover:text-orange-700 hover:underline"
                      >
                        {event.venueName}
                      </Link>
                    ) : (
                      <p className="font-medium text-gray-900">{event.venueName}</p>
                    )
                  ) : null}
                  <p className="text-sm text-gray-600">
                    {[event.city, event.state, event.country].filter(Boolean).join(', ')}
                  </p>
                  {event.address && (
                    <p className="text-sm text-gray-500">{event.address}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Registered</p>
                  <p className="font-medium text-gray-900">
                    {event.registeredPlayerCount} {event.registeredPlayerCount === 1 ? 'player' : 'players'}
                  </p>
                  {event.maxParticipants && (
                    <p className="text-sm text-gray-500">
                      {event.maxParticipants - event.registeredPlayerCount} spots left
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Entry Fee</p>
                  <p className="font-medium text-gray-900">
                    {event.registrationFee > 0 ? (
                      <>
                        ${event.registrationFee}
                        {event.priceUnit && event.priceUnit !== 'person' && (
                          <span className="text-sm text-gray-500 ml-1">
                            /{event.priceUnit}
                            {event.paymentModel === 'per_person' && ' ea'}
                          </span>
                        )}
                        {(!event.priceUnit || event.priceUnit === 'person') && (
                          <span className="text-sm text-gray-500 ml-1">/person</span>
                        )}
                      </>
                    ) : (
                      <span className="text-green-600">Free</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">About this Event</h2>
                <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
              </div>
            )}

            {/* Organizer Info */}
            <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-gray-100">
              {event.organizerName && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>Organized by <span className="font-medium">{event.organizerName}</span></span>
                </div>
              )}
              {event.clubName && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Building2 className="w-4 h-4" />
                  <span>{event.clubName}</span>
                </div>
              )}
            </div>

            {/* Contact Info */}
            {(event.contactName || event.contactEmail || event.contactPhone) && (
              <div className="mb-6 pb-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Contact</h2>
                <div className="space-y-2">
                  {event.contactName && (
                    <p className="text-gray-600">{event.contactName}</p>
                  )}
                  {event.contactEmail && (
                    <a
                      href={`mailto:${event.contactEmail}`}
                      className="flex items-center gap-2 text-orange-600 hover:text-orange-700"
                    >
                      <Mail className="w-4 h-4" />
                      {event.contactEmail}
                    </a>
                  )}
                  {event.contactPhone && (
                    <a
                      href={`tel:${event.contactPhone}`}
                      className="flex items-center gap-2 text-orange-600 hover:text-orange-700"
                    >
                      <Phone className="w-4 h-4" />
                      {event.contactPhone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Ad Assets */}
            {adAssets.length > 0 && (
              <div className="mb-6 pb-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Image className="w-5 h-5 text-orange-600" />
                  Sponsors & Ads
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {adAssets.map((asset) => (
                    <div key={asset.id} className="relative group">
                      {asset.fileUrl && (
                        asset.linkUrl ? (
                          <a
                            href={asset.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={getSharedAssetUrl(asset.fileUrl)}
                              alt={asset.title || 'Ad'}
                              className="w-full h-auto rounded-lg shadow-sm hover:shadow-md transition-shadow"
                            />
                            {asset.title && (
                              <p className="mt-2 text-sm text-gray-600">{asset.title}</p>
                            )}
                          </a>
                        ) : (
                          <>
                            <img
                              src={getSharedAssetUrl(asset.fileUrl)}
                              alt={asset.title || 'Ad'}
                              className="w-full h-auto rounded-lg shadow-sm"
                            />
                            {asset.title && (
                              <p className="mt-2 text-sm text-gray-600">{asset.title}</p>
                            )}
                          </>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Divisions */}
            {event.divisions && event.divisions.length > 0 && (
              <div className="mb-6 pb-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Divisions</h2>
                <div className="space-y-3">
                  {event.divisions.map((division) => (
                    <div
                      key={division.id}
                      className="p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{division.name}</h3>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {division.teamUnitName && (
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                {division.teamUnitName}
                              </span>
                            )}
                            {division.skillLevelName && (
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                {division.skillLevelName}
                              </span>
                            )}
                            {division.ageGroupName && (
                              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                                {division.ageGroupName}
                              </span>
                            )}
                          </div>
                          {division.description && (
                            <p className="text-sm text-gray-500 mt-2">{division.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {division.registeredCount} {division.registeredCount === 1 ? 'team' : 'teams'}
                          </p>
                          {division.maxUnits && (
                            <p className="text-xs text-gray-500">
                              Max {division.maxUnits}
                            </p>
                          )}
                          {division.lookingForPartnerCount > 0 && (
                            <p className="text-xs text-orange-600 mt-1">
                              {division.lookingForPartnerCount} looking for partner
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Registered Players */}
            {event.registeredPlayers && event.registeredPlayers.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-600" />
                  Registered Players ({event.registeredPlayers.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {event.registeredPlayers.map((player) => (
                    <div
                      key={player.userId}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                      {player.profileImageUrl ? (
                        <img
                          src={getSharedAssetUrl(player.profileImageUrl)}
                          alt={player.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {player.name}
                        </p>
                        {(player.city || player.state) && (
                          <p className="text-xs text-gray-500 truncate">
                            {[player.city, player.state].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Register Button (mobile) */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 sm:hidden">
            {!isEventPast && isRegistrationOpen && !isRegistrationClosed && (
              <button
                onClick={handleRegister}
                className="w-full py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                {isAuthenticated ? 'Register for Event' : 'Login to Register'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
