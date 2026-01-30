import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { LanguageProvider } from './contexts/LanguageContext'
import Navigation from './components/ui/Navigation' // Import here
import PWAInstallPrompt from './components/ui/PWAInstallPrompt'
import UpdateNotification from './components/ui/UpdateNotification'
import RunningEventPopup from './components/RunningEventPopup'
import ReleaseAnnouncementModal from './components/ReleaseAnnouncementModal'

import Footer from './components/landing/Footer'; // Make sure this is imported
import App from './App'
import './i18n' // Initialize i18n
import './styles/globals.css'
import 'leaflet/dist/leaflet.css'

// Register service worker for PWA with update detection
// Only in production - dev mode uses VitePWA's dev-sw.js automatically
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const SW_VERSION = import.meta.env.VITE_BUILD_TIME || Date.now()
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${SW_VERSION}`)
      .then(registration => {
        console.log('Service worker registered:', registration)

        // If there's already a waiting worker, notify the user
        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent('swUpdateAvailable', {
            detail: { registration }
          }));
        }

        // Listen for new service worker installing
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              // When the new worker is installed and waiting
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New version available, waiting to activate');
                window.dispatchEvent(new CustomEvent('swUpdateAvailable', {
                  detail: { registration }
                }));
              }
            });
          }
        });

        // Check for updates more frequently during active development (every 5 minutes)
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      })
      .catch(error => {
        console.error('Service worker registration error:', error)
      })
  });

  // Listen for skip waiting message from UpdateNotification
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
      // The service worker will handle this
    }
  });

  // When a new service worker takes over, reload the page
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

const queryClient = new QueryClient()

// Wrapper to provide auth state to ReleaseAnnouncementModal
import { useAuth } from './contexts/AuthContext'
function AuthenticatedReleaseModal() {
  const { isAuthenticated } = useAuth()
  return <ReleaseAnnouncementModal isAuthenticated={isAuthenticated} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <LanguageProvider>
              <AuthProvider>
                <ToastProvider>
                  <Navigation /> {/* Navigation now inside AuthProvider */}
                  <App /> {/* App doesn't need to have Navigation */}
                  <Footer /> {/* Footer added here */}
                  <UpdateNotification />
                  <PWAInstallPrompt />
                  <RunningEventPopup />
                  <AuthenticatedReleaseModal />
                </ToastProvider>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Suspense>
  </React.StrictMode>
);