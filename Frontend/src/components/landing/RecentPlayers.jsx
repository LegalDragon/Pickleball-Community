import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { userApi, getSharedAssetUrl } from '../../services/api';
import { Users, MapPin } from 'lucide-react';

const RecentPlayers = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch recent players
  const fetchPlayers = async () => {
    try {
      const response = await userApi.getRecentPlayers(30);
      if (response.data?.success && response.data.data) {
        setPlayers(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching recent players:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchPlayers, 60000);
    return () => clearInterval(interval);
  }, []);

  // Don't render if no players
  if (loading || players.length === 0) {
    return null;
  }

  // Duplicate players array for seamless infinite scroll
  const duplicatedPlayers = [...players, ...players];

  return (
    <section className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 py-4 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <Users className="w-5 h-5 text-emerald-400" />
          <h3 className="text-white font-semibold text-sm uppercase tracking-wide">
            Recently Joined Players
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
          className={`flex gap-4 ${isPaused ? 'animate-marquee-paused' : 'animate-marquee'}`}
          style={{
            width: 'fit-content'
          }}
        >
          {duplicatedPlayers.map((player, index) => (
            <PlayerCard key={`${player.id}-${index}`} player={player} />
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

        .animate-marquee {
          animation: marquee 30s linear infinite;
        }

        .animate-marquee-paused {
          animation: marquee 30s linear infinite;
          animation-play-state: paused;
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
        {/* Online indicator */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-emerald-900" />
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

export default RecentPlayers;
