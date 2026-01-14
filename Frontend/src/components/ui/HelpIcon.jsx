import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Loader2 } from 'lucide-react';
import { helpApi } from '../../services/api';

// Cache for help topics to avoid repeated API calls
const helpCache = new Map();

/**
 * HelpIcon - A reusable contextual help component
 *
 * Usage:
 * <HelpIcon topicCode="division.gamesPerMatch" />
 * <HelpIcon topicCode="event.paymentModel" className="ml-1" />
 *
 * The topicCode corresponds to a HelpTopic in the database.
 * Content is cached after first fetch.
 */
export default function HelpIcon({ topicCode, className = '', size = 'sm' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState(null);
  const [error, setError] = useState(null);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  // Size variants
  const sizeClasses = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const iconSize = sizeClasses[size] || sizeClasses.sm;

  // Fetch help topic when opened
  const fetchTopic = async () => {
    // Check cache first
    if (helpCache.has(topicCode)) {
      setTopic(helpCache.get(topicCode));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await helpApi.getByCode(topicCode);
      if (response.success && response.data) {
        helpCache.set(topicCode, response.data);
        setTopic(response.data);
      } else {
        setError('Help content not available');
      }
    } catch (err) {
      console.error('Error fetching help topic:', err);
      setError('Failed to load help content');
    } finally {
      setLoading(false);
    }
  };

  // Handle click
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen) {
      fetchTopic();
    }
    setIsOpen(!isOpen);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // Simple markdown rendering (bold, italic, lists, line breaks)
  const renderContent = (content) => {
    if (!content) return null;

    // Split by double newlines for paragraphs
    const paragraphs = content.split(/\n\n+/);

    return paragraphs.map((para, pIndex) => {
      // Check if it's a list (starts with - or *)
      const lines = para.split('\n');
      const isList = lines.every(line => line.trim().match(/^[-*]\s/) || line.trim() === '');

      if (isList) {
        return (
          <ul key={pIndex} className="list-disc list-inside space-y-1 my-2">
            {lines.filter(line => line.trim()).map((line, lIndex) => {
              const text = line.replace(/^[-*]\s*/, '');
              return (
                <li key={lIndex} className="text-sm">
                  {renderInlineMarkdown(text)}
                </li>
              );
            })}
          </ul>
        );
      }

      // Regular paragraph
      return (
        <p key={pIndex} className="text-sm mb-2 last:mb-0">
          {lines.map((line, lIndex) => (
            <span key={lIndex}>
              {renderInlineMarkdown(line)}
              {lIndex < lines.length - 1 && <br />}
            </span>
          ))}
        </p>
      );
    });
  };

  // Render inline markdown (bold, italic)
  const renderInlineMarkdown = (text) => {
    // Replace **bold** and *italic*
    const parts = [];
    let remaining = text;
    let key = 0;

    while (remaining) {
      // Match bold first
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Match italic
      const italicMatch = remaining.match(/\*([^*]+)\*/);

      if (boldMatch && (!italicMatch || boldMatch.index <= italicMatch.index)) {
        if (boldMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      } else if (italicMatch) {
        if (italicMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, italicMatch.index)}</span>);
        }
        parts.push(<em key={key++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
    }

    return parts;
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        className="text-gray-400 hover:text-blue-500 focus:outline-none focus:text-blue-500 transition-colors"
        aria-label="Help"
        title="Click for help"
      >
        <HelpCircle className={iconSize} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute z-[9999] bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 max-w-[calc(100vw-2rem)]"
          role="tooltip"
        >
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
              <span className="text-sm font-medium text-gray-700">
                {loading ? 'Loading...' : (topic?.title || 'Help')}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-3 py-2 max-h-64 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}

              {error && !loading && (
                <p className="text-sm text-gray-500 italic">{error}</p>
              )}

              {topic && !loading && (
                <div className="text-gray-600">
                  {renderContent(topic.content)}
                </div>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }} />
        </div>
      )}
    </div>
  );
}

/**
 * Utility function to prefetch help topics
 * Call this to preload help content for better UX
 */
export async function prefetchHelpTopics(topicCodes) {
  const uncached = topicCodes.filter(code => !helpCache.has(code));
  if (uncached.length === 0) return;

  try {
    const response = await helpApi.getBatch(uncached);
    if (response.success && response.data) {
      response.data.forEach(topic => {
        helpCache.set(topic.topicCode, topic);
      });
    }
  } catch (err) {
    console.error('Error prefetching help topics:', err);
  }
}

/**
 * Clear help cache (useful when admin updates help content)
 */
export function clearHelpCache() {
  helpCache.clear();
}
