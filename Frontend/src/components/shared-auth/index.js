/**
 * Funtime Shared Auth Components
 *
 * Shared authentication UI components for consistent login/register/password recovery
 * across all Funtime sites (pickleball.college, pickleball.date, etc.)
 *
 * Usage:
 *
 * 1. Copy this folder to your React project's components directory
 * 2. Import the components you need:
 *
 *    import { SharedAuthModal, SharedLogin, SharedRegister } from './shared-auth'
 *
 * 3. Use the SharedAuthModal for a complete auth experience:
 *
 *    <SharedAuthModal
 *      isOpen={showAuthModal}
 *      onClose={() => setShowAuthModal(false)}
 *      authApiUrl="https://auth.funtime.com"
 *      onAuthSuccess={({ token, user }) => {
 *        // Store token, update user state, etc.
 *      }}
 *      onSyncUser={async (token) => {
 *        // Sync user to local database
 *        const response = await api.post('/auth/sync', { token })
 *        return response.user
 *      }}
 *      siteName="Pickleball College"
 *      showRoleSelection={true}
 *      roles={[
 *        { value: 'Student', label: 'Student', description: 'Learn pickleball' },
 *        { value: 'Coach', label: 'Coach', description: 'Teach pickleball' }
 *      ]}
 *    />
 *
 * 4. Or use individual components for custom layouts:
 *
 *    <SharedLogin
 *      authApiUrl="https://auth.funtime.com"
 *      onSuccess={handleSuccess}
 *      onSwitchToRegister={() => navigate('/register')}
 *      onForgotPassword={() => navigate('/forgot-password')}
 *      siteName="Pickleball College"
 *    />
 *
 * Dependencies:
 * - React 18+
 * - lucide-react (for icons)
 * - Tailwind CSS (for styling)
 */

export { default as SharedLogin } from './SharedLogin'
export { default as SharedRegister } from './SharedRegister'
export { default as SharedForgotPassword } from './SharedForgotPassword'
export { default as SharedAuthModal } from './SharedAuthModal'
export { default as SiteLogoOverlay, SiteLogoPreview } from './SiteLogoOverlay'
