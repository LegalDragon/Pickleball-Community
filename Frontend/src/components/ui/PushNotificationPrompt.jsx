import { useState, useEffect } from 'react';
import { Bell, X, Check, AlertCircle, Smartphone } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const PROMPT_STORAGE_KEY = 'push_notification_prompt_dismissed';
const PROMPT_DISMISSED_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Push Notification Prompt - shown after login to encourage users to enable notifications
 *
 * @param {boolean} isOpen - Whether the prompt should be shown
 * @param {function} onClose - Callback when prompt is closed
 * @param {function} onComplete - Callback when user completes the prompt (enabled or dismissed)
 */
export default function PushNotificationPrompt({ isOpen, onClose, onComplete }) {
  const [step, setStep] = useState('intro'); // 'intro', 'requesting', 'success', 'denied', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const {
    isSupported,
    permission,
    isSubscribed,
    subscribe,
    loading
  } = usePushNotifications();

  // Check if we should skip showing the prompt
  useEffect(() => {
    if (isOpen) {
      // Already subscribed
      if (isSubscribed) {
        onComplete?.();
        return;
      }

      // Permission already denied
      if (permission === 'denied') {
        onComplete?.();
        return;
      }

      // Not supported
      if (!isSupported) {
        onComplete?.();
        return;
      }

      // Recently dismissed
      const dismissedAt = localStorage.getItem(PROMPT_STORAGE_KEY);
      if (dismissedAt) {
        const dismissedTime = parseInt(dismissedAt, 10);
        if (Date.now() - dismissedTime < PROMPT_DISMISSED_DURATION) {
          onComplete?.();
          return;
        }
      }
    }
  }, [isOpen, isSubscribed, permission, isSupported, onComplete]);

  const handleEnableNotifications = async () => {
    setStep('requesting');
    setErrorMessage('');

    try {
      await subscribe();
      setStep('success');

      // Auto-close after success
      setTimeout(() => {
        onComplete?.();
      }, 2000);
    } catch (err) {
      if (err.message.includes('denied')) {
        setStep('denied');
      } else {
        setStep('error');
        setErrorMessage(err.message);
      }
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(PROMPT_STORAGE_KEY, Date.now().toString());
    onClose?.();
    onComplete?.();
  };

  const handleRemindLater = () => {
    // Don't set dismissed flag, just close
    onClose?.();
    onComplete?.();
  };

  // Don't render if not open or shouldn't show
  if (!isOpen) return null;
  if (!isSupported || isSubscribed || permission === 'denied') return null;

  // Check if recently dismissed
  const dismissedAt = localStorage.getItem(PROMPT_STORAGE_KEY);
  if (dismissedAt) {
    const dismissedTime = parseInt(dismissedAt, 10);
    if (Date.now() - dismissedTime < PROMPT_DISMISSED_DURATION) {
      return null;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={handleRemindLater}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Stay Connected</h2>
                <p className="text-white/80 text-sm">Enable push notifications</p>
              </div>
            </div>
            <button
              onClick={handleRemindLater}
              className="p-2 hover:bg-white/20 rounded-full transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'intro' && (
            <>
              <div className="space-y-4 mb-6">
                <p className="text-gray-700">
                  Get important updates delivered directly to your device:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Event Updates</span>
                      <p className="text-sm text-gray-600">Know when events are starting, changed, or cancelled</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Club Announcements</span>
                      <p className="text-sm text-gray-600">Stay informed about club news and activities</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Game Invites</span>
                      <p className="text-sm text-gray-600">Never miss a game invitation from friends</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleEnableNotifications}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Bell className="w-5 h-5" />
                  Enable Notifications
                </button>
                <button
                  onClick={handleDismiss}
                  className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Not now, remind me later
                </button>
              </div>
            </>
          )}

          {step === 'requesting' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Smartphone className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Allow Notifications
              </h3>
              <p className="text-gray-600">
                Please click "Allow" in the browser popup to enable notifications.
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                You're All Set!
              </h3>
              <p className="text-gray-600">
                You'll now receive important updates directly on your device.
              </p>
            </div>
          )}

          {step === 'denied' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Notifications Blocked
              </h3>
              <p className="text-gray-600 mb-4">
                You've blocked notifications for this site. You can enable them later in your browser settings.
              </p>
              <button
                onClick={handleDismiss}
                className="py-2 px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
              >
                Got it
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Something Went Wrong
              </h3>
              <p className="text-gray-600 mb-2">
                We couldn't enable notifications at this time.
              </p>
              {errorMessage && (
                <p className="text-sm text-red-600 mb-4">{errorMessage}</p>
              )}
              <div className="space-y-2">
                <button
                  onClick={() => setStep('intro')}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Try Again
                </button>
                <button
                  onClick={handleDismiss}
                  className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        {step === 'intro' && (
          <div className="px-6 pb-4">
            <p className="text-xs text-gray-400 text-center">
              You can change notification preferences anytime in Settings
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Check if push notification prompt should be shown
 * Useful for checking before navigating
 */
export function shouldShowPushPrompt() {
  // Check localStorage for dismissed state
  const dismissedAt = localStorage.getItem(PROMPT_STORAGE_KEY);
  if (dismissedAt) {
    const dismissedTime = parseInt(dismissedAt, 10);
    if (Date.now() - dismissedTime < PROMPT_DISMISSED_DURATION) {
      return false;
    }
  }

  // Check browser support
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  // Check if already denied
  if (Notification.permission === 'denied') {
    return false;
  }

  // Check if already granted (and likely subscribed)
  if (Notification.permission === 'granted') {
    return false;
  }

  return true;
}
