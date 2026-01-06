import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { userApi, clubsApi, themeApi, getSharedAssetUrl } from '../../services/api';
import { Users, MapPin, Building2, Sparkles } from 'lucide-react';

const RecentPlayers = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    showPlayers: true,
    showClubs: true,
    recentDays: 30,
    playerCount: 20,
    clubCount: 15,
    speed: 40
  });
  const scrollRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch theme settings and data
  const fetchData = async () => {
    try {
      // First get theme settings
      const themeRes = await themeApi.getActive();
      const theme = themeRes.data?.data;

      const marqueeSettings = {
        showPlayers: theme?.marqueeShowPlayers ?? true,
        showClubs: theme?.marqueeShowClubs ?? true,
        recentDays: theme?.marqueeRecentDays ?? 30,
        playerCount: theme?.marqueePlayerCount ?? 20,
        clubCount: theme?.marqueeClubCount ?? 15,
        speed: theme?.marqueeSpeed ?? 40
      };
      setSettings(marqueeSettings);

      // If neither are enabled, don't fetch
      if (!marqueeSettings.showPlayers && !marqueeSettings.showClubs) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Fetch based on settings
      const promises = [];
      if (marqueeSettings.showPlayers) {
        promises.push(userApi.getRecentPlayers(marqueeSettings.playerCount, marqueeSettings.recentDays));
      }
      if (marqueeSettings.showClubs) {
        promises.push(clubsApi.getRecentClubs(marqueeSettings.clubCount, marqueeSettings.recentDays));
      }

      const results = await Promise.all(promises);

      let players = [];
      let clubs = [];

      if (marqueeSettings.showPlayers) {
        const playersRes = results.shift();
        players = (playersRes?.data?.success && playersRes.data.data)
          ? playersRes.data.data.map(p => ({ ...p, type: 'player' }))
          : [];
      }

      if (marqueeSettings.showClubs) {
        const clubsRes = results.shift();
        clubs = (clubsRes?.data?.success && clubsRes.data.data)
          ? clubsRes.data.data.map(c => ({ ...c, type: 'club' }))
          : [];
      }

      // Interleave players and clubs for variety
      const mixed = [];
      const maxLen = Math.max(players.length, clubs.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < players.length) mixed.push(players[i]);
        if (i < clubs.length) mixed.push(clubs[i]);
      }

      setItems(mixed.length > 0 ? mixed : [...players, ...clubs]);
    } catch (err) {
      console.error('Error fetching recent data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Show loading state
  if (loading) {
    return (
      <section className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            <span className="text-white/70 text-sm">Loading community...</span>
          </div>
        </div>
      </section>
    );
  }

  // Don't render if no items or marquee is disabled
  if (items.length === 0) {
    return null;
  }

  // Duplicate items array for seamless infinite scroll
  const duplicatedItems = [...items, ...items];

  return (
    <section className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 py-4 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h3 className="text-white font-semibold text-sm uppercase tracking-wide">
            New to Our Community
          </h3>
        </div>
      </div>

      {/* Marquee Container */}
      <div
        className="relative overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          ref={scrollRef}
          className="flex gap-4 px-4"
          style={{
            width: 'fit-content',
            animation: `marquee ${settings.speed}s linear infinite`,
            animationPlayState: isPaused ? 'paused' : 'running'
          }}
        >
          {duplicatedItems.map((item, index) => (
            item.type === 'club'
              ? <ClubCard key={`club-${item.id}-${index}`} club={item} />
              : <PlayerCard key={`player-${item.id}-${index}`} player={item} />
          ))}
        </div>
      </div>

      {/* CSS for marquee animation */}
      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
};

const PlayerCard = ({ player }) => {
  const displayName = `${player.firstName || ''} ${player.lastName?.charAt(0) || ''}`.trim() || 'Player';
  const location = [player.city, player.state].filter(Boolean).join(', ');

  return (
    <Link
      to={`/players/${player.id}`}
      className="flex-shrink-0 flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 hover:bg-white/20 transition-all group min-w-[200px]"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {player.profileImageUrl ? (
          <img
            src={getSharedAssetUrl(player.profileImageUrl)}
            alt={displayName}
            className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400/50 group-hover:border-emerald-400 transition-colors"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center border-2 border-emerald-400/50 group-hover:border-emerald-400 transition-colors">
            <span className="text-white font-bold text-lg">
              {(player.firstName?.charAt(0) || 'P').toUpperCase()}
            </span>
          </div>
        )}
        {/* Player badge */}
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-emerald-900 flex items-center justify-center">
          <Users className="w-2.5 h-2.5 text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0">
        <div className="text-white font-medium truncate group-hover:text-emerald-300 transition-colors">
          {displayName}
        </div>
        {location && (
          <div className="flex items-center gap-1 text-emerald-300/80 text-sm truncate">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        )}
      </div>
    </Link>
  );
};

const ClubCard = ({ club }) => {
  const location = [club.city, club.state].filter(Boolean).join(', ');

  return (
    <Link
      to={`/clubs/${club.id}`}
      className="flex-shrink-0 flex items-center gap-3 bg-amber-500/20 backdrop-blur-sm rounded-xl px-4 py-3 border border-amber-400/30 hover:bg-amber-500/30 transition-all group min-w-[200px]"
    >
      {/* Logo */}
      <div className="relative flex-shrink-0">
        {club.logoUrl ? (
          <img
            src={getSharedAssetUrl(club.logoUrl)}
            alt={club.name}
            className="w-12 h-12 rounded-lg object-cover border-2 border-amber-400/50 group-hover:border-amber-400 transition-colors"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-amber-600 flex items-center justify-center border-2 border-amber-400/50 group-hover:border-amber-400 transition-colors">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        )}
        {/* Club badge */}
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full border-2 border-emerald-900 flex items-center justify-center">
          <Building2 className="w-2.5 h-2.5 text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0">
        <div className="text-white font-medium truncate group-hover:text-amber-300 transition-colors">
          {club.name}
        </div>
        <div className="flex items-center gap-2 text-amber-300/80 text-sm">
          {location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          )}
          {club.memberCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {club.memberCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default RecentPlayers;
