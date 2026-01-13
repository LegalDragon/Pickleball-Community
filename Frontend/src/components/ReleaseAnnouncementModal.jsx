import { useState, useEffect } from 'react';
import { releaseNotesApi } from '../services/api';
import { X, Megaphone, Star, ChevronLeft, ChevronRight, Check, Bell, BellOff, FlaskConical } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function ReleaseAnnouncementModal({ isAuthenticated }) {
  const [releases, setReleases] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      checkForUnreadReleases();
    }
  }, [isAuthenticated]);

  const checkForUnreadReleases = async () => {
    try {
      const response = await releaseNotesApi.getUnread();
      if (response.success && response.data?.length > 0) {
        setReleases(response.data);
        setCurrentIndex(0);
        setIsOpen(true);
      }
    } catch (err) {
      console.error('Error checking for releases:', err);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleDismissCurrent = async () => {
    if (releases.length === 0) return;

    setDismissing(true);
    try {
      const currentRelease = releases[currentIndex];
      await releaseNotesApi.dismiss(currentRelease.id);

      // Remove from list
      const remaining = releases.filter((_, i) => i !== currentIndex);
      if (remaining.length === 0) {
        setIsOpen(false);
      } else {
        setReleases(remaining);
        setCurrentIndex(Math.min(currentIndex, remaining.length - 1));
      }
    } catch (err) {
      console.error('Error dismissing release:', err);
    } finally {
      setDismissing(false);
    }
  };

  const handleDismissAll = async () => {
    setDismissing(true);
    try {
      await releaseNotesApi.dismissAll();
      setIsOpen(false);
    } catch (err) {
      console.error('Error dismissing all releases:', err);
    } finally {
      setDismissing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!isOpen || releases.length === 0) return null;

  const currentRelease = releases[currentIndex];
  const hasMultiple = releases.length > 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">What's New</h2>
                {hasMultiple && (
                  <p className="text-sm text-blue-100">
                    {currentIndex + 1} of {releases.length} updates
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-200px)]">
          {/* Version & Date */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
              v{currentRelease.version}
              {currentRelease.isMajor && <Star className="w-3 h-3 fill-blue-500" />}
            </span>
            {currentRelease.isTest && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                <FlaskConical className="w-3 h-3" />
                Test Preview
              </span>
            )}
            <span className="text-sm text-gray-500">
              {formatDate(currentRelease.releaseDate)}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {currentRelease.title}
          </h3>

          {/* Content (Markdown) */}
          <div className="prose prose-sm max-w-none text-gray-600">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mt-6 mb-3">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-800 mt-5 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">{children}</h3>,
                p: ({ children }) => <p className="mb-3 text-gray-600">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-gray-600">{children}</li>,
                code: ({ inline, children }) =>
                  inline ? (
                    <code className="px-1 py-0.5 bg-gray-100 rounded text-sm font-mono text-gray-800">{children}</code>
                  ) : (
                    <code className="block p-3 bg-gray-100 rounded-lg text-sm font-mono overflow-x-auto">{children}</code>
                  ),
                strong: ({ children }) => <strong className="font-semibold text-gray-800">{children}</strong>,
                a: ({ href, children }) => (
                  <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                )
              }}
            >
              {currentRelease.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Navigation for multiple releases */}
            {hasMultiple && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex gap-1">
                  {releases.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={`w-2 h-2 rounded-full transition ${
                        i === currentIndex ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setCurrentIndex(i => Math.min(releases.length - 1, i + 1))}
                  disabled={currentIndex === releases.length - 1}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {!hasMultiple && <div />}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleDismissCurrent}
                disabled={dismissing}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                title="Don't show this release again"
              >
                <BellOff className="w-4 h-4" />
                <span className="text-sm">Don't show again</span>
              </button>

              {hasMultiple ? (
                <button
                  onClick={handleDismissAll}
                  disabled={dismissing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Mark all as read</span>
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Got it!</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
