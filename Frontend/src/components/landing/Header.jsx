import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { getSharedAssetUrl, themeApi } from '../../services/api';
import { MapPin, Users, Award, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

const SHARED_AUTH_URL = import.meta.env.VITE_SHARED_AUTH_URL || 'https://shared.funtimepb.com/api';
const SITE_KEY = 'community';

// Video rotation interval in milliseconds (15 seconds)
const VIDEO_ROTATION_INTERVAL = 15000;

// Check if URL is from external platform
const isExternalVideoUrl = (url) => {
  if (!url) return false;
  const externalPatterns = ['youtube.com', 'youtu.be', 'vimeo.com', 'tiktok.com'];
  return externalPatterns.some(pattern => url.includes(pattern));
};

// Get YouTube embed URL
const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  if (url.includes('youtube.com/watch')) {
    const videoId = new URL(url).searchParams.get('v');
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1`;
  }
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1`;
  }
  return null;
};

const Header = () => {
  const { t, i18n } = useTranslation('home');
  const { theme } = useTheme();
  const isEnglish = i18n.language?.startsWith('en');
  const [logoHtml, setLogoHtml] = useState(null);
  const [activeVideos, setActiveVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRef = useRef(null);
  const rotationTimerRef = useRef(null);

  // Fetch ALL active hero videos from the HeroVideos table
  useEffect(() => {
    const fetchActiveVideos = async () => {
      try {
        const response = await themeApi.getHeroVideos();
        let videos = [];
        if (response?.success && Array.isArray(response.data)) {
          videos = response.data;
        } else if (Array.isArray(response)) {
          videos = response;
        }
        // Get ALL active videos sorted by sortOrder
        const activeVids = videos
          .filter(v => v.isActive)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        setActiveVideos(activeVids);
      } catch (error) {
        console.error('Error fetching hero videos:', error);
      }
    };
    fetchActiveVideos();
  }, []);

  // Navigate to next video
  const goToNextVideo = useCallback(() => {
    if (activeVideos.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentVideoIndex(prev => (prev + 1) % activeVideos.length);
      setIsTransitioning(false);
    }, 300);
  }, [activeVideos.length]);

  // Navigate to previous video
  const goToPrevVideo = useCallback(() => {
    if (activeVideos.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentVideoIndex(prev => (prev - 1 + activeVideos.length) % activeVideos.length);
      setIsTransitioning(false);
    }, 300);
  }, [activeVideos.length]);

  // Auto-rotate videos every 15 seconds when there are multiple
  useEffect(() => {
    if (activeVideos.length > 1) {
      rotationTimerRef.current = setInterval(goToNextVideo, VIDEO_ROTATION_INTERVAL);
      return () => {
        if (rotationTimerRef.current) {
          clearInterval(rotationTimerRef.current);
        }
      };
    }
  }, [activeVideos.length, goToNextVideo]);

  // Get current active video
  const currentVideo = activeVideos[currentVideoIndex] || null;

  // Use active video from HeroVideos table, fallback to legacy heroVideoUrl from theme
  const heroVideoUrl = currentVideo?.videoUrl || theme?.heroVideoUrl;
  const heroThumbnailUrl = currentVideo?.thumbnailUrl || theme?.heroVideoThumbnailUrl;
  const isExternalVideo = isExternalVideoUrl(heroVideoUrl);
  const youtubeEmbedUrl = getYouTubeEmbedUrl(heroVideoUrl);
  const hasVideo = heroVideoUrl && (isExternalVideo || heroVideoUrl);
  const hasImage = theme?.heroImageUrl;

  // Fetch large logo HTML from shared auth
  useEffect(() => {
    const fetchLogoHtml = async () => {
      try {
        const res = await fetch(`${SHARED_AUTH_URL}/settings/logo-html?site=${SITE_KEY}&size=10rem`);
        if (res.ok) {
          const html = await res.text();
          setLogoHtml(html);
        }
      } catch (err) {
        console.warn('Failed to fetch logo HTML:', err);
      }
    };

    if (SHARED_AUTH_URL) {
      fetchLogoHtml();
    }
  }, []);

  return (
    <header className="relative min-h-[80vh] flex items-center overflow-hidden">
      {/* Background Video or Image */}
      {hasVideo ? (
        <>
          <div className={`absolute inset-0 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            {youtubeEmbedUrl ? (
              /* YouTube embed */
              <div className="absolute inset-0 w-full h-full overflow-hidden">
                <iframe
                  key={currentVideo?.id || 'youtube'}
                  src={youtubeEmbedUrl}
                  className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title="Hero video"
                />
              </div>
            ) : isExternalVideo ? (
              /* Other external video - just show image fallback or gradient */
              <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-green-700 to-emerald-800" />
            ) : (
              /* Uploaded/local video file */
              <video
                key={currentVideo?.id || 'video'}
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                poster={heroThumbnailUrl ? getSharedAssetUrl(heroThumbnailUrl) : undefined}
              >
                <source src={getSharedAssetUrl(heroVideoUrl)} type="video/mp4" />
              </video>
            )}
          </div>

          {/* Video Navigation Controls - show when multiple videos */}
          {activeVideos.length > 1 && (
            <>
              {/* Previous/Next Buttons */}
              <button
                onClick={goToPrevVideo}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-all"
                aria-label={t('previousVideo')}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={goToNextVideo}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-all"
                aria-label={t('nextVideo')}
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Dot Indicators - hidden for cleaner look */}
            </>
          )}

        </>
      ) : hasImage ? (
        <img
          src={theme.heroImageUrl.startsWith('http') ? theme.heroImageUrl : getSharedAssetUrl(theme.heroImageUrl)}
          alt="Hero background"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        /* Default gradient background */
        <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-green-700 to-emerald-800" />
      )}

      {/* Overlay for text readability */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Language Switcher - top right corner */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher variant="compact" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-20">
        <div className="max-w-4xl">
          {/* Logo and Title side by side */}
          <div className="flex items-center gap-6 mb-8">
            {logoHtml ? (
              <div
                className="flex-shrink-0 drop-shadow-2xl [&_img]:w-48 [&_img]:h-48 md:[&_img]:w-56 md:[&_img]:h-56 lg:[&_img]:w-64 lg:[&_img]:h-64"
                dangerouslySetInnerHTML={{ __html: logoHtml }}
              />
            ) : (
              <img
                src="/Logo.png"
                alt="Pickleball.Community"
                className="w-48 h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 object-contain drop-shadow-2xl flex-shrink-0"
              />
            )}
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                {isEnglish && theme?.heroTitle ? theme.heroTitle : t('defaultTitle')}
              </h1>
              <p className="text-xl md:text-2xl text-white/90 mt-2">
                {isEnglish && theme?.heroSubtitle ? theme.heroSubtitle : t('defaultSubtitle')}
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
              {isEnglish && theme?.heroCtaText ? theme.heroCtaText : t('findCourts')}
            </Link>
            {(isEnglish ? theme?.heroSecondaryCtaText : true) && (
              <Link
                to={theme?.heroSecondaryCtaLink || '/clubs'}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl backdrop-blur-sm transition-all border border-white/30"
              >
                <Users className="w-5 h-5" />
                {isEnglish && theme?.heroSecondaryCtaText ? theme.heroSecondaryCtaText : t('joinClub')}
              </Link>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickStat icon={MapPin} label={t('quickStats.courts.label')} value={t('quickStats.courts.value')} link="/courts" />
            <QuickStat icon={Users} label={t('quickStats.clubs.label')} value={t('quickStats.clubs.value')} link="/clubs" />
            <QuickStat icon={Award} label={t('quickStats.certified.label')} value={t('quickStats.certified.value')} link="/my-certificate" />
            <QuickStat icon={Calendar} label={t('quickStats.events.label')} value={t('quickStats.events.value')} link="/events" />
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
