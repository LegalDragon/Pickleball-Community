import { useState, useEffect } from 'react';
import { RefreshCw, X, Download } from 'lucide-react';

/**
 * UpdateNotification - Shows a banner when a new app version is available
 * Listens for service worker update events and prompts users to refresh
 */
export default function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    // Listen for the custom event dispatched from main.jsx
    const handleUpdateAvailable = (event) => {
      console.log('Update available event received');
      setUpdateAvailable(true);
      if (event.detail?.registration) {
        setRegistration(event.detail.registration);
      }
    };

    window.addEventListener('swUpdateAvailable', handleUpdateAvailable);

    // Also check if there's already a waiting service worker on load
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        if (reg.waiting) {
          setUpdateAvailable(true);
          setRegistration(reg);
        }
      });
    }

    return () => {
      window.removeEventListener('swUpdateAvailable', handleUpdateAvailable);
    };
  }, []);

  const handleRefresh = () => {
    if (registration?.waiting) {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // Reload the page to get the new version
    window.location.reload();
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
    // Store dismissal time - will show again after 1 hour
    localStorage.setItem('updateDismissedAt', Date.now().toString());
  };

  // Check if recently dismissed
  useEffect(() => {
    const dismissedAt = localStorage.getItem('updateDismissedAt');
    if (dismissedAt) {
      const hourAgo = Date.now() - (60 * 60 * 1000);
      if (parseInt(dismissedAt) > hourAgo) {
        setUpdateAvailable(false);
      } else {
        localStorage.removeItem('updateDismissedAt');
      }
    }
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium">New version available!</p>
              <p className="text-sm text-blue-100">Refresh to get the latest features and fixes.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Now
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Dismiss for now"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
