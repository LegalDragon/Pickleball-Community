import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if user dismissed prompt recently (within 7 days)
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(parseInt(dismissed));
      const daysSince = (Date.now() - dismissedDate) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    // Listen for beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // For iOS, show custom instructions after a delay
    if (iOS && !standalone) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed or shouldn't show
  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50 animate-slide-up">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-blue-600" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm">
            Install Pickleball Community
          </h3>

          {isIOS ? (
            <p className="text-xs text-gray-600 mt-1">
              Tap <span className="inline-flex items-center"><svg className="w-4 h-4 inline text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span> then <strong>"Add to Home Screen"</strong> for the best experience.
            </p>
          ) : (
            <p className="text-xs text-gray-600 mt-1">
              Add to your home screen for quick access and a better experience.
            </p>
          )}

          {!isIOS && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Install App
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
