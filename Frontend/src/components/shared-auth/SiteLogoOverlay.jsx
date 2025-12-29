import { useState } from 'react'

/**
 * Site Logo Overlay Component
 * Displays main logo with optional site logo overlay at bottom-right
 *
 * @param {Object} props
 * @param {string|null} props.mainLogoUrl - URL for the main/shared logo
 * @param {string|null} props.siteLogoUrl - URL for the site-specific logo overlay
 * @param {string} props.siteName - Site name for alt text
 * @param {'sm'|'md'|'lg'|'xl'} props.size - Size variant
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showFallback - Whether to show fallback when no logos
 */

const sizeClasses = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
  xl: 'h-20',
}

const overlayScales = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
  xl: 'h-10 w-10',
}

const SiteLogoOverlay = ({
  mainLogoUrl,
  siteLogoUrl,
  siteName = 'Site',
  size = 'md',
  className = '',
  showFallback = true,
}) => {
  const [mainLogoError, setMainLogoError] = useState(false)
  const [siteLogoError, setSiteLogoError] = useState(false)

  const hasMainLogo = mainLogoUrl && !mainLogoError
  const hasSiteLogo = siteLogoUrl && !siteLogoError

  // If no main logo and no site logo, show default
  if (!hasMainLogo && !hasSiteLogo && showFallback) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`${sizeClasses[size]} aspect-square bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center`}>
          <span className="text-white font-bold text-sm">F</span>
        </div>
        <span className="text-lg font-semibold text-gray-900">Funtime</span>
      </div>
    )
  }

  // If only site logo (no main logo), show site logo alone
  if (!hasMainLogo && hasSiteLogo) {
    return (
      <div className={`${className}`}>
        <img
          src={siteLogoUrl}
          alt={siteName}
          className={`${sizeClasses[size]} w-auto max-w-[180px] object-contain`}
          onError={() => setSiteLogoError(true)}
        />
      </div>
    )
  }

  // Main logo with optional site logo overlay
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Main Logo */}
      <img
        src={mainLogoUrl}
        alt="Main Logo"
        className={`${sizeClasses[size]} w-auto max-w-[180px] object-contain`}
        onError={() => setMainLogoError(true)}
      />

      {/* Site Logo Overlay - positioned at bottom-right, 50% size */}
      {hasSiteLogo && (
        <div
          className={`absolute -bottom-1 -right-1 ${overlayScales[size]} flex items-center justify-center`}
        >
          <img
            src={siteLogoUrl}
            alt={siteName}
            className="w-full h-full object-contain"
            onError={() => setSiteLogoError(true)}
          />
        </div>
      )}
    </div>
  )
}

// Preview component for showing the overlay effect
export const SiteLogoPreview = ({ mainLogoUrl, siteLogoUrl, siteName }) => {
  return (
    <div className="bg-gray-100 rounded-lg p-3 flex items-center justify-center min-h-[60px]">
      <SiteLogoOverlay
        mainLogoUrl={mainLogoUrl}
        siteLogoUrl={siteLogoUrl}
        siteName={siteName}
        size="lg"
        showFallback={true}
      />
    </div>
  )
}

export default SiteLogoOverlay
