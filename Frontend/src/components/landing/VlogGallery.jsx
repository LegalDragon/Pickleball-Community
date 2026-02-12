import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Video, PlayCircle, ChevronLeft, ChevronRight, ArrowRight, 
  Eye, Clock, User 
} from 'lucide-react';
import { blogApi, getSharedAssetUrl } from '../../services/api';

// Helper to extract YouTube video ID
const getYouTubeId = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\s?]+)/);
  return match ? match[1] : null;
};

// Helper to extract Vimeo video ID  
const getVimeoId = (url) => {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
};

export default function VlogGallery() {
  const [vlogs, setVlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayRef = useRef(null);

  // Load vlogs
  useEffect(() => {
    const loadVlogs = async () => {
      try {
        const response = await blogApi.getPosts({
          postType: 'Vlog',
          status: 'Published',
          pageSize: 6
        });
        
        if (response?.success) {
          const items = response.data?.items || response.data || [];
          setVlogs(items);
        }
      } catch (err) {
        console.error('Error loading vlogs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadVlogs();
  }, []);

  // Auto-play carousel on desktop
  useEffect(() => {
    if (isAutoPlaying && vlogs.length > 3) {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % Math.max(1, vlogs.length - 2));
      }, 5000);
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isAutoPlaying, vlogs.length]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex(prev => Math.min(vlogs.length - 3, prev + 1));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <section className="py-16 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        </div>
      </section>
    );
  }

  if (vlogs.length === 0) {
    return null; // Don't show section if no vlogs
  }

  return (
    <section className="py-16 bg-gradient-to-b from-white to-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-xl">
              <Video className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Latest Vlogs</h2>
              <p className="text-gray-600 mt-1">Video content from the community</p>
            </div>
          </div>
          <Link
            to="/blog?type=Vlog"
            className="hidden sm:flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
          >
            View All Vlogs
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Vlog Cards Container */}
        <div className="relative">
          {/* Navigation Buttons */}
          {vlogs.length > 3 && (
            <>
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous vlogs"
              >
                <ChevronLeft className="w-6 h-6 text-gray-700" />
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex >= vlogs.length - 3}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next vlogs"
              >
                <ChevronRight className="w-6 h-6 text-gray-700" />
              </button>
            </>
          )}

          {/* Vlogs Slider */}
          <div
            className="overflow-hidden"
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
          >
            <div
              className="flex transition-transform duration-500 ease-out gap-6"
              style={{
                transform: vlogs.length > 3 ? `translateX(-${currentIndex * (100 / 3 + 2)}%)` : undefined,
              }}
            >
              {vlogs.map((vlog) => (
                <div
                  key={vlog.id}
                  className={`flex-shrink-0 ${vlogs.length <= 3 ? 'w-full sm:w-1/2 lg:w-1/3' : ''}`}
                  style={vlogs.length > 3 ? { minWidth: 'calc(33.333% - 16px)', width: '33.333%' } : {}}
                >
                  <VlogCard vlog={vlog} formatDate={formatDate} />
                </div>
              ))}
            </div>
          </div>

          {/* Pagination Dots */}
          {vlogs.length > 3 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: Math.max(1, vlogs.length - 2) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setCurrentIndex(i);
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex ? 'bg-red-600' : 'bg-gray-300 hover:bg-gray-400'
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
            to="/blog?type=Vlog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            View All Vlogs
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function VlogCard({ vlog, formatDate }) {
  // Get thumbnail: use featured image, or YouTube thumbnail, or gradient placeholder
  const getThumbnail = () => {
    if (vlog.featuredImageUrl) {
      return getSharedAssetUrl(vlog.featuredImageUrl);
    }
    
    // YouTube thumbnail
    const youtubeId = getYouTubeId(vlog.videoUrl);
    if (youtubeId) {
      return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
    }
    
    return null;
  };

  const thumbnail = getThumbnail();

  return (
    <Link
      to={`/blog?post=${vlog.slug || vlog.id}`}
      className="block bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group"
    >
      {/* Thumbnail */}
      <div className="relative h-48 bg-gradient-to-br from-red-500 to-pink-600 overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={vlog.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Video className="w-16 h-16 text-white/30" />
          </div>
        )}
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-lg">
            <PlayCircle className="w-10 h-10 text-red-600 ml-1" />
          </div>
        </div>

        {/* Vlog Badge */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1">
          <Video className="w-3 h-3" />
          VLOG
        </div>

        {/* Duration placeholder - could be added later */}
        {/* <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded">
          5:32
        </div> */}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-red-600 transition-colors mb-2">
          {vlog.title}
        </h3>

        {vlog.excerpt && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {vlog.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            {vlog.authorProfileImageUrl ? (
              <img
                src={getSharedAssetUrl(vlog.authorProfileImageUrl)}
                alt={vlog.authorName}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="w-3 h-3 text-gray-500" />
              </div>
            )}
            <span className="truncate max-w-[100px]">{vlog.authorName}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {vlog.viewCount || 0}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDate(vlog.publishedAt || vlog.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
