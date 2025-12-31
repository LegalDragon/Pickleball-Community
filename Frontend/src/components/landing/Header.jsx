import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { Play, Pause, Volume2, VolumeX, MapPin, Users, Award, Calendar } from 'lucide-react';

const Header = () => {
  const { theme } = useTheme();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  const hasVideo = theme?.heroVideoUrl;
  const hasImage = theme?.heroImageUrl;

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <header className="relative min-h-[80vh] flex items-center overflow-hidden">
      {/* Background Video or Image */}
      {hasVideo ? (
        <>
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            loop
            muted={isMuted}
            playsInline
            poster={theme?.heroVideoThumbnailUrl}
          >
            <source src={theme.heroVideoUrl} type="video/mp4" />
          </video>
          {/* Video Controls */}
          <div className="absolute bottom-4 right-4 flex gap-2 z-20">
            <button
              onClick={togglePlay}
              className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleMute}
              className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </>
      ) : hasImage ? (
        <img
          src={theme.heroImageUrl}
          alt="Hero background"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        /* Default gradient background */
        <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-green-700 to-emerald-800" />
      )}

      {/* Overlay for text readability */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-20">
        <div className="max-w-4xl">
          {/* Logo and Title side by side */}
          <div className="flex items-center gap-6 mb-8">
            <img
              src="/Logo.png"
              alt="Pickleball.Community"
              className="w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 object-contain drop-shadow-2xl flex-shrink-0"
            />
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                {theme?.heroTitle || 'Pickleball.Community'}
              </h1>
              <p className="text-xl md:text-2xl text-white/90 mt-2">
                {theme?.heroSubtitle || 'Connect. Play. Get Certified.'}
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 mb-12">
            <Link
              to={theme?.heroCtaLink || '/courts'}
              className="inline-flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <MapPin className="w-5 h-5" />
              {theme?.heroCtaText || 'Find Courts'}
            </Link>
            {(theme?.heroSecondaryCtaText || !theme) && (
              <Link
                to={theme?.heroSecondaryCtaLink || '/clubs'}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl backdrop-blur-sm transition-all border border-white/30"
              >
                <Users className="w-5 h-5" />
                {theme?.heroSecondaryCtaText || 'Join a Club'}
              </Link>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickStat icon={MapPin} label="Local Courts" value="Find Nearby" link="/courts" />
            <QuickStat icon={Users} label="Active Clubs" value="Join Today" link="/clubs" />
            <QuickStat icon={Award} label="Get Certified" value="Peer Reviews" link="/my-certificate" />
            <QuickStat icon={Calendar} label="Local Events" value="Play More" link="/events" />
          </div>
        </div>
      </div>
    </header>
  );
};

const QuickStat = ({ icon: Icon, label, value, link }) => (
  <Link
    to={link}
    className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:bg-white/20 transition-colors group"
  >
    <Icon className="w-6 h-6 text-green-400 mb-2 group-hover:scale-110 transition-transform" />
    <div className="text-white font-semibold">{value}</div>
    <div className="text-white/70 text-sm">{label}</div>
  </Link>
);

export default Header;
