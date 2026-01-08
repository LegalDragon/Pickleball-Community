import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import Navigation from './components/ui/Navigation' // Import here
import PWAInstallPrompt from './components/ui/PWAInstallPrompt'

import Footer from './components/landing/Footer'; // Make sure this is imported
import App from './App'
import './styles/globals.css'
import 'leaflet/dist/leaflet.css'

// Register service worker for PWA with cache-busting version
// The version is set at build time to force browsers to fetch fresh sw.js
const SW_VERSION = import.meta.env.VITE_BUILD_TIME || Date.now()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${SW_VERSION}`)
      .then(registration => {
        console.log('Service worker registered:', registration)

        // Check for updates periodically
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000) // Check every hour
      })
      .catch(error => {
        console.error('Service worker registration error:', error)
      })
  })
}

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <Navigation /> {/* Navigation now inside AuthProvider */}
              <App /> {/* App doesn't need to have Navigation */}
              <Footer /> {/* Footer added here */}
              <PWAInstallPrompt />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);