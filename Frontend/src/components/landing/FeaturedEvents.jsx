import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, MapPin, Clock, Users, ChevronLeft, ChevronRight, ArrowRight,
  // Icons that can be assigned to event types
  Trophy, Medal, Award, Crown, Target, Flame, Swords, Shield,
  CalendarDays, CalendarCheck, CalendarClock, Timer,
  Users2, UserPlus, UserCheck, User, UsersRound,
  BookOpen, GraduationCap, Lightbulb, Sparkles, Star,
  PartyPopper, Heart, ThumbsUp, Smile, Music, Gift, Cake,
  Dumbbell, Activity, Bike, CircleDot, Compass, Mountain, Zap, Rocket,
  Stethoscope, HeartPulse,
  MessageCircle, Megaphone, Bell, Mail,
  Home, Building, Store, Flag, Bookmark, Tag, Hash, AtSign,
  Sun, Moon, Cloud, Leaf, TreePine, Waves, Droplet, Wind
} from 'lucide-react';
import { eventsApi, getSharedAssetUrl } from '../../services/api';

// Icon lookup map
const ICON_MAP = {
  'trophy': Trophy, 'medal': Medal, 'award': Award, 'crown': Crown, 'target': Target,
  'goal': Target, 'flame': Flame, 'swords': Swords, 'shield': Shield,
  'calendar': Calendar, 'calendar-days': CalendarDays, 'calendar-check': CalendarCheck,
  'calendar-clock': CalendarClock, 'clock': Clock, 'timer': Timer, 'timer-off': Timer,
  'users': Users, 'users-round': Users, 'users2': Users2, 'user-plus': UserPlus,
  'user-check': UserCheck, 'user': User, 'person-standing': User, 'handshake': Users,
  'book-open': BookOpen, 'graduation-cap': GraduationCap, 'school': GraduationCap, 'lightbulb': Lightbulb,
  'brain': Lightbulb, 'sparkles': Sparkles, 'star': Star,
  'party-popper': PartyPopper, 'heart': Heart, 'thumbs-up': ThumbsUp, 'smile': Smile,
  'music': Music, 'gift': Gift, 'cake': Cake,
  'dumbbell': Dumbbell, 'activity': Activity, 'bike': Bike, 'circle-dot': CircleDot,
  'compass': Compass, 'mountain': Mountain, 'zap': Zap, 'rocket': Rocket,
  'stethoscope': Stethoscope, 'heart-pulse': HeartPulse, 'pill': HeartPulse, 'cross': HeartPulse, 'badge-plus': HeartPulse,
  'message-circle': MessageCircle, 'megaphone': Megaphone, 'bell': Bell, 'mail': Mail,
  'radio': Bell, 'podcast': Megaphone, 'map-pin': MapPin,
  'home': Home, 'building': Building, 'store': Store, 'flag': Flag,
  'bookmark': Bookmark, 'tag': Tag, 'hash': Hash, 'at-sign': AtSign,
  'sun': Sun, 'moon': Moon, 'cloud': Cloud, 'leaf': Leaf,
  'tree-pine': TreePine, 'waves': Waves, 'droplets': Droplet, 'wind': Wind,
};

// Color lookup map - returns both background and text classes for badges
const COLOR_MAP = {
  'green': { bg: 'bg-green-100', text: 'text-green-700' },
  'blue': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'yellow': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'purple': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'pink': { bg: 'bg-pink-100', text: 'text-pink-700' },
  'red': { bg: 'bg-red-100', text: 'text-red-700' },
  'orange': { bg: 'bg-orange-100', text: 'text-orange-700' },
  'teal': { bg: 'bg-teal-100', text: 'text-teal-700' },
  'indigo': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'cyan': { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  'emerald': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'rose': { bg: 'bg-rose-100', text: 'text-rose-700' },
  'amber': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'slate': { bg: 'bg-slate-100', text: 'text-slate-700' },
};

export default function FeaturedEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const sliderRef = useRef(null);
  const autoPlayRef = useRef(null);

  // Load featured events
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const response = await eventsApi.getFeatured(8);
        if (response.success && response.data) {
          // Combine upcoming and popular, remove duplicates
          const allEvents = [...response.data.upcomingEvents];
          response.data.popularEvents.forEach(evt => {
            if (!allEvents.find(e => e.id === evt.id)) {
              allEvents.push(evt);
            }
          });
          // Add recent past events with a flag
          const recentPast = (response.data.recentPastEvents || []).map(evt => ({
            ...evt,
            isPastEvent: true
          }));
          recentPast.forEach(evt => {
            if (!allEvents.find(e => e.id === evt.id)) {
              allEvents.push(evt);
            }
          });
          setEvents(allEvents.slice(0, 10));
        }
      } catch (err) {
        console.error('Error loading featured events:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  // Auto-play carousel
  useEffect(() => {
    if (isAutoPlaying && events.length > 3) {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % Math.max(1, events.length - 2));
      }, 4000);
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isAutoPlaying, events.length]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex(prev => Math.min(events.length - 3, prev + 1));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-600"></div>
          </div>
        </div>
      </section>
    );
  }

  if (events.length === 0) {
    return null; // Don't show section if no events
  }

  return (
    <section className="py-16 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Upcoming Events</h2>
            <p className="text-gray-600 mt-1">Find tournaments and events near you</p>
          </div>
          <Link
            to="/events"
            className="hidden sm:flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
          >
            View All Events
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Slider Container */}
        <div className="relative">
          {/* Navigation Buttons */}
          {events.length > 3 && (
            <>
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous events"
              >
                <ChevronLeft className="w-6 h-6 text-gray-700" />
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex >= events.length - 3}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next events"
              >
                <ChevronRight className="w-6 h-6 text-gray-700" />
              </button>
            </>
          )}

          {/* Events Slider */}
          <div
            ref={sliderRef}
            className="overflow-hidden"
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
          >
            <div
              className="flex transition-transform duration-500 ease-out gap-6"
              style={{
                transform: `translateX(-${currentIndex * (100 / 3 + 2)}%)`,
              }}
            >
              {events.map((event, index) => (
                <div
                  key={event.id}
                  className="flex-shrink-0 w-full sm:w-1/2 lg:w-1/3"
                  style={{ minWidth: 'calc(33.333% - 16px)' }}
                >
                  <EventCard event={event} formatDate={formatDate} formatTime={formatTime} />
                </div>
              ))}
            </div>
          </div>

          {/* Pagination Dots */}
          {events.length > 3 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: Math.max(1, events.length - 2) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setCurrentIndex(i);
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex ? 'bg-orange-600' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Mobile View All Link */}
        <div className="mt-8 text-center sm:hidden">
          <Link
            to="/events"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
          >
            View All Events
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function EventCard({ event, formatDate, formatTime }) {
  // Get icon from event type data, fallback to name-based matching for backwards compatibility
  const getEventTypeStyle = () => {
    // Use dynamic icon/color from event type if available
    if (event.eventTypeIcon && event.eventTypeColor) {
      const Icon = ICON_MAP[event.eventTypeIcon] || Calendar;
      const colorStyle = COLOR_MAP[event.eventTypeColor] || { bg: 'bg-gray-100', text: 'text-gray-700' };
      return { color: `${colorStyle.bg} ${colorStyle.text}`, Icon };
    }

    // Fallback: match based on event type name (for backwards compatibility)
    const name = (event.eventTypeName || '').toLowerCase();
    if (name.includes('tournament')) return { color: 'bg-purple-100 text-purple-700', Icon: Trophy };
    if (name.includes('mini') || name.includes('match')) return { color: 'bg-red-100 text-red-700', Icon: Swords };
    if (name.includes('open') || name.includes('play')) return { color: 'bg-green-100 text-green-700', Icon: UsersRound };
    if (name.includes('clinic') || name.includes('lesson')) return { color: 'bg-blue-100 text-blue-700', Icon: Stethoscope };
    if (name.includes('league')) return { color: 'bg-orange-100 text-orange-700', Icon: Trophy };
    if (name.includes('social')) return { color: 'bg-pink-100 text-pink-700', Icon: PartyPopper };
    return { color: 'bg-gray-100 text-gray-700', Icon: Calendar };
  };

  const typeStyle = getEventTypeStyle();

  return (
    <Link
      to={`/event/${event.id}`}
      className="block bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group"
    >
      {/* Image */}
      <div className="h-40 bg-gradient-to-br from-orange-400 to-orange-600 relative overflow-hidden">
        {event.posterImageUrl ? (
          <img
            src={getSharedAssetUrl(event.posterImageUrl)}
            alt={event.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Calendar className="w-16 h-16 text-white/30" />
          </div>
        )}

        {/* Date Badge */}
        <div className={`absolute top-3 left-3 rounded-lg px-3 py-1 shadow-md ${event.isPastEvent ? 'bg-gray-100' : 'bg-white'}`}>
          <div className="text-center">
            <div className="text-xs font-medium text-gray-500 uppercase">
              {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short' })}
            </div>
            <div className={`text-xl font-bold ${event.isPastEvent ? 'text-gray-500' : 'text-gray-900'}`}>
              {new Date(event.startDate).getDate()}
            </div>
            {event.isPastEvent && (
              <div className="text-xs text-gray-500">Past</div>
            )}
          </div>
        </div>

        {/* Event Type Badge */}
        <div className="absolute top-3 right-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${typeStyle.color}`}>
            <typeStyle.Icon className="w-3 h-3" />
            {event.eventTypeName || 'Event'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-orange-600 transition-colors">
            {event.name}
          </h3>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-600 transition-colors flex-shrink-0" />
        </div>

        <div className="space-y-1.5 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>{formatDate(event.startDate)} at {formatTime(event.startDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="truncate">
              {event.venueName || `${event.city}${event.state ? `, ${event.state}` : ''}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>{event.registeredCount} registered</span>
          </div>
        </div>

        {/* Fee */}
        {event.registrationFee > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">Entry fee</span>
            <span className="font-semibold text-orange-600">
              ${event.registrationFee}
              {event.priceUnit && event.priceUnit !== 'person' && (
                <span className="text-xs text-gray-500 ml-1">
                  /{event.priceUnit}
                  {event.paymentModel === 'per_person' && ' ea'}
                </span>
              )}
              {(!event.priceUnit || event.priceUnit === 'person') && (
                <span className="text-xs text-gray-500 ml-1">/person</span>
              )}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
