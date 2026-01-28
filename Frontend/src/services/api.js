import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const SHARED_AUTH_URL = import.meta.env.VITE_SHARED_AUTH_URL || 'https://shared.funtimepb.com/api'
const SHARED_AUTH_UI_URL = import.meta.env.VITE_SHARED_AUTH_UI_URL || ''

// Helper function to get full asset URL from local API (for local assets)
export const getAssetUrl = (path) => {
  if (!path) return null
  // If path is already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const baseUrl = API_BASE_URL

  // Keep the full path including /api if present
  if (path.startsWith('/')) {
    return `${baseUrl}${path}`
  }
  // For relative paths without leading slash, prepend base URL with /
  return `${baseUrl}/${path}`
}

// Helper function to get asset URL from Funtime-Shared (for user avatars, profile images)
// Routes through local proxy endpoint to add authentication headers
export const getSharedAssetUrl = (path) => {
  if (!path) return null
  // If path is already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  // For Funtime-Shared asset paths like /asset/123, use local proxy
  // This allows the backend to add API key authentication
  const assetMatch = path.match(/^\/asset\/(\d+)/)
  if (assetMatch) {
    const assetId = assetMatch[1]
    // In dev mode, API_BASE_URL is full URL (https://localhost:7009) - need absolute URL
    // In production, API_BASE_URL is '/api' - need relative URL with /api prefix
    if (API_BASE_URL && API_BASE_URL.startsWith('http')) {
      // Development: direct to backend without /api prefix (no IIS virtual app)
      return `${API_BASE_URL}/assets/shared/${assetId}`
    }
    // Production: relative path with /api prefix (IIS virtual app adds /api)
    return `/api/assets/shared/${assetId}`
  }

  // For other paths, use direct Funtime-Shared URL (fallback)
  const baseUrl = SHARED_AUTH_URL

  // Keep the full path including /api if present
  if (path.startsWith('/')) {
    return `${baseUrl}${path}`
  }
  // For relative paths without leading slash, prepend base URL with /
  return `${baseUrl}/${path}`
}

// Export URLs for direct use if needed
export { API_BASE_URL, SHARED_AUTH_URL, SHARED_AUTH_UI_URL }

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwtToken') ;

  console.log('API Request:', config.method?.toUpperCase(), config.url);
  console.log('Using token:', token ? token.substring(0, 20) + '...' : 'No token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
}, (error) => {
  console.error('Request interceptor error:', error);
  return Promise.reject(error);
})

// Response interceptor for handling auth errors
api.interceptors.response.use(
  (response) => {
    console.log('API Response Success:', response.config.url, response.status);
    return response.data;
  },
  (error) => {
    console.error('API Response Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers
    });

    if (error.response?.status === 401) {
      console.log('401 Unauthorized - Details:');

      // Log token info for debugging
      const token = localStorage.getItem('jwtToken');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('Token payload:', {
            iss: payload.iss,
            aud: payload.aud,
            sub: payload.sub,
            exp: payload.exp,
            expDate: new Date(payload.exp * 1000).toISOString()
          });
        } catch (e) {
          console.log('Could not decode token:', e.message);
        }
      } else {
        console.log('No token in localStorage');
      }

      // Log the WWW-Authenticate header which contains the validation error
      const wwwAuth = error.response?.headers?.['www-authenticate'];
      if (wwwAuth) {
        console.log('WWW-Authenticate header:', wwwAuth);
      }

      // Don't clear auth on most 401s - the token may be valid for shared auth
      // but local backend may have different JWT key
      // Only clear auth for explicit login failures
      const requestUrl = error.config?.url || '';
      const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

      if (!isAuthEndpoint) {
        console.log('401 from non-auth endpoint - keeping auth data (JWT key mismatch between local and shared auth?)');
        return Promise.reject(error.response?.data || error.message);
      }

      console.log('Clearing auth data due to auth endpoint failure...');
      localStorage.removeItem('jwtToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('pickleball_user');
      localStorage.removeItem('refreshToken');

      // Redirect to local login page (which uses shared auth components)
      if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error.response?.data || error.message);
  }
)

// Shared auth axios instance (for centralized authentication)
const sharedAuthApi = axios.create({
  baseURL: SHARED_AUTH_URL,
  withCredentials: false
})

// Add auth token to shared auth API requests
// Use sharedAuthToken (original token from shared auth) if available,
// otherwise fall back to jwtToken (which may be local token after sync)
sharedAuthApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('sharedAuthToken') || localStorage.getItem('jwtToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for shared auth API - extract data like main api
sharedAuthApi.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error.response?.data || error.message)
);

// Shared User API (for Funtime-Shared user profile operations)
// Note: SHARED_AUTH_URL already includes /api, so endpoints should NOT have /api prefix
export const sharedUserApi = {
  // Upload avatar to shared auth service (uses shared asset API)
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams({
      assetType: 'image',
      category: 'avatar',
      siteKey: 'community',
      isPublic: 'true'
    });
    return sharedAuthApi.post(`/asset/upload?${params.toString()}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Get user profile from shared auth
  getProfile: () => sharedAuthApi.get('/users/me'),

  // Update user profile on shared auth
  updateProfile: (data) => sharedAuthApi.put('/users/me', data),
}

// Shared Admin API (for Funtime-Shared admin operations - requires SU role)
export const sharedAdminApi = {
  // Update user credentials (email, password, etc.) - requires SU role on shared auth
  updateUser: (userId, data) => sharedAuthApi.put(`/admin/users/${userId}`, data),
}

// Shared Asset API (for Funtime-Shared centralized asset management)
// Use this for all asset uploads across pickleball.* sites
const SITE_KEY = 'community' // Site identifier for multi-tenant asset storage

export const sharedAssetApi = {
  /**
   * Upload a file to Funtime-Shared via local backend proxy (recommended)
   * Uses server-to-server API key authentication - more reliable than direct upload
   * @param {File} file - The file to upload
   * @param {string} assetType - Type: 'image', 'video', 'document', 'audio'
   * @param {string} category - Category for organization: 'avatar', 'theme', 'club', 'court', 'video', etc.
   * @returns {Promise} - Response with asset URL { success, url, assetId }
   */
  uploadViaProxy: async (file, assetType = 'image', category = 'general') => {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams({ assetType, category });
    return api.post(`/assets/shared/upload?${params.toString()}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  /**
   * Upload a file to Funtime-Shared asset service (direct, requires shared auth token)
   * @param {File} file - The file to upload
   * @param {string} assetType - Type: 'image', 'video', 'document', 'audio'
   * @param {string} category - Category for organization: 'avatar', 'theme', 'club', 'court', 'video', etc.
   * @param {boolean} isPublic - Whether the asset is publicly accessible (default: true)
   * @returns {Promise} - Response with asset ID and URL
   * @deprecated Use uploadViaProxy for more reliable uploads
   */
  upload: async (file, assetType = 'image', category = 'general', isPublic = true) => {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams({
      assetType,
      category,
      siteKey: SITE_KEY,
      isPublic: isPublic.toString()
    });
    return sharedAuthApi.post(`/asset/upload?${params.toString()}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  /**
   * Register an external URL as an asset (e.g., YouTube video)
   * @param {string} url - External URL
   * @param {string} title - Display title
   * @param {string} assetType - Type: 'video', 'link', etc.
   * @param {string} category - Category for organization
   * @param {string} thumbnailUrl - Optional thumbnail URL
   * @returns {Promise} - Response with asset ID
   */
  registerLink: async (url, title, assetType = 'video', category = 'video', thumbnailUrl = null) => {
    return sharedAuthApi.post('/asset/link', {
      url,
      title,
      assetType,
      category,
      siteKey: SITE_KEY,
      thumbnailUrl,
      isPublic: true
    });
  },

  /**
   * Get asset info by ID
   * @param {number} assetId - Asset ID
   * @returns {Promise} - Asset metadata
   */
  getInfo: (assetId) => sharedAuthApi.get(`/asset/${assetId}/info`),

  /**
   * Get asset URL for display (uses local proxy to add authentication)
   * @param {number} assetId - Asset ID
   * @returns {string} - Full URL to access the asset via local proxy
   */
  getUrl: (assetId) => `/api/assets/shared/${assetId}`,

  /**
   * Delete an asset by ID
   * @param {number} assetId - Asset ID
   * @returns {Promise}
   */
  delete: (assetId) => sharedAuthApi.delete(`/asset/${assetId}`),

  /**
   * Helper to determine asset type from file
   * @param {File} file - The file to check
   * @returns {string} - Asset type
   */
  getAssetType: (file) => {
    const mimeType = file.type.toLowerCase();
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }
}

export const authApi = {
  // Get auth configuration (shared auth URL and site code)
  getConfig: () => api.get('/auth/config'),

  // Legacy local login (fallback if shared auth not configured)
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  // Legacy local register (fallback if shared auth not configured)
  register: (userData) =>
    api.post('/auth/register', userData),

  // Shared auth login - calls shared auth service directly
  sharedLogin: async (email, password) => {
    const authUrl = SHARED_AUTH_URL || (await api.get('/auth/config')).SharedAuthUrl
    if (!authUrl) {
      throw new Error('Shared auth URL not configured')
    }
    return axios.post(`${authUrl}/auth/login`, { email, password })
  },

  // Shared auth register - calls shared auth service directly
  sharedRegister: async (userData) => {
    const authUrl = SHARED_AUTH_URL || (await api.get('/auth/config')).SharedAuthUrl
    if (!authUrl) {
      throw new Error('Shared auth URL not configured')
    }
    return axios.post(`${authUrl}/auth/register`, userData)
  },

  // Shared auth OTP flow
  sendOtp: async (phone) => {
    const authUrl = SHARED_AUTH_URL || (await api.get('/auth/config')).SharedAuthUrl
    if (!authUrl) {
      throw new Error('Shared auth URL not configured')
    }
    return axios.post(`${authUrl}/auth/otp/send`, { phone })
  },

  verifyOtp: async (phone, code) => {
    const authUrl = SHARED_AUTH_URL || (await api.get('/auth/config')).SharedAuthUrl
    if (!authUrl) {
      throw new Error('Shared auth URL not configured')
    }
    return axios.post(`${authUrl}/auth/otp/verify`, { phone, code })
  },

  // Sync user from shared auth to local database
  // role: optional site-specific role from shared auth (e.g., 'Admin', 'Student')
  syncFromSharedAuth: (token, role) =>
    api.post('/auth/sync', { token, role }),

  fastlogin: async (token) => {
    try {
      console.log('Sending token to fastlogin API:', token.substring(0, 20) + '...');

      // Use the api instance, not raw axios
      const response = await api.post('/auth/fastlogin',
        JSON.stringify(token), // Send token as JSON string
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Fastlogin API response:', response);
      return response;
    } catch (error) {
      console.error('Fastlogin API error:', error);
      throw error;
    }
  },

  forgotPassword: (email) => {
    return api.post('/auth/forgot-password', { email })
  },

  resetPassword: (token, newPassword) => {
    return api.post('/auth/reset-password', { token, newPassword })
  },

  verifyResetToken: (token) => {
    return api.get(`/auth/verify-reset-token/${token}`)
  }

  // Note: Email/phone change is handled by SharedChangeCredential component
  // which calls shared auth endpoints directly via fetch
}

// Theme Management API
export const themeApi = {
  // Get active theme (public - no auth required)
  getActive: () => api.get('/theme/active'),

  // Get theme settings (admin only)
  getCurrent: () => api.get('/theme'),

  // Update theme settings (admin only)
  update: (data) => api.put('/theme', data),

  // Upload logo (admin only)
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/theme/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Upload favicon (admin only)
  uploadFavicon: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/theme/favicon', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Get theme presets (admin only)
  getPresets: () => api.get('/theme/presets'),

  // Reset theme to default (admin only)
  reset: () => api.post('/theme/reset'),

  // Upload hero video (admin only)
  uploadHeroVideo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/theme/hero-video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Delete hero video (admin only)
  deleteHeroVideo: () => api.delete('/theme/hero-video'),

  // Upload hero image (admin only)
  uploadHeroImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/theme/hero-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Delete hero image (admin only)
  deleteHeroImage: () => api.delete('/theme/hero-image'),

  // Hero Videos (multiple videos with activate/deactivate)
  getHeroVideos: () => api.get('/theme/hero-videos'),
  createHeroVideo: (data) => api.post('/theme/hero-videos', data),
  updateHeroVideo: (id, data) => api.put(`/theme/hero-videos/${id}`, data),
  deleteHeroVideo: (id) => api.delete(`/theme/hero-videos/${id}`),
  activateHeroVideo: (id) => api.put(`/theme/hero-videos/${id}/activate`),
  deactivateHeroVideo: (id) => api.put(`/theme/hero-videos/${id}/deactivate`),
  reorderHeroVideos: (videoIds) => api.put('/theme/hero-videos/reorder', { VideoIds: videoIds })
}

// User Profile API
export const userApi = {
  // Get current user's profile
  getProfile: () => api.get('/users/profile'),

  // Get public profile by user ID
  getPublicProfile: (userId) => api.get(`/users/${userId}/public`),

  // Update current user's profile
  updateProfile: (data) => api.put('/users/profile', data),

  // Upload avatar
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Delete avatar
  deleteAvatar: () => api.delete('/users/avatar'),

  // Get all users (admin only)
  getAllUsers: () => api.get('/users'),

  // Update user by ID (admin only)
  updateUser: (id, data) => api.put(`/users/${id}`, data),

  // Get recently joined players (public, for marquee)
  getRecentPlayers: (count = 20, days = 30) => api.get(`/users/recent?count=${count}&days=${days}`),

  // Social Links
  getSocialLinks: () => api.get('/users/social-links'),
  addSocialLink: (data) => api.post('/users/social-links', data),
  updateSocialLink: (id, data) => api.put(`/users/social-links/${id}`, data),
  deleteSocialLink: (id) => api.delete(`/users/social-links/${id}`),
  bulkUpdateSocialLinks: (links) => api.put('/users/social-links/bulk', { links }),
  getSocialPlatforms: () => api.get('/users/social-platforms'),

  // Admin: Send password reset email to a user
  adminSendPasswordReset: (userId) => api.post(`/users/${userId}/admin-password-reset`),

  // Admin: Update a user's email
  adminUpdateEmail: (userId, newEmail) => api.put(`/users/${userId}/admin-email`, { newEmail }),

  // Admin: Set a user's password directly
  adminSetPassword: (userId, newPassword) => api.put(`/users/${userId}/admin-password`, { newPassword }),

  // Admin: Send a test email to a user
  adminSendTestEmail: (userId, subject = null, body = null) => api.post(`/users/${userId}/admin-test-email`, { subject, body }),

  // Admin: Send a test SMS to a user
  adminSendTestSms: (userId, message = null) => api.post(`/users/${userId}/admin-test-sms`, { message }),

  // Admin: Update a user's phone number
  adminUpdatePhone: (userId, newPhone) => api.put(`/users/${userId}/admin-phone`, { newPhone }),

  // Admin: Re-sync a user from Funtime-Shared service
  adminResyncUser: (userId) => api.post(`/users/${userId}/admin-resync`)
}

// Content Types API
export const contentTypesApi = {
  // Get all active content types
  getAll: () => api.get('/contenttypes'),

  // Get content type by code
  getByCode: (code) => api.get(`/contenttypes/${code}`)
}

// Asset Management API
export const assetApi = {
  // Upload a single file
  upload: (file, folder = 'image', objectType = null, objectId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams({ folder });
    if (objectType) params.append('objectType', objectType);
    if (objectId) params.append('objectId', objectId);
    return api.post(`/assets/upload?${params.toString()}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Upload multiple files
  uploadMultiple: (files, folder = 'image', objectType = null, objectId = null) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    const params = new URLSearchParams({ folder });
    if (objectType) params.append('objectType', objectType);
    if (objectId) params.append('objectId', objectId);
    return api.post(`/assets/upload-multiple?${params.toString()}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Delete a file by URL
  delete: (url) => api.delete(`/assets?url=${encodeURIComponent(url)}`),

  // Get allowed file types
  getAllowedTypes: () => api.get('/assets/allowed-types')
}

// Rating API
export const ratingApi = {
  // Create or update a rating
  rate: (ratableType, ratableId, stars, review = null) =>
    api.post('/ratings', { ratableType, ratableId, stars, review }),

  // Get current user's rating for an item
  getMyRating: (ratableType, ratableId) =>
    api.get(`/ratings/${ratableType}/${ratableId}/my-rating`),

  // Get all ratings for an item
  getRatings: (ratableType, ratableId) =>
    api.get(`/ratings/${ratableType}/${ratableId}`),

  // Get rating summary for an item
  getSummary: (ratableType, ratableId) =>
    api.get(`/ratings/${ratableType}/${ratableId}/summary`),

  // Get rating summaries for multiple items
  getSummaries: (ratableType, ratableIds) =>
    api.post(`/ratings/${ratableType}/summaries`, ratableIds),

  // Delete a rating
  deleteRating: (ratableType, ratableId) =>
    api.delete(`/ratings/${ratableType}/${ratableId}`)
}

// Tag API
export const tagApi = {
  // Get all tags for an object
  getTags: (objectType, objectId) =>
    api.get(`/tags/${objectType}/${objectId}`),

  // Add a tag to an object
  addTag: (objectType, objectId, tagName) =>
    api.post('/tags', { objectType, objectId, tagName }),

  // Remove a tag from an object
  removeTag: (objectType, objectId, tagId) =>
    api.delete(`/tags/${objectType}/${objectId}/${tagId}`),

  // Get common/suggested tags for an object type
  getCommonTags: (objectType, objectId, limit = 10) =>
    api.get(`/tags/${objectType}/${objectId}/common?limit=${limit}`),

  // Search tags by name
  searchTags: (query, limit = 10) =>
    api.get(`/tags/search?query=${encodeURIComponent(query)}&limit=${limit}`)
}

// Player Certification API
export const certificationApi = {
  // Knowledge Levels (Admin)
  getKnowledgeLevels: (activeOnly = true) =>
    api.get(`/playercertification/knowledge-levels?activeOnly=${activeOnly}`),
  createKnowledgeLevel: (data) =>
    api.post('/playercertification/knowledge-levels', data),
  updateKnowledgeLevel: (id, data) =>
    api.put(`/playercertification/knowledge-levels/${id}`, data),
  deleteKnowledgeLevel: (id) =>
    api.delete(`/playercertification/knowledge-levels/${id}`),

  // Skill Groups (Admin)
  getSkillGroups: (activeOnly = true) =>
    api.get(`/playercertification/skill-groups?activeOnly=${activeOnly}`),
  createSkillGroup: (data) =>
    api.post('/playercertification/skill-groups', data),
  updateSkillGroup: (id, data) =>
    api.put(`/playercertification/skill-groups/${id}`, data),
  deleteSkillGroup: (id) =>
    api.delete(`/playercertification/skill-groups/${id}`),

  // Skill Areas (Admin)
  getSkillAreas: (activeOnly = true) =>
    api.get(`/playercertification/skill-areas?activeOnly=${activeOnly}`),
  createSkillArea: (data) =>
    api.post('/playercertification/skill-areas', data),
  updateSkillArea: (id, data) =>
    api.put(`/playercertification/skill-areas/${id}`, data),
  deleteSkillArea: (id) =>
    api.delete(`/playercertification/skill-areas/${id}`),

  // Certification Requests (Student)
  createRequest: (data) =>
    api.post('/playercertification/requests', data),
  getMyRequests: () =>
    api.get('/playercertification/requests'),
  getRequest: (id) =>
    api.get(`/playercertification/requests/${id}`),
  getActiveRequest: () =>
    api.get('/playercertification/requests/active'),
  updateRequest: (id, data) =>
    api.put(`/playercertification/requests/${id}`, data),
  deactivateRequest: (id) =>
    api.post(`/playercertification/requests/${id}/deactivate`),

  // Invitations (Student)
  getInvitablePeers: (requestId) =>
    api.get(`/playercertification/requests/${requestId}/invitable-peers`),
  getInvitations: (requestId) =>
    api.get(`/playercertification/requests/${requestId}/invitations`),
  invitePeers: (requestId, userIds) =>
    api.post(`/playercertification/requests/${requestId}/invitations`, { userIds }),

  // Pending Reviews (where current user was invited to review others)
  getMyPendingReviews: () =>
    api.get('/playercertification/my-pending-reviews'),

  // Review Page (Public)
  getReviewPage: (token) =>
    api.get(`/playercertification/review/${token}`),
  submitReview: (token, data) =>
    api.post(`/playercertification/review/${token}`, data),

  // Certificate View (Student)
  getMyCertificate: () =>
    api.get('/playercertification/certificate')
}

// Notification Templates API (Admin)
export const notificationTemplateApi = {
  // Get all templates
  getTemplates: (activeOnly = false, category = null) => {
    const params = new URLSearchParams()
    if (activeOnly) params.append('activeOnly', 'true')
    if (category) params.append('category', category)
    return api.get(`/notificationtemplates?${params.toString()}`)
  },

  // Get templates grouped by category
  getTemplatesGrouped: (activeOnly = false) =>
    api.get(`/notificationtemplates/grouped?activeOnly=${activeOnly}`),

  // Get all categories
  getCategories: () =>
    api.get('/notificationtemplates/categories'),

  // Get a single template by ID
  getTemplate: (id) =>
    api.get(`/notificationtemplates/${id}`),

  // Get a template by key
  getTemplateByKey: (templateKey) =>
    api.get(`/notificationtemplates/key/${templateKey}`),

  // Create a new template
  createTemplate: (data) =>
    api.post('/notificationtemplates', data),

  // Update a template
  updateTemplate: (id, data) =>
    api.put(`/notificationtemplates/${id}`, data),

  // Delete a template
  deleteTemplate: (id) =>
    api.delete(`/notificationtemplates/${id}`),

  // Preview a template with sample data
  previewTemplate: (subject, body, sampleData) =>
    api.post('/notificationtemplates/preview', { subject, body, sampleData }),

  // Toggle template active status
  toggleActive: (id) =>
    api.post(`/notificationtemplates/${id}/toggle-active`),

  // Reset a system template to defaults
  resetTemplate: (id) =>
    api.post(`/notificationtemplates/${id}/reset`)
}

// Venues API (formerly Courts - places with pickleball courts)
export const venuesApi = {
  // List all venues (simple list for dropdowns)
  list: async () => {
    const response = await api.get('/venues/search?pageSize=500&sortBy=name');
    // Transform to normalize id field (venues use venueId)
    if (response.success && response.data?.items) {
      response.data = response.data.items.map(v => ({
        ...v,
        id: v.venueId || v.id
      }));
    }
    return response;
  },

  // Search venues with filters
  search: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.append('query', params.query);
    if (params.latitude) queryParams.append('latitude', params.latitude);
    if (params.longitude) queryParams.append('longitude', params.longitude);
    if (params.radiusMiles) queryParams.append('radiusMiles', params.radiusMiles);
    if (params.country) queryParams.append('country', params.country);
    if (params.state) queryParams.append('state', params.state);
    if (params.city) queryParams.append('city', params.city);
    if (params.venueTypeId) queryParams.append('venueTypeId', params.venueTypeId);
    if (params.hasLights !== undefined) queryParams.append('hasLights', params.hasLights);
    if (params.isIndoor !== undefined) queryParams.append('isIndoor', params.isIndoor);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    return api.get(`/venues/search?${queryParams.toString()}`);
  },

  // Get venue details
  getVenue: (id, userLat, userLng) => {
    const params = new URLSearchParams();
    if (userLat) params.append('userLat', userLat);
    if (userLng) params.append('userLng', userLng);
    return api.get(`/venues/${id}?${params.toString()}`);
  },

  // Alias for getVenue (courts are venues)
  getCourt: (id, userLat, userLng) => {
    const params = new URLSearchParams();
    if (userLat) params.append('userLat', userLat);
    if (userLng) params.append('userLng', userLng);
    return api.get(`/venues/${id}?${params.toString()}`);
  },

  // Submit venue confirmation/feedback
  submitConfirmation: (venueId, data) =>
    api.post(`/venues/${venueId}/confirmations`, data),

  // Get all confirmations for a venue
  getConfirmations: (venueId) =>
    api.get(`/venues/${venueId}/confirmations`),

  // Get list of states with venues
  getStates: () => api.get('/venues/states'),

  // Get countries with venue counts
  getCountries: () => api.get('/venues/countries'),

  // Get states for a country with venue counts
  getStatesByCountry: (country) => api.get(`/venues/countries/${encodeURIComponent(country)}/states`),

  // Get cities for a state with venue counts
  getCitiesByState: (country, state) => api.get(`/venues/countries/${encodeURIComponent(country)}/states/${encodeURIComponent(state)}/cities`),

  // Venue Assets
  getAssets: (venueId) => api.get(`/venues/${venueId}/assets`),
  uploadAsset: (venueId, data) => api.post(`/venues/${venueId}/assets`, data),
  deleteAsset: (assetId) => api.delete(`/venues/assets/${assetId}`),
  voteOnAsset: (assetId, isLike) => api.post(`/venues/assets/${assetId}/vote`, { isLike }),
  removeAssetVote: (assetId) => api.delete(`/venues/assets/${assetId}/vote`),

  // Check for nearby venues (duplicate detection)
  checkNearby: (latitude, longitude, radiusYards = 200) =>
    api.post('/venues/check-nearby', { latitude, longitude, radiusYards }),

  // Add a new venue
  addVenue: (data) => api.post('/venues', data),

  // Alias for addVenue (courts are venues)
  addCourt: (data) => api.post('/venues', data),

  // Get top venues for event creation (based on user history and location)
  getTopForEvents: (latitude, longitude, topN = 10) => {
    const params = new URLSearchParams();
    if (latitude) params.append('latitude', latitude);
    if (longitude) params.append('longitude', longitude);
    if (topN) params.append('topN', topN);
    return api.get(`/venues/top-for-events?${params.toString()}`);
  }
}

// Backward compatibility alias
export const courtsApi = venuesApi;

// Event Types API
export const eventTypesApi = {
  // Get all event types (public)
  getAll: (includeInactive = false) =>
    api.get(`/eventtypes${includeInactive ? '?includeInactive=true' : ''}`),

  // Alias for getAll (backward compatibility)
  list: () => api.get('/eventtypes'),

  // Get single event type
  getById: (id) => api.get(`/eventtypes/${id}`),

  // Create new event type (admin)
  create: (data) => api.post('/eventtypes', data),

  // Update event type (admin)
  update: (id, data) => api.put(`/eventtypes/${id}`, data),

  // Delete/deactivate event type (admin)
  delete: (id) => api.delete(`/eventtypes/${id}`),

  // Restore event type (admin)
  restore: (id) => api.post(`/eventtypes/${id}/restore`),

  // Reorder event types (admin)
  reorder: (orderedIds) => api.put('/eventtypes/reorder', orderedIds)
}

// Venue Types API (formerly Court Types)
export const venueTypesApi = {
  // Get all venue types (public)
  getAll: (includeInactive = false) =>
    api.get(`/venuetypes${includeInactive ? '?includeInactive=true' : ''}`),

  // Get single venue type
  getById: (id) => api.get(`/venuetypes/${id}`),

  // Create new venue type (admin)
  create: (data) => api.post('/venuetypes', data),

  // Update venue type (admin)
  update: (id, data) => api.put(`/venuetypes/${id}`, data),

  // Delete/deactivate venue type (admin)
  delete: (id) => api.delete(`/venuetypes/${id}`),

  // Restore venue type (admin)
  restore: (id) => api.post(`/venuetypes/${id}/restore`),

  // Reorder venue types (admin)
  reorder: (orderedIds) => api.put('/venuetypes/reorder', orderedIds)
}

// Backward compatibility alias
export const courtTypesApi = venueTypesApi;

// Events API (full event management)
export const eventsApi = {
  // Search events with filters
  search: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.append('query', params.query);
    if (params.eventTypeId) queryParams.append('eventTypeId', params.eventTypeId);
    if (params.country) queryParams.append('country', params.country);
    if (params.state) queryParams.append('state', params.state);
    if (params.city) queryParams.append('city', params.city);
    if (params.latitude) queryParams.append('latitude', params.latitude);
    if (params.longitude) queryParams.append('longitude', params.longitude);
    if (params.radiusMiles) queryParams.append('radiusMiles', params.radiusMiles);
    if (params.startDateFrom) queryParams.append('startDateFrom', params.startDateFrom);
    if (params.startDateTo) queryParams.append('startDateTo', params.startDateTo);
    if (params.isUpcoming !== undefined) queryParams.append('isUpcoming', params.isUpcoming);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    return api.get(`/events/search?${queryParams.toString()}`);
  },

  // Location dropdowns
  getCountries: () => api.get('/events/countries'),
  getStatesByCountry: (country) => api.get(`/events/countries/${encodeURIComponent(country)}/states`),
  getCitiesByState: (country, state) => api.get(`/events/countries/${encodeURIComponent(country)}/states/${encodeURIComponent(state)}/cities`),

  // Get featured events for home page
  getFeatured: (limit = 6) => api.get(`/events/featured?limit=${limit}`),

  // Get event details (requires auth)
  getEvent: (id) => api.get(`/events/${id}`),

  // Get public event view (no auth required)
  getEventPublic: (id) => api.get(`/events/${id}/public`),

  // Create a new event
  create: (data) => api.post('/events', data),

  // Update an event
  update: (id, data) => api.put(`/events/${id}`, data),

  // Delete an event
  delete: (id) => api.delete(`/events/${id}`),

  // Publish event
  publish: (id) => api.post(`/events/${id}/publish`),

  // Unpublish event
  unpublish: (id) => api.post(`/events/${id}/unpublish`),

  // Register for an event division
  register: (eventId, data) => api.post(`/events/${eventId}/register`, data),

  // Cancel registration
  cancelRegistration: (eventId, divisionId) =>
    api.delete(`/events/${eventId}/register/${divisionId}`),

  // Get division registrations
  getRegistrations: (eventId, divisionId) =>
    api.get(`/events/${eventId}/divisions/${divisionId}/registrations`),

  // Note: Partner requests moved to tournamentApi (EventUnitJoinRequests)
  // Use tournamentApi.requestToJoinUnit, tournamentApi.respondToJoinRequest, etc.

  // Get my events
  getMyEvents: () => api.get('/events/my'),

  // Division management
  addDivision: (eventId, data) =>
    api.post(`/events/${eventId}/divisions`, data),

  updateDivision: (eventId, divisionId, data) =>
    api.put(`/events/${eventId}/divisions/${divisionId}`, data),

  removeDivision: (eventId, divisionId) =>
    api.delete(`/events/${eventId}/divisions/${divisionId}`),

  // Registration management (organizer only)
  getAllRegistrations: (eventId) =>
    api.get(`/events/${eventId}/registrations`),

  updateRegistration: (eventId, registrationId, data) =>
    api.put(`/events/${eventId}/registrations/${registrationId}`, data),

  // Document management
  getDocuments: (eventId) =>
    api.get(`/events/${eventId}/documents`),

  addDocument: (eventId, data) =>
    api.post(`/events/${eventId}/documents`, data),

  updateDocument: (eventId, docId, data) =>
    api.put(`/events/${eventId}/documents/${docId}`, data),

  deleteDocument: (eventId, docId) =>
    api.delete(`/events/${eventId}/documents/${docId}`),

  // Get user's active event registrations (for dashboard notices)
  getMyActiveEvents: () => api.get('/events/my-active-events'),

  // Admin event management
  adminSearch: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.isPublished !== undefined) queryParams.append('isPublished', params.isPublished);
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive);
    if (params.hasVenue !== undefined) queryParams.append('hasVenue', params.hasVenue);
    if (params.eventTypeId) queryParams.append('eventTypeId', params.eventTypeId);
    if (params.startDateFrom) queryParams.append('startDateFrom', params.startDateFrom);
    if (params.startDateTo) queryParams.append('startDateTo', params.startDateTo);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortDesc !== undefined) queryParams.append('sortDesc', params.sortDesc);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    return api.get(`/events/admin/search?${queryParams.toString()}`);
  },
  adminGet: (eventId) => api.get(`/events/admin/${eventId}`),
  adminUpdate: (eventId, data) => api.put(`/events/admin/${eventId}`, data),

  // Mass notifications
  getNotificationFilters: (eventId) => api.get(`/events/${eventId}/notifications/filters`),
  previewNotificationRecipients: (eventId, data) => api.post(`/events/${eventId}/notifications/preview`, data),
  sendMassNotification: (eventId, data) => api.post(`/events/${eventId}/notifications/send`, data)
}

// Clubs API
export const clubsApi = {
  // Search clubs with filters
  search: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.append('query', params.query);
    if (params.country) queryParams.append('country', params.country);
    if (params.state) queryParams.append('state', params.state);
    if (params.city) queryParams.append('city', params.city);
    if (params.latitude) queryParams.append('latitude', params.latitude);
    if (params.longitude) queryParams.append('longitude', params.longitude);
    if (params.radiusMiles) queryParams.append('radiusMiles', params.radiusMiles);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    return api.get(`/clubs/search?${queryParams.toString()}`);
  },

  // Get recently created clubs (public, for marquee)
  getRecentClubs: (count = 20, days = 30) => api.get(`/clubs/recent?count=${count}&days=${days}`),

  // Location dropdowns
  getCountries: () => api.get('/clubs/countries'),
  getStatesByCountry: (country) => api.get(`/clubs/countries/${encodeURIComponent(country)}/states`),
  getCitiesByState: (country, state) => api.get(`/clubs/countries/${encodeURIComponent(country)}/states/${encodeURIComponent(state)}/cities`),

  // Get club details
  getClub: (id) => api.get(`/clubs/${id}`),

  // Create a new club
  create: (data) => api.post('/clubs', data),

  // Update a club
  update: (id, data) => api.put(`/clubs/${id}`, data),

  // Update club coordinates (for geocoding cache)
  updateCoordinates: (id, latitude, longitude) => api.patch(`/clubs/${id}/coordinates`, { latitude, longitude }),

  // Delete a club (soft delete)
  delete: (id) => api.delete(`/clubs/${id}`),

  // Join a club
  join: (id, data = {}) => api.post(`/clubs/${id}/join`, data),

  // Leave a club
  leave: (id) => api.post(`/clubs/${id}/leave`),

  // Get club members
  getMembers: (id) => api.get(`/clubs/${id}/members`),

  // Update member role and title
  updateMemberRole: (clubId, memberId, role, title = null) =>
    api.put(`/clubs/${clubId}/members/${memberId}/role`, { role, title }),

  // Update member details (admin only)
  updateMember: (clubId, memberId, data) =>
    api.put(`/clubs/${clubId}/members/${memberId}`, data),

  // Remove a member
  removeMember: (clubId, memberId) =>
    api.delete(`/clubs/${clubId}/members/${memberId}`),

  // Get pending join requests
  getJoinRequests: (id) => api.get(`/clubs/${id}/requests`),

  // Review join request
  reviewRequest: (clubId, requestId, approve) =>
    api.post(`/clubs/${clubId}/requests/${requestId}/review`, { approve }),

  // Send notification
  sendNotification: (id, title, message) =>
    api.post(`/clubs/${id}/notifications`, { title, message }),

  // Get notifications
  getNotifications: (id, page = 1, pageSize = 20) =>
    api.get(`/clubs/${id}/notifications?page=${page}&pageSize=${pageSize}`),

  // Get my clubs
  getMyClubs: () => api.get('/clubs/my'),

  // Get invite link
  getInviteLink: (id) => api.get(`/clubs/${id}/invite-link`),

  // Regenerate invite code
  regenerateInvite: (id) => api.post(`/clubs/${id}/regenerate-invite`),

  // Get club by invite code
  getByInviteCode: (code) => api.get(`/clubs/join/${code}`),

  // Club chat
  enableChat: (id) => api.post(`/clubs/${id}/chat/enable`),
  disableChat: (id) => api.post(`/clubs/${id}/chat/disable`),
  getChat: (id) => api.get(`/clubs/${id}/chat`),

  // Club documents
  getDocuments: (clubId) => api.get(`/clubs/${clubId}/documents`),
  createDocument: (clubId, data) => api.post(`/clubs/${clubId}/documents`, data),
  updateDocument: (clubId, documentId, data) => api.put(`/clubs/${clubId}/documents/${documentId}`, data),
  deleteDocument: (clubId, documentId) => api.delete(`/clubs/${clubId}/documents/${documentId}`),
  reorderDocuments: (clubId, orders) => api.put(`/clubs/${clubId}/documents/reorder`, orders)
}

// Club Member Roles API
export const clubMemberRolesApi = {
  // Get all roles
  getAll: (includeInactive = false) =>
    api.get(`/clubmemberroles${includeInactive ? '?includeInactive=true' : ''}`),

  // Get single role
  getById: (id) => api.get(`/clubmemberroles/${id}`),

  // Create new role (Admin only)
  create: (data) => api.post('/clubmemberroles', data),

  // Update role (Admin only)
  update: (id, data) => api.put(`/clubmemberroles/${id}`, data),

  // Delete role (Admin only)
  delete: (id) => api.delete(`/clubmemberroles/${id}`),

  // Restore role (Admin only)
  restore: (id) => api.post(`/clubmemberroles/${id}/restore`),

  // Reorder roles (Admin only)
  reorder: (orderedIds) => api.put('/clubmemberroles/reorder', orderedIds)
}

// League Roles API (Admin-configurable league manager roles)
export const leagueRolesApi = {
  // Get all roles
  getAll: (includeInactive = false) =>
    api.get(`/leagueroles${includeInactive ? '?includeInactive=true' : ''}`),

  // Get single role
  getById: (id) => api.get(`/leagueroles/${id}`),

  // Create new role (Admin only)
  create: (data) => api.post('/leagueroles', data),

  // Update role (Admin only)
  update: (id, data) => api.put(`/leagueroles/${id}`, data),

  // Delete role (Admin only)
  delete: (id) => api.delete(`/leagueroles/${id}`),

  // Restore role (Admin only)
  restore: (id) => api.post(`/leagueroles/${id}/restore`),

  // Reorder roles (Admin only)
  reorder: (orderedIds) => api.put('/leagueroles/reorder', orderedIds)
}

// Score Methods API (Admin-configurable scoring types)
export const scoreMethodsApi = {
  // Get all score methods (public for active, admin for all)
  getAll: (includeInactive = false) =>
    api.get(`/scoremethods${includeInactive ? '?includeInactive=true' : ''}`),

  // Get single score method
  getById: (id) => api.get(`/scoremethods/${id}`),

  // Create new score method (Admin only)
  create: (data) => api.post('/scoremethods', data),

  // Update score method (Admin only)
  update: (id, data) => api.put(`/scoremethods/${id}`, data),

  // Delete score method (Admin only)
  delete: (id) => api.delete(`/scoremethods/${id}`)
}

// Score Formats API (Game format presets)
export const scoreFormatsApi = {
  // Get all score formats (presets by default)
  getAll: ({ includeInactive = false, presetsOnly = true, eventId = null } = {}) => {
    const params = new URLSearchParams();
    if (includeInactive) params.append('includeInactive', 'true');
    if (!presetsOnly) params.append('presetsOnly', 'false');
    if (eventId) params.append('eventId', eventId);
    return api.get(`/scoreformats?${params.toString()}`);
  },

  // Get single score format
  getById: (id) => api.get(`/scoreformats/${id}`),

  // Create new score format (Admin only for presets)
  create: (data) => api.post('/scoreformats', data),

  // Update score format (Admin only for presets)
  update: (id, data) => api.put(`/scoreformats/${id}`, data),

  // Delete score format (Admin only for presets)
  delete: (id) => api.delete(`/scoreformats/${id}`),

  // Find existing format or create new one
  findOrCreate: (data) => api.post('/scoreformats/find-or-create', data)
}

// Blog API
export const blogApi = {
  // Categories (public for active only, admin for all)
  getCategories: (activeOnly = true) =>
    api.get(activeOnly ? '/blog/categories' : '/blog/categories/all'),

  // Category management (Admin only)
  createCategory: (data) => api.post('/blog/categories', data),
  updateCategory: (id, data) => api.put(`/blog/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/blog/categories/${id}`),

  // Posts (public)
  getPosts: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params.authorId) queryParams.append('authorId', params.authorId);
    if (params.status) queryParams.append('status', params.status);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    return api.get(`/blog/posts?${queryParams.toString()}`);
  },

  getPost: (idOrSlug) => api.get(`/blog/posts/${idOrSlug}`),

  // Post management (writers and admins)
  createPost: (data) => api.post('/blog/posts', data),
  updatePost: (id, data) => api.put(`/blog/posts/${id}`, data),
  deletePost: (id) => api.delete(`/blog/posts/${id}`),
  publishPost: (id) => api.put(`/blog/posts/${id}`, { status: 'Published' }),
  archivePost: (id) => api.put(`/blog/posts/${id}`, { status: 'Archived' }),

  // Get my posts (for authors)
  getMyPosts: () => api.get('/blog/posts/my'),

  // Get all posts (Admin only - includes drafts and archived)
  getAllPosts: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    const qs = queryParams.toString();
    return api.get(`/blog/posts/all${qs ? '?' + qs : ''}`);
  },

  // Comments
  getComments: (postId) => api.get(`/blog/posts/${postId}/comments`),
  addComment: (postId, content, parentId = null) =>
    api.post(`/blog/posts/${postId}/comments`, { content, parentId }),
  updateComment: (commentId, content) =>
    api.put(`/blog/comments/${commentId}`, { content }),
  deleteComment: (commentId) => api.delete(`/blog/comments/${commentId}`),

  // Writer management (Admin only)
  getWriters: () => api.get('/blog/writers'),
  addWriter: (userId) => api.post(`/blog/writers/${userId}`),
  removeWriter: (userId) => api.delete(`/blog/writers/${userId}`)
}

// Friends API
export const friendsApi = {
  // Get all friends
  getFriends: () => api.get('/friends'),

  // Get pending friend requests (received)
  getPendingRequests: () => api.get('/friends/requests/pending'),

  // Get sent friend requests (awaiting response)
  getSentRequests: () => api.get('/friends/requests/sent'),

  // Search for players to add as friends
  searchPlayers: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.firstName) params.append('firstName', filters.firstName);
    if (filters.lastName) params.append('lastName', filters.lastName);
    if (filters.city) params.append('city', filters.city);
    if (filters.state) params.append('state', filters.state);
    if (filters.email) params.append('email', filters.email);
    if (filters.phone) params.append('phone', filters.phone);
    return api.get(`/friends/search?${params.toString()}`);
  },

  // Send a friend request
  sendRequest: (userId) => api.post('/friends/requests', { recipientId: userId }),

  // Accept a friend request
  acceptRequest: (requestId) => api.post(`/friends/requests/${requestId}/accept`),

  // Reject a friend request
  rejectRequest: (requestId) => api.post(`/friends/requests/${requestId}/reject`),

  // Cancel a sent friend request
  cancelRequest: (requestId) => api.delete(`/friends/requests/${requestId}`),

  // Remove a friend
  removeFriend: (friendId) => api.delete(`/friends/${friendId}`),

  // Get game history with a friend
  getGameHistory: (friendId) => api.get(`/friends/${friendId}/games`),

  // Get friend's profile details
  getFriendProfile: (friendId) => api.get(`/friends/${friendId}/profile`)
}

// Team Units API (for event divisions)
export const teamUnitsApi = {
  // Get all active team units
  getAll: () => api.get('/teamunits'),

  // Get all team units including inactive (admin only)
  getAllIncludingInactive: () => api.get('/teamunits/all'),

  // Get single team unit
  getById: (id) => api.get(`/teamunits/${id}`),

  // Create new team unit (admin only)
  create: (data) => api.post('/teamunits', data),

  // Update team unit (admin only)
  update: (id, data) => api.put(`/teamunits/${id}`, data),

  // Delete team unit (admin only - soft delete)
  delete: (id) => api.delete(`/teamunits/${id}`)
}

// FAQ API
export const faqApi = {
  // Public - Get all active FAQ with entries
  getAll: () => api.get('/faq'),

  // Admin - Get all categories including inactive
  getAllCategories: () => api.get('/faq/categories/all'),

  // Admin - Create category
  createCategory: (data) => api.post('/faq/categories', data),

  // Admin - Update category
  updateCategory: (id, data) => api.put(`/faq/categories/${id}`, data),

  // Admin - Delete category (soft delete)
  deleteCategory: (id) => api.delete(`/faq/categories/${id}`),

  // Admin - Get all entries including inactive
  getAllEntries: () => api.get('/faq/entries/all'),

  // Admin - Create entry
  createEntry: (data) => api.post('/faq/entries', data),

  // Admin - Update entry
  updateEntry: (id, data) => api.put(`/faq/entries/${id}`, data),

  // Admin - Delete entry (soft delete)
  deleteEntry: (id) => api.delete(`/faq/entries/${id}`)
}

// Feedback API
export const feedbackApi = {
  // Public - Get active categories for submission form
  getCategories: () => api.get('/feedback/categories'),

  // Public - Submit feedback
  submit: (data) => api.post('/feedback', data),

  // Admin - Get all categories including inactive
  getAllCategories: () => api.get('/feedback/categories/all'),

  // Admin - Create category
  createCategory: (data) => api.post('/feedback/categories', data),

  // Admin - Update category
  updateCategory: (id, data) => api.put(`/feedback/categories/${id}`, data),

  // Admin - Delete category
  deleteCategory: (id) => api.delete(`/feedback/categories/${id}`),

  // Admin - Get all entries with filtering
  getEntries: (params) => api.get('/feedback/entries', { params }),

  // Admin - Get statistics
  getStats: () => api.get('/feedback/stats'),

  // Admin - Update entry status/notes
  updateEntry: (id, data) => api.put(`/feedback/entries/${id}`, data),

  // Admin - Delete entry
  deleteEntry: (id) => api.delete(`/feedback/entries/${id}`)
}

// Site Content API
export const siteContentApi = {
  // Public - Get content by key
  getContent: (key) => api.get(`/sitecontent/${key}`),

  // Admin - Get all content pages
  getAll: () => api.get('/sitecontent'),

  // Admin - Update content
  updateContent: (key, data) => api.put(`/sitecontent/${key}`, data),

  // Admin - Create new content page
  createContent: (data) => api.post('/sitecontent', data)
}

// Skill Levels API (for event divisions)
export const skillLevelsApi = {
  // Get all active skill levels
  getAll: () => api.get('/skill-levels'),

  // Get all skill levels including inactive (admin only)
  getAllIncludingInactive: () => api.get('/skill-levels/all'),

  // Get single skill level
  getById: (id) => api.get(`/skill-levels/${id}`),

  // Create new skill level (admin only)
  create: (data) => api.post('/skill-levels', data),

  // Update skill level (admin only)
  update: (id, data) => api.put(`/skill-levels/${id}`, data),

  // Delete skill level (admin only - soft delete)
  delete: (id) => api.delete(`/skill-levels/${id}`)
}

// Age Groups API (for event divisions)
export const ageGroupsApi = {
  // Get all active age groups
  getAll: () => api.get('/agegroups'),

  // Get all age groups including inactive (admin only)
  getAllIncludingInactive: () => api.get('/agegroups/all'),

  // Get single age group
  getById: (id) => api.get(`/agegroups/${id}`),

  // Create new age group (admin only)
  create: (data) => api.post('/agegroups', data),

  // Update age group (admin only)
  update: (id, data) => api.put(`/agegroups/${id}`, data),

  // Delete age group (admin only - soft delete)
  delete: (id) => api.delete(`/agegroups/${id}`)
}

// Tournament API
export const tournamentApi = {
  // Score Formats and Methods
  getScoreFormats: () => api.get('/tournament/score-formats'),
  getScoreMethods: () => api.get('/tournament/score-methods'),
  createScoreFormat: (data) => api.post('/tournament/score-formats', data),

  // Event Details with Divisions
  getEventDetails: (eventId) => api.get(`/tournament/events/${eventId}/details`),

  // Registration
  registerForEvent: (eventId, data) => api.post(`/tournament/events/${eventId}/register`, data),

  // Units
  getEventUnits: (eventId, divisionId = null) => {
    const params = divisionId ? `?divisionId=${divisionId}` : ''
    return api.get(`/tournament/events/${eventId}/units${params}`)
  },
  getMyUnits: () => api.get('/tournament/my-units'),
  requestToJoinUnit: (unitId, selectedFeeId, message) => api.post(`/tournament/units/${unitId}/join-request`, { unitId, message, selectedFeeId }),
  cancelJoinRequest: (requestId) => api.delete(`/tournament/join-requests/${requestId}`),
  respondToJoinRequest: (requestId, accept, message = null) =>
    api.post('/tournament/units/join-request/respond', { requestId, accept, message }),
  respondToInvitation: (unitId, accept) =>
    api.post('/tournament/units/invitation/respond', { unitId, accept }),
  leaveUnit: (unitId) => api.delete(`/tournament/units/${unitId}/leave`),
  unregisterFromDivision: (eventId, divisionId) =>
    api.delete(`/tournament/events/${eventId}/divisions/${divisionId}/unregister`),

  // Registration Management (organizer/admin)
  removeRegistration: (eventId, unitId, userId) =>
    api.delete(`/tournament/events/${eventId}/registrations/${unitId}/members/${userId}`),
  moveRegistration: (eventId, unitId, newDivisionId) =>
    api.post(`/tournament/events/${eventId}/registrations/${unitId}/move`, { newDivisionId }),
  mergeRegistrations: (eventId, targetUnitId, sourceUnitId) =>
    api.post(`/tournament/events/${eventId}/registrations/merge`, { targetUnitId, sourceUnitId }),
  adminBreakUnit: (unitId) =>
    api.post(`/tournament/units/${unitId}/admin-break`),

  // Registration Validation
  validateRegistrations: (eventId) =>
    api.get(`/tournament/events/${eventId}/validate-registrations`),

  // Admin User Search and Registration
  searchUsersForRegistration: (eventId, query) =>
    api.get(`/tournament/events/${eventId}/search-users?query=${encodeURIComponent(query)}`),
  adminRegisterUser: (eventId, data) =>
    api.post(`/tournament/events/${eventId}/admin-register`, data),

  // Player self-move to different division
  selfMoveToDivision: (eventId, newDivisionId, joinUnitId = null, newUnitName = null) =>
    api.post(`/tournament/events/${eventId}/self-move-division`, { newDivisionId, joinUnitId, newUnitName }),
  getJoinableUnits: (eventId, divisionId) =>
    api.get(`/tournament/events/${eventId}/divisions/${divisionId}/joinable-units`),

  // Join code feature
  getJoinableUnitsV2: (eventId, divisionId) =>
    api.get(`/tournament/events/${eventId}/divisions/${divisionId}/joinable-units-v2`),
  joinByCode: (joinCode, selectedFeeId = null) =>
    api.post('/tournament/units/join-by-code', { joinCode, selectedFeeId }),
  regenerateJoinCode: (unitId) =>
    api.post(`/tournament/units/${unitId}/regenerate-code`),
  updateJoinMethod: (unitId, joinMethod) =>
    api.put(`/tournament/units/${unitId}/join-method`, { joinMethod }),

  // Payment
  getPaymentSummary: (eventId) =>
    api.get(`/tournament/events/${eventId}/payment-summary`),
  uploadPaymentProof: (eventId, unitId, data) =>
    api.post(`/tournament/events/${eventId}/units/${unitId}/payment`, data),
  markAsPaid: (eventId, unitId) =>
    api.post(`/tournament/events/${eventId}/units/${unitId}/mark-paid`),
  unmarkPaid: (eventId, unitId) =>
    api.post(`/tournament/events/${eventId}/units/${unitId}/unmark-paid`),
  markMemberAsPaid: (eventId, unitId, memberId) =>
    api.post(`/tournament/events/${eventId}/units/${unitId}/members/${memberId}/mark-paid`),
  unmarkMemberPaid: (eventId, unitId, memberId) =>
    api.post(`/tournament/events/${eventId}/units/${unitId}/members/${memberId}/unmark-paid`),
  updateMemberPayment: (eventId, unitId, memberId, data) =>
    api.put(`/tournament/events/${eventId}/units/${unitId}/members/${memberId}/payment`, data),
  applyPaymentToTeammates: (eventId, unitId, memberId, targetMemberIds, redistributeAmount = true) =>
    api.post(`/tournament/events/${eventId}/units/${unitId}/members/${memberId}/apply-to-teammates`, {
      targetMemberIds,
      redistributeAmount,
    }),
  verifyPayment: (paymentId) =>
    api.post(`/tournament/payments/${paymentId}/verify`),
  unverifyPayment: (paymentId) =>
    api.post(`/tournament/payments/${paymentId}/unverify`),

  // Tournament Courts
  getTournamentCourts: (eventId) => api.get(`/tournament/events/${eventId}/courts`),
  createTournamentCourt: (eventId, data) => api.post(`/tournament/events/${eventId}/courts`, data),
  bulkCreateCourts: (eventId, numberOfCourts, labelPrefix = 'Court', startingNumber = 1) =>
    api.post(`/tournament/events/${eventId}/courts/bulk`, { numberOfCourts, labelPrefix, startingNumber }),

  // Match Scheduling
  generateSchedule: (divisionId, data) => api.post(`/tournament/divisions/${divisionId}/generate-schedule`, data),
  assignUnitNumbers: (divisionId) => api.post(`/tournament/divisions/${divisionId}/assign-unit-numbers`),
  assignUnitNumbersWithDrawing: (divisionId, assignments) =>
    api.post(`/tournament/divisions/${divisionId}/assign-unit-numbers`, { assignments }),
  getSchedule: (divisionId) => api.get(`/tournament/divisions/${divisionId}/schedule`),
  downloadScoresheet: (divisionId) => api.get(`/tournament/divisions/${divisionId}/scoresheet`, { responseType: 'blob' }),

  // Game Management
  assignGameToCourt: (gameId, courtId) =>
    api.post('/tournament/games/assign-court', { gameId, tournamentCourtId: courtId }),
  updateGameStatus: (gameId, status) =>
    api.post('/tournament/games/update-status', { gameId, status }),
  submitScore: (gameId, unit1Score, unit2Score) =>
    api.post('/tournament/games/submit-score', { gameId, unit1Score, unit2Score }),
  confirmScore: (gameId, confirm, disputeReason = null) =>
    api.post('/tournament/games/confirm-score', { gameId, confirm, disputeReason }),
  adminUpdateScore: (gameId, unit1Score, unit2Score, markAsFinished = false) =>
    api.post('/tournament/games/admin-update-score', { gameId, unit1Score, unit2Score, markAsFinished }),

  // Encounter management
  updateEncounterUnits: (encounterId, unit1Id, unit2Id) =>
    api.post('/tournament/encounters/update-units', { encounterId, unit1Id, unit2Id }),
  getDivisionUnits: (divisionId) =>
    api.get(`/tournament/divisions/${divisionId}/units`),

  // Pre-assign courts to encounters (schedule planning)
  preAssignCourt: (encounterId, courtId) =>
    api.post('/tournament/encounters/pre-assign-court', { encounterId, tournamentCourtId: courtId }),
  bulkPreAssignCourts: (eventId, assignments) =>
    api.post('/tournament/encounters/bulk-pre-assign-courts', { eventId, assignments }),

  // Check-in
  checkIn: (eventId, divisionId = null) =>
    api.post(`/tournament/events/${eventId}/check-in`, { eventId, divisionId }),
  getCheckInStatus: (eventId) => api.get(`/tournament/events/${eventId}/check-in-status`),

  // Dashboard
  getDashboard: (eventId) => api.get(`/tournament/events/${eventId}/dashboard`),
  updateTournamentStatus: (eventId, status) =>
    api.put(`/tournament/events/${eventId}/status?status=${status}`),

  // Live Drawing (Division-level)
  getDrawingState: (divisionId) => api.get(`/tournament/divisions/${divisionId}/drawing`),
  startDrawing: (divisionId) => api.post(`/tournament/divisions/${divisionId}/drawing/start`),
  drawNextUnit: (divisionId) => api.post(`/tournament/divisions/${divisionId}/drawing/next`),
  completeDrawing: (divisionId) => api.post(`/tournament/divisions/${divisionId}/drawing/complete`),
  cancelDrawing: (divisionId) => api.post(`/tournament/divisions/${divisionId}/drawing/cancel`),

  // Event-level Drawing (for Drawing Monitor page)
  getEventDrawingState: (eventId) => api.get(`/tournament/events/${eventId}/drawing`),
  startDrawingMode: (eventId) => api.post(`/tournament/events/${eventId}/drawing/start-mode`),
  endDrawingMode: (eventId) => api.post(`/tournament/events/${eventId}/drawing/end-mode`),

  // Tournament Reset (for testing/dry runs)
  resetTournament: (eventId) => api.post(`/tournament/reset-tournament/${eventId}`),

  // =====================================================
  // Division Phases (multi-phase tournament scheduling)
  // =====================================================

  // Phase CRUD
  getDivisionPhases: (divisionId) => api.get(`/divisionphases/division/${divisionId}`),
  getPhase: (phaseId) => api.get(`/divisionphases/${phaseId}`),
  createPhase: (data) => api.post('/divisionphases', data),
  updatePhase: (phaseId, data) => api.put(`/divisionphases/${phaseId}`, data),
  deletePhase: (phaseId) => api.delete(`/divisionphases/${phaseId}`),

  // Schedule Generation
  generatePhaseSchedule: (phaseId) => api.post(`/divisionphases/${phaseId}/generate-schedule`),
  getPhaseSchedule: (phaseId) => api.get(`/divisionphases/${phaseId}/schedule`),

  // Advancement Rules
  setAdvancementRules: (phaseId, rules) => api.post(`/divisionphases/${phaseId}/advancement-rules`, rules),
  /** Auto-generate advancement rules from source phase using seeding strategy (Snake, Sequential, CrossPool) */
  generateAdvancementRules: (phaseId, sourcePhaseId, advancingPerPool = null) =>
    api.post(`/divisionphases/${phaseId}/auto-advancement-rules`, { sourcePhaseId, advancingPerPool }),

  // Court Assignments
  setPhaseCourtAssignments: (phaseId, assignments) => api.post(`/divisionphases/${phaseId}/court-assignments`, assignments),
  autoAssignPhaseCourts: (phaseId) => api.post(`/divisionphases/${phaseId}/auto-assign-courts`),
  calculatePhaseTimes: (phaseId) => api.post(`/divisionphases/${phaseId}/calculate-times`),

  // =====================================================
  // Phase Templates (pre-built tournament structures)
  // =====================================================

  // Template CRUD
  getPhaseTemplates: (category = null) =>
    api.get(`/phasetemplates${category ? `?category=${category}` : ''}`),
  getPhaseTemplatesForUnitCount: (unitCount) =>
    api.get(`/phasetemplates/for-units/${unitCount}`),
  getPhaseTemplate: (templateId) =>
    api.get(`/phasetemplates/${templateId}`),
  getTemplatesByCategory: (category) =>
    api.get(`/phasetemplates/category/${category}`),
  createPhaseTemplate: (data) =>
    api.post('/phasetemplates', data),
  updatePhaseTemplate: (templateId, data) =>
    api.put(`/phasetemplates/${templateId}`, data),
  deletePhaseTemplate: (templateId) =>
    api.delete(`/phasetemplates/${templateId}`),

  // Template Application
  previewTemplate: (templateId, divisionId, unitCount = null) =>
    api.post('/phasetemplates/preview', { templateId, divisionId, unitCount }),
  applyTemplate: (templateId, divisionId, unitCount = null, clearExisting = true) =>
    api.post(`/phasetemplates/${templateId}/apply/${divisionId}?unitCount=${unitCount || ''}&clearExisting=${clearExisting}`),

  // Manual Exit Slot Assignment (TD override)
  manualExitSlotAssignment: (phaseId, slotNumber, unitId, notes = null) =>
    api.post('/phasetemplates/manual-exit-assignment', { phaseId, slotNumber, unitId, notes }),
  getExitSlots: (phaseId) =>
    api.get(`/phasetemplates/${phaseId}/exit-slots`),
  processByes: (phaseId) =>
    api.post(`/phasetemplates/${phaseId}/process-byes`),

  // =====================================================
  // Court Groups
  // =====================================================

  getCourtGroups: (eventId) => api.get(`/courtgroups/event/${eventId}`),
  getCourtGroup: (groupId) => api.get(`/courtgroups/${groupId}`),
  createCourtGroup: (data) => api.post('/courtgroups', data),
  updateCourtGroup: (groupId, data) => api.put(`/courtgroups/${groupId}`, data),
  deleteCourtGroup: (groupId) => api.delete(`/courtgroups/${groupId}`),
  assignCourtsToGroup: (groupId, courtIds) => api.post(`/courtgroups/${groupId}/courts`, { courtIds }),
  addCourtToGroup: (groupId, courtId) => api.post(`/courtgroups/${groupId}/courts/${courtId}`),
  removeCourtFromGroup: (groupId, courtId) => api.delete(`/courtgroups/${groupId}/courts/${courtId}`),
  autoCreateCourtGroups: (eventId, groupSize = 4) => api.post(`/courtgroups/event/${eventId}/auto-create?groupSize=${groupSize}`),

  // =====================================================
  // Court Planning (Dedicated Court Pre-Assignment)
  // =====================================================

  getCourtPlanningData: (eventId) => api.get(`/tournament/court-planning/${eventId}`),
  bulkAssignCourtsAndTimes: (eventId, assignments) =>
    api.post('/tournament/court-planning/bulk-assign', { eventId, assignments }),
  assignCourtGroupsToDivision: (divisionId, courtGroupIds, validFromTime = null, validToTime = null) =>
    api.post('/tournament/court-planning/division-courts', { divisionId, courtGroupIds, validFromTime, validToTime }),
  autoAssignDivisionCourts: (divisionId, options = null) =>
    api.post(`/tournament/court-planning/auto-assign/${divisionId}`, options),
  clearDivisionCourtAssignments: (divisionId) =>
    api.post(`/tournament/court-planning/clear/${divisionId}`),
  validateSchedule: (eventId) =>
    api.get(`/tournament/court-planning/validate/${eventId}`),
  publishSchedule: (eventId, validateFirst = true) =>
    api.post(`/tournament/court-planning/publish/${eventId}`, { eventId, validateFirst }),
  unpublishSchedule: (eventId) =>
    api.post(`/tournament/court-planning/unpublish/${eventId}`),
  getTimelineData: (eventId) =>
    api.get(`/tournament/court-planning/timeline/${eventId}`),
  addDivisionCourtAssignment: (data) =>
    api.post('/tournament/court-planning/division-assignment', data),
  deleteDivisionCourtAssignment: (assignmentId) =>
    api.delete(`/tournament/court-planning/division-assignment/${assignmentId}`),

  // =====================================================
  // Division Fees
  // =====================================================

  getDivisionFees: (divisionId) => api.get(`/tournament/divisions/${divisionId}/fees`),
  createDivisionFee: (divisionId, data) => api.post(`/tournament/divisions/${divisionId}/fees`, data),
  updateDivisionFee: (divisionId, feeId, data) => api.put(`/tournament/divisions/${divisionId}/fees/${feeId}`, data),
  deleteDivisionFee: (divisionId, feeId) => api.delete(`/tournament/divisions/${divisionId}/fees/${feeId}`),
  bulkUpdateDivisionFees: (divisionId, fees) => api.put(`/tournament/divisions/${divisionId}/fees`, fees),

  // =====================================================
  // Event Fees (event-level fees, not division-specific)
  // =====================================================
  getEventFees: (eventId) => api.get(`/tournament/events/${eventId}/fees`),
  createEventFee: (eventId, data) => api.post(`/tournament/events/${eventId}/fees`, data),
  updateEventFee: (eventId, feeId, data) => api.put(`/tournament/events/${eventId}/fees/${feeId}`, data),
  deleteEventFee: (eventId, feeId) => api.delete(`/tournament/events/${eventId}/fees/${feeId}`),
  bulkUpdateEventFees: (eventId, fees) => api.put(`/tournament/events/${eventId}/fees`, fees),

  // =====================================================
  // Event Fee Types (fee type templates at event level)
  // =====================================================
  getEventFeeTypes: (eventId) => api.get(`/tournament/events/${eventId}/fee-types`),
  createEventFeeType: (eventId, data) => api.post(`/tournament/events/${eventId}/fee-types`, data),
  updateEventFeeType: (eventId, feeTypeId, data) => api.put(`/tournament/events/${eventId}/fee-types/${feeTypeId}`, data),
  deleteEventFeeType: (eventId, feeTypeId) => api.delete(`/tournament/events/${eventId}/fee-types/${feeTypeId}`),
  bulkUpdateEventFeeTypes: (eventId, feeTypes) => api.put(`/tournament/events/${eventId}/fee-types`, feeTypes)
}

// Messaging API
export const messagingApi = {
  // Conversations
  getConversations: () => api.get('/messaging/conversations'),
  getConversation: (id) => api.get(`/messaging/conversations/${id}`),
  createDirectConversation: (otherUserId, initialMessage = null) =>
    api.post('/messaging/conversations/direct', { otherUserId, initialMessage }),
  createGroupConversation: (name, participantUserIds) =>
    api.post('/messaging/conversations/group', { name, participantUserIds }),
  updateConversation: (id, data) => api.put(`/messaging/conversations/${id}`, data),
  leaveConversation: (id) => api.post(`/messaging/conversations/${id}/leave`),
  muteConversation: (id, isMuted) =>
    api.put(`/messaging/conversations/${id}/mute`, { isMuted }),

  // Participants
  addParticipants: (conversationId, userIds) =>
    api.post(`/messaging/conversations/${conversationId}/participants`, { userIds }),
  removeParticipant: (conversationId, userId) =>
    api.delete(`/messaging/conversations/${conversationId}/participants/${userId}`),

  // Messages
  getMessages: (conversationId, beforeMessageId = null, limit = 50) => {
    const params = new URLSearchParams();
    if (beforeMessageId) params.append('beforeMessageId', beforeMessageId);
    params.append('limit', limit);
    return api.get(`/messaging/conversations/${conversationId}/messages?${params.toString()}`);
  },
  sendMessage: (conversationId, content, messageType = 'Text', replyToMessageId = null) =>
    api.post(`/messaging/conversations/${conversationId}/messages`, {
      content,
      messageType,
      replyToMessageId
    }),
  editMessage: (messageId, content) =>
    api.put(`/messaging/messages/${messageId}`, { content }),
  deleteMessage: (messageId) => api.delete(`/messaging/messages/${messageId}`),

  // Read receipts
  markAsRead: (conversationId) =>
    api.post(`/messaging/conversations/${conversationId}/read`),

  // Settings
  getSettings: () => api.get('/messaging/settings'),
  updateSettings: (settings) => api.put('/messaging/settings', settings)
}

// Leagues API (hierarchical organization structure)
export const leaguesApi = {
  // Search/list leagues with filters
  search: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.append('query', params.query);
    if (params.scope) queryParams.append('scope', params.scope);
    if (params.state) queryParams.append('state', params.state);
    if (params.region) queryParams.append('region', params.region);
    if (params.country) queryParams.append('country', params.country);
    if (params.parentLeagueId) queryParams.append('parentLeagueId', params.parentLeagueId);
    if (params.rootOnly) queryParams.append('rootOnly', params.rootOnly);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    return api.get(`/leagues?${queryParams.toString()}`);
  },

  // Get league details with managers, clubs, and child leagues
  getLeague: (id) => api.get(`/leagues/${id}`),

  // Get leagues where current user is a manager
  getMyManagedLeagues: () => api.get('/leagues/my-managed'),

  // Get hierarchy tree for navigation
  getTree: (scope = null) => {
    const params = scope ? `?scope=${scope}` : '';
    return api.get(`/leagues/tree${params}`);
  },

  // Create league (admin only, local server only)
  create: (data) => api.post('/leagues', data),

  // Update league
  update: (id, data) => api.put(`/leagues/${id}`, data),

  // Delete/deactivate league (admin only)
  delete: (id) => api.delete(`/leagues/${id}`),

  // Manager management
  addManager: (leagueId, data) => api.post(`/leagues/${leagueId}/managers`, data),
  updateManager: (leagueId, managerId, data) =>
    api.put(`/leagues/${leagueId}/managers/${managerId}`, data),
  removeManager: (leagueId, managerId) =>
    api.delete(`/leagues/${leagueId}/managers/${managerId}`),

  // Club join request (from club's perspective)
  requestToJoin: (clubId, leagueId, message = null) =>
    api.post(`/clubs/${clubId}/leagues/${leagueId}/request`, { leagueId, message }),

  // Process club join request (league manager)
  processRequest: (leagueId, requestId, approve, responseMessage = null) =>
    api.post(`/leagues/${leagueId}/requests/${requestId}/process`, { approve, responseMessage }),

  // Update club membership in league
  updateClubMembership: (leagueId, membershipId, data) =>
    api.put(`/leagues/${leagueId}/clubs/${membershipId}`, data),

  // Remove club from league
  removeClub: (leagueId, membershipId) =>
    api.delete(`/leagues/${leagueId}/clubs/${membershipId}`),

  // Get leagues a club belongs to
  getClubLeagues: (clubId) => api.get(`/clubs/${clubId}/leagues`),

  // Avatar management
  updateAvatar: (leagueId, avatarUrl) =>
    api.post(`/leagues/${leagueId}/avatar`, { avatarUrl }),

  // Document management
  addDocument: (leagueId, data) =>
    api.post(`/leagues/${leagueId}/documents`, data),
  updateDocument: (leagueId, documentId, data) =>
    api.put(`/leagues/${leagueId}/documents/${documentId}`, data),
  deleteDocument: (leagueId, documentId) =>
    api.delete(`/leagues/${leagueId}/documents/${documentId}`),
  reorderDocuments: (leagueId, documentIds) =>
    api.put(`/leagues/${leagueId}/documents/reorder`, { documentIds })
}

// Notifications API
export const notificationsApi = {
  // Get notifications with optional filters
  getNotifications: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.unreadOnly) queryParams.append('unreadOnly', params.unreadOnly);
    if (params.type) queryParams.append('type', params.type);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    const queryString = queryParams.toString();
    return api.get(`/notifications${queryString ? `?${queryString}` : ''}`);
  },

  // Get unread count
  getUnreadCount: () => api.get('/notifications/count'),

  // Create notification (admin only) - also pushes via SignalR
  create: (data) => api.post('/notifications', data),

  // Mark single notification as read
  markAsRead: (id) => api.put(`/notifications/${id}/read`),

  // Mark all as read
  markAllAsRead: () => api.put('/notifications/read-all'),

  // Delete single notification
  delete: (id) => api.delete(`/notifications/${id}`),

  // Delete all read notifications
  deleteRead: () => api.delete('/notifications/read'),

  // Delete all notifications
  deleteAll: () => api.delete('/notifications/all'),

  // Send test notification (tests both SignalR and Web Push)
  test: () => api.post('/notifications/test')
}

// Push Notifications API (Web Push)
export const pushApi = {
  // Get VAPID public key for subscribing
  getVapidPublicKey: () => api.get('/push/vapid-public-key'),

  // Subscribe to push notifications
  subscribe: (subscription, deviceName = null) => api.post('/push/subscribe', {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.toJSON().keys.p256dh,
      auth: subscription.toJSON().keys.auth
    },
    userAgent: navigator.userAgent,
    deviceName
  }),

  // Unsubscribe from push notifications
  unsubscribe: (endpoint) => api.post('/push/unsubscribe', { endpoint }),

  // Unsubscribe all devices
  unsubscribeAll: () => api.delete('/push/subscriptions'),

  // Get all subscriptions for current user
  getSubscriptions: () => api.get('/push/subscriptions'),

  // Send test push notification
  test: () => api.post('/push/test')
}

// Grants API (club grant account management)
export const grantsApi = {
  // Get current user's grant permissions
  getPermissions: () => api.get('/grants/permissions'),

  // ============================================
  // Club Admin Endpoints (view-only for club admins)
  // ============================================

  // Get grant accounts for a specific club (club admin or grant manager)
  getClubAccounts: (clubId) => api.get(`/grants/club/${clubId}/accounts`),

  // Get transactions for a specific club (club admin or grant manager)
  getClubTransactions: (clubId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.leagueId) queryParams.append('leagueId', params.leagueId);
    if (params.transactionType) queryParams.append('transactionType', params.transactionType);
    if (params.category) queryParams.append('category', params.category);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    const queryString = queryParams.toString();
    return api.get(`/grants/club/${clubId}/transactions${queryString ? `?${queryString}` : ''}`);
  },

  // Get summary for a specific club (club admin or grant manager)
  getClubSummary: (clubId) => api.get(`/grants/club/${clubId}/summary`),

  // ============================================
  // Grant Manager Endpoints (full access)
  // ============================================

  // Accounts
  getAccounts: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.leagueId) queryParams.append('leagueId', params.leagueId);
    if (params.clubId) queryParams.append('clubId', params.clubId);
    const queryString = queryParams.toString();
    return api.get(`/grants/accounts${queryString ? `?${queryString}` : ''}`);
  },
  getAccount: (clubId, leagueId) => api.get(`/grants/accounts/${clubId}/${leagueId}`),
  getAccountSummary: (leagueId = null) => {
    const params = leagueId ? `?leagueId=${leagueId}` : '';
    return api.get(`/grants/accounts/summary${params}`);
  },

  // Transactions
  getTransactions: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.leagueId) queryParams.append('leagueId', params.leagueId);
    if (params.clubId) queryParams.append('clubId', params.clubId);
    if (params.transactionType) queryParams.append('transactionType', params.transactionType);
    if (params.category) queryParams.append('category', params.category);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.donorName) queryParams.append('donorName', params.donorName);
    if (params.includeVoided) queryParams.append('includeVoided', params.includeVoided);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    const queryString = queryParams.toString();
    return api.get(`/grants/transactions${queryString ? `?${queryString}` : ''}`);
  },
  createTransaction: (data) => api.post('/grants/transactions', data),
  voidTransaction: (id, reason) => api.post(`/grants/transactions/${id}/void`, { reason }),

  // Grant Managers
  getManagers: (leagueId = null) => {
    const params = leagueId ? `?leagueId=${leagueId}` : '';
    return api.get(`/grants/managers${params}`);
  },
  createManager: (data) => api.post('/grants/managers', data),
  updateManager: (id, data) => api.put(`/grants/managers/${id}`, data),
  deleteManager: (id) => api.delete(`/grants/managers/${id}`),

  // Helper endpoints for dropdowns
  getLeagues: () => api.get('/grants/leagues'),
  getClubs: (leagueId = null) => {
    const params = leagueId ? `?leagueId=${leagueId}` : '';
    return api.get(`/grants/clubs${params}`);
  },

  // Transaction Attachments
  getTransactionAttachments: (transactionId) =>
    api.get(`/grants/transactions/${transactionId}/attachments`),
  addTransactionAttachment: (transactionId, data) =>
    api.post(`/grants/transactions/${transactionId}/attachments`, data),
  deleteTransactionAttachment: (transactionId, attachmentId) =>
    api.delete(`/grants/transactions/${transactionId}/attachments/${attachmentId}`)
}

// Club Finance API (internal club accounting)
export const clubFinanceApi = {
  // Permissions
  getPermissions: (clubId) => api.get(`/clubs/${clubId}/finance/permissions`),

  // Account
  getAccount: (clubId) => api.get(`/clubs/${clubId}/finance/account`),
  getSummary: (clubId) => api.get(`/clubs/${clubId}/finance/summary`),

  // Transactions
  getTransactions: (clubId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.transactionType) queryParams.append('transactionType', params.transactionType);
    if (params.category) queryParams.append('category', params.category);
    if (params.memberUserId) queryParams.append('memberUserId', params.memberUserId);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.includeVoided) queryParams.append('includeVoided', params.includeVoided);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    const queryString = queryParams.toString();
    return api.get(`/clubs/${clubId}/finance/transactions${queryString ? `?${queryString}` : ''}`);
  },
  createTransaction: (clubId, data) => api.post(`/clubs/${clubId}/finance/transactions`, data),
  updateTransaction: (clubId, transactionId, data) => api.put(`/clubs/${clubId}/finance/transactions/${transactionId}`, data),
  voidTransaction: (clubId, transactionId, reason) => api.post(`/clubs/${clubId}/finance/transactions/${transactionId}/void`, { reason }),

  // Attachments
  addAttachment: (clubId, transactionId, data) => api.post(`/clubs/${clubId}/finance/transactions/${transactionId}/attachments`, data),
  deleteAttachment: (clubId, transactionId, attachmentId) => api.delete(`/clubs/${clubId}/finance/transactions/${transactionId}/attachments/${attachmentId}`),

  // Member payments
  getMemberPayments: (clubId) => api.get(`/clubs/${clubId}/finance/member-payments`),
  getMembers: (clubId) => api.get(`/clubs/${clubId}/finance/members`)
}

// Player History API
export const playerHistoryApi = {
  // Summary
  getSummary: (userId) => api.get(`/player-history/${userId}/summary`),

  // Game History
  getGames: (userId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.partnerUserId) queryParams.append('partnerUserId', params.partnerUserId);
    if (params.opponentUserId) queryParams.append('opponentUserId', params.opponentUserId);
    if (params.partnerName) queryParams.append('partnerName', params.partnerName);
    if (params.opponentName) queryParams.append('opponentName', params.opponentName);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.eventType) queryParams.append('eventType', params.eventType);
    if (params.eventId) queryParams.append('eventId', params.eventId);
    if (params.winsOnly !== undefined) queryParams.append('winsOnly', params.winsOnly);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    const queryString = queryParams.toString();
    return api.get(`/player-history/${userId}/games${queryString ? `?${queryString}` : ''}`);
  },

  // Awards
  getAwards: (userId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.awardType) queryParams.append('awardType', params.awardType);
    if (params.eventId) queryParams.append('eventId', params.eventId);
    if (params.leagueId) queryParams.append('leagueId', params.leagueId);
    if (params.clubId) queryParams.append('clubId', params.clubId);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.activeOnly !== undefined) queryParams.append('activeOnly', params.activeOnly);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    const queryString = queryParams.toString();
    return api.get(`/player-history/${userId}/awards${queryString ? `?${queryString}` : ''}`);
  },
  createAward: (data) => api.post('/player-history/awards', data),

  // Ratings
  getRatings: (userId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.ratingType) queryParams.append('ratingType', params.ratingType);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    const queryString = queryParams.toString();
    return api.get(`/player-history/${userId}/ratings${queryString ? `?${queryString}` : ''}`);
  },
  createRating: (data) => api.post('/player-history/ratings', data),

  // Payments
  getPayments: (userId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.eventId) queryParams.append('eventId', params.eventId);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    const queryString = queryParams.toString();
    return api.get(`/player-history/${userId}/payments${queryString ? `?${queryString}` : ''}`);
  },

  // Helpers
  getEventTypes: () => api.get('/player-history/event-types'),
  getAwardTypes: () => api.get('/player-history/award-types'),
  getRatingTypes: () => api.get('/player-history/rating-types'),
  getPaymentStatuses: () => api.get('/player-history/payment-statuses')
}

// Help Topics API (dynamic contextual help)
export const helpApi = {
  // Public - Get help topic by code
  getByCode: (topicCode) => api.get(`/helptopics/code/${topicCode}`),

  // Public - Get multiple help topics by codes (batch)
  getBatch: (topicCodes) => api.post('/helptopics/batch', topicCodes),

  // Public - Get help topics by category
  getByCategory: (category) => api.get(`/helptopics/category/${category}`),

  // Admin - Get all help topics
  getAll: (category = null) => {
    const params = category ? `?category=${category}` : '';
    return api.get(`/helptopics${params}`);
  },

  // Admin - Get help topic by ID
  getById: (id) => api.get(`/helptopics/${id}`),

  // Admin - Create help topic
  create: (data) => api.post('/helptopics', data),

  // Admin - Update help topic
  update: (id, data) => api.put(`/helptopics/${id}`, data),

  // Admin - Delete help topic
  delete: (id) => api.delete(`/helptopics/${id}`),

  // Admin - Get all categories
  getCategories: () => api.get('/helptopics/categories')
}

// Release Notes API
export const releaseNotesApi = {
  // Public - Get all active release notes
  getAll: () => api.get('/releasenotes'),

  // Public - Get latest release
  getLatest: () => api.get('/releasenotes/latest'),

  // User - Get unread releases for current user
  getUnread: () => api.get('/releasenotes/unread'),

  // User - Dismiss a single release (never show again)
  dismiss: (id) => api.post(`/releasenotes/${id}/dismiss`),

  // User - Dismiss all current releases
  dismissAll: () => api.post('/releasenotes/dismiss-all'),

  // Admin - Get all releases including inactive
  getAllAdmin: () => api.get('/releasenotes/admin'),

  // Admin - Create a new release note
  create: (data) => api.post('/releasenotes', data),

  // Admin - Update a release note
  update: (id, data) => api.put(`/releasenotes/${id}`, data),

  // Admin - Delete a release note
  delete: (id) => api.delete(`/releasenotes/${id}`)
}

// Event Notification Templates API
export const notificationTemplatesApi = {
  // Get all notification types with placeholders
  getTypes: () => api.get('/eventnotificationtemplates/types'),

  // Get default templates
  getDefaults: () => api.get('/eventnotificationtemplates'),

  // Get templates for a specific event (includes defaults for missing types)
  getForEvent: (eventId) => api.get(`/eventnotificationtemplates/event/${eventId}`),

  // Create a new template
  create: (data) => api.post('/eventnotificationtemplates', data),

  // Update a template
  update: (id, data) => api.put(`/eventnotificationtemplates/${id}`, data),

  // Delete a template (event-specific only)
  delete: (id) => api.delete(`/eventnotificationtemplates/${id}`),

  // Preview a notification with sample data
  preview: (data) => api.post('/eventnotificationtemplates/preview', data),

  // Copy default templates to an event for customization
  copyDefaultsToEvent: (eventId) => api.post(`/eventnotificationtemplates/event/${eventId}/copy-defaults`)
}

// Check-In API (Game Day)
export const checkInApi = {
  // Get check-in status for current user (redo param allows re-signing waiver)
  getStatus: (eventId, redo = null) => api.get(`/checkin/status/${eventId}${redo ? `?redo=${redo}` : ''}`),

  // Self check-in
  checkIn: (eventId) => api.post(`/checkin/${eventId}`),

  // Request check-in (player self-service, sets status to Requested)
  requestCheckIn: (eventId, confirmPaymentSubmitted = false) =>
    api.post(`/checkin/request/${eventId}`, { confirmPaymentSubmitted }),

  // Manual check-in by TD
  manualCheckIn: (eventId, userId, data = {}) => api.post(`/checkin/manual/${eventId}/${userId}`, data),

  // Sign waiver with digital signature (typed + drawn)
  signWaiver: (eventId, waiverId, signatureData = {}) => api.post(`/checkin/waiver/${eventId}`, {
    waiverId,
    signature: signatureData.signature,
    signatureImage: signatureData.signatureImage,
    signerRole: signatureData.signerRole || 'Participant',
    parentGuardianName: signatureData.parentGuardianName,
    emergencyPhone: signatureData.emergencyPhone,
    chineseName: signatureData.chineseName
  }),

  // Admin: Get check-in status for a specific user (for admin-initiated waiver signing)
  getAdminStatus: (eventId, userId, redo = null) =>
    api.get(`/checkin/admin/status/${eventId}/${userId}${redo ? `?redo=${redo}` : ''}`),

  // Admin: Sign waiver on behalf of a user (for in-person signing on admin's device)
  adminSignWaiver: (eventId, userId, waiverId, signatureData = {}) =>
    api.post(`/checkin/admin/waiver/${eventId}/${userId}`, {
      waiverId,
      signature: signatureData.signature,
      signatureImage: signatureData.signatureImage,
      signerRole: signatureData.signerRole || 'Participant',
      parentGuardianName: signatureData.parentGuardianName,
      emergencyPhone: signatureData.emergencyPhone,
      chineseName: signatureData.chineseName
    }),

  // Get event check-in summary (TD view)
  getEventCheckIns: (eventId) => api.get(`/checkin/event/${eventId}`),

  // Get waivers for event (legacy, still used for check-in flow)
  getWaivers: (eventId) => api.get(`/checkin/waivers/${eventId}`),

  // Create waiver (TD) - legacy
  createWaiver: (eventId, data) => api.post(`/checkin/waivers/${eventId}`, data),

  // Delete waiver (TD) - legacy
  deleteWaiver: (eventId, waiverId) => api.delete(`/checkin/waivers/${eventId}/${waiverId}`),

  // Get all event documents (waivers, maps, rules, contacts)
  getDocuments: (eventId) => api.get(`/checkin/documents/${eventId}`),

  // Create or update event document (TD)
  createDocument: (eventId, data) => api.post(`/checkin/documents/${eventId}`, data),

  // Delete event document (TD)
  deleteDocument: (eventId, documentId) => api.delete(`/checkin/documents/${eventId}/${documentId}`),

  // Admin override/void actions
  voidCheckIn: (eventId, userId, notes = null) => api.post(`/checkin/void/${eventId}/${userId}`, { notes }),
  overrideWaiver: (eventId, userId, notes = null) => api.post(`/checkin/waiver-override/${eventId}/${userId}`, { notes }),
  voidWaiver: (eventId, userId, notes = null) => api.post(`/checkin/waiver-void/${eventId}/${userId}`, { notes }),
  overridePayment: (eventId, userId, hasPaid, amountPaid = null, notes = null) =>
    api.post(`/checkin/payment-override/${eventId}/${userId}`, { hasPaid, amountPaid, notes }),

  // Send waiver signing request to player
  sendWaiverRequest: (eventId, userId) => api.post(`/checkin/send-waiver-request/${eventId}/${userId}`)
}

// Tournament Game Day API
export const gameDayApi = {
  // TD Dashboard
  getTDDashboard: (eventId) => api.get(`/tournament-gameday/td/${eventId}`),

  // Player Dashboard
  getPlayerGameDay: (eventId) => api.get(`/tournament-gameday/player/${eventId}`),

  // Court management
  updateCourt: (courtId, data) => api.put(`/gameday/courts/${courtId}`, data),
  deleteCourt: (courtId) => api.delete(`/gameday/courts/${courtId}`),

  // Get ready games
  getReadyGames: (eventId, divisionId = null) => {
    const params = divisionId ? `?divisionId=${divisionId}` : ''
    return api.get(`/tournament-gameday/ready-games/${eventId}${params}`)
  },

  // Queue a game to a court (admin)
  queueGame: (gameId, courtId) => api.post('/tournament-gameday/queue-game', { gameId, courtId }),

  // Player self-assigns their game to a court
  playerQueueGame: (gameId, courtId) => api.post('/tournament-gameday/player-queue-game', { gameId, courtId }),

  // Start a game
  startGame: (gameId) => api.post(`/tournament-gameday/start-game/${gameId}`),

  // Suggest next game based on pool progress and player availability
  suggestNextGame: (eventId) => api.get(`/tournament-gameday/suggest-next-game/${eventId}`),

  // Submit score
  submitScore: (gameId, unit1Score, unit2Score, finalize = false, reason = null) =>
    api.post(`/tournament-gameday/score/${gameId}`, { unit1Score, unit2Score, finalize, reason }),

  // Get standings
  getStandings: (eventId, divisionId) => api.get(`/tournament-gameday/standings/${eventId}/${divisionId}`),

  // Override rank (TD only)
  overrideRank: (unitId, data) => api.post(`/tournament-gameday/override-rank/${unitId}`, data),

  // Pool management
  calculatePoolRankings: (eventId, divisionId) =>
    api.post(`/tournament-gameday/calculate-pool-rankings/${eventId}/${divisionId}`),

  finalizePools: (eventId, divisionId, advancePerPool = null) =>
    api.post(`/tournament-gameday/finalize-pools/${eventId}/${divisionId}`, { advancePerPool }),

  resetPools: (eventId, divisionId) =>
    api.post(`/tournament-gameday/reset-pools/${eventId}/${divisionId}`),

  // Send notification
  sendNotification: (eventId, data) => api.post(`/tournament-gameday/notify/${eventId}`, data),

  // Score History (TD, admin, scorekeeper only)
  getGameScoreHistory: (eventId, gameId) => api.get(`/eventrunning/${eventId}/games/${gameId}/history`),
  getEncounterScoreHistory: (eventId, encounterId) => api.get(`/eventrunning/${eventId}/encounters/${encounterId}/history`)
}

// Spectator API
export const spectatorApi = {
  // Get subscriptions
  getSubscriptions: (eventId) => api.get(`/spectator/subscriptions/${eventId}`),

  // Subscribe
  subscribe: (data) => api.post('/spectator/subscribe', data),

  // Unsubscribe
  unsubscribe: (subscriptionId) => api.delete(`/spectator/unsubscribe/${subscriptionId}`),

  // Toggle subscription
  toggleSubscription: (subscriptionId) => api.put(`/spectator/toggle/${subscriptionId}`),

  // Get spectator view
  getEventView: (eventId) => api.get(`/spectator/event/${eventId}`),

  // Get subscribable items
  getSubscribableItems: (eventId) => api.get(`/spectator/subscribable/${eventId}`)
}

// Scoreboard API
export const scoreboardApi = {
  // Get scoreboard with filters
  getScoreboard: (eventId, params = {}) => {
    const queryParams = new URLSearchParams()
    if (params.divisionId) queryParams.append('divisionId', params.divisionId)
    if (params.roundType) queryParams.append('roundType', params.roundType)
    if (params.status) queryParams.append('status', params.status)
    if (params.page) queryParams.append('page', params.page)
    if (params.pageSize) queryParams.append('pageSize', params.pageSize)
    const queryString = queryParams.toString()
    return api.get(`/scoreboard/${eventId}${queryString ? `?${queryString}` : ''}`)
  },

  // Get live scores
  getLiveScores: (eventId) => api.get(`/scoreboard/live/${eventId}`),

  // Get event results
  getResults: (eventId, divisionId = null) => {
    const params = divisionId ? `?divisionId=${divisionId}` : ''
    return api.get(`/scoreboard/results/${eventId}${params}`)
  },

  // Download results CSV
  getResultsDownloadUrl: (eventId, divisionId = null) => {
    const params = divisionId ? `?divisionId=${divisionId}` : ''
    return `${API_BASE_URL}/scoreboard/results/${eventId}/download${params}`
  },

  // Get bracket
  getBracket: (eventId, divisionId) => api.get(`/scoreboard/bracket/${eventId}/${divisionId}`),

  // Get pools
  getPools: (eventId, divisionId) => api.get(`/scoreboard/pools/${eventId}/${divisionId}`),

  // Get registrations for spectator view
  getRegistrations: (eventId, divisionId = null) => {
    const params = divisionId ? `?divisionId=${divisionId}` : ''
    return api.get(`/scoreboard/registrations/${eventId}${params}`)
  },

  // Get schedule for spectator view
  getSchedule: (eventId, params = {}) => {
    const queryParams = new URLSearchParams()
    if (params.divisionId) queryParams.append('divisionId', params.divisionId)
    if (params.date) queryParams.append('date', params.date)
    const queryString = queryParams.toString()
    return api.get(`/scoreboard/schedule/${eventId}${queryString ? `?${queryString}` : ''}`)
  }
}

// Object Types API (admin)
export const objectTypesApi = {
  getAll: (includeInactive = false) =>
    api.get(`/objecttypes${includeInactive ? '?includeInactive=true' : ''}`),
  getById: (id) => api.get(`/objecttypes/${id}`),
  create: (data) => api.post('/objecttypes', data),
  update: (id, data) => api.put(`/objecttypes/${id}`, data),
  delete: (id) => api.delete(`/objecttypes/${id}`)
}

// Object Asset Types API (admin)
export const objectAssetTypesApi = {
  getAll: (params = {}) => {
    const queryParams = new URLSearchParams()
    if (params.objectTypeId) queryParams.append('objectTypeId', params.objectTypeId)
    if (params.objectTypeName) queryParams.append('objectTypeName', params.objectTypeName)
    if (params.includeInactive) queryParams.append('includeInactive', 'true')
    const queryString = queryParams.toString()
    return api.get(`/objectassettypes${queryString ? `?${queryString}` : ''}`)
  },
  getById: (id) => api.get(`/objectassettypes/${id}`),
  create: (data) => api.post('/objectassettypes', data),
  update: (id, data) => api.put(`/objectassettypes/${id}`, data),
  delete: (id) => api.delete(`/objectassettypes/${id}`)
}

// Object Assets API (generalized assets for any object type)
export const objectAssetsApi = {
  // Get assets for an object
  getAssets: (objectTypeName, objectId) =>
    api.get(`/objectassets/${objectTypeName}/${objectId}`),

  // Add asset to an object
  addAsset: (objectTypeName, objectId, data) =>
    api.post(`/objectassets/${objectTypeName}/${objectId}`, data),

  // Update asset
  updateAsset: (objectTypeName, objectId, assetId, data) =>
    api.put(`/objectassets/${objectTypeName}/${objectId}/${assetId}`, data),

  // Delete asset
  deleteAsset: (objectTypeName, objectId, assetId) =>
    api.delete(`/objectassets/${objectTypeName}/${objectId}/${assetId}`)
}

// Location Reference API (countries and states)
export const locationApi = {
  // Get all active countries
  getCountries: () => api.get('/location/countries'),

  // Get states/provinces for a country (by code or ID)
  getStatesByCountry: (countryCode) => api.get(`/location/countries/${encodeURIComponent(countryCode)}/states`),

  // Get all countries with their states
  getCountriesWithStates: () => api.get('/location/countries-with-states'),

  // Get a specific state by country and state code
  getState: (countryCode, stateCode) =>
    api.get(`/location/countries/${encodeURIComponent(countryCode)}/states/${encodeURIComponent(stateCode)}`),

  // Get cities for a state (by ID or code)
  getCitiesByState: (stateId) => api.get(`/location/states/${encodeURIComponent(stateId)}/cities`),

  // Add a new city to a state (creates if doesn't exist, returns existing if it does)
  addCity: (stateId, name) => api.post(`/location/states/${encodeURIComponent(stateId)}/cities`, { name })
}

// Event Staff API
export const eventStaffApi = {
  // Global staff roles (admin-managed templates)
  getGlobalRoles: () => api.get('/eventstaff/roles/global'),
  createGlobalRole: (data) => api.post('/eventstaff/roles/global', data),
  updateGlobalRole: (roleId, data) => api.put(`/eventstaff/roles/global/${roleId}`, data),
  deleteGlobalRole: (roleId) => api.delete(`/eventstaff/roles/global/${roleId}`),

  // Event-specific roles
  getEventRoles: (eventId) => api.get(`/eventstaff/event/${eventId}/roles`),
  createEventRole: (eventId, data) => api.post(`/eventstaff/event/${eventId}/roles`, data),

  // Staff management
  getEventStaff: (eventId) => api.get(`/eventstaff/event/${eventId}`),
  assignStaff: (eventId, data) => api.post(`/eventstaff/event/${eventId}`, data),
  updateStaff: (eventId, staffId, data) => api.put(`/eventstaff/event/${eventId}/staff/${staffId}`, data),
  removeStaff: (eventId, staffId) => api.delete(`/eventstaff/event/${eventId}/staff/${staffId}`),

  // Self-registration
  selfRegister: (eventId, data) => api.post(`/eventstaff/event/${eventId}/self-register`, data),
  getMyStatus: (eventId) => api.get(`/eventstaff/event/${eventId}/my-status`),
  getAvailableRoles: (eventId) => api.get(`/eventstaff/event/${eventId}/available-roles`),

  // Pending staff management (admin)
  getPendingStaff: (eventId) => api.get(`/eventstaff/event/${eventId}/pending`),
  approveStaff: (eventId, staffId, data) => api.post(`/eventstaff/event/${eventId}/staff/${staffId}/approve`, data),
  declineStaff: (eventId, staffId, reason = null) =>
    api.post(`/eventstaff/event/${eventId}/staff/${staffId}/decline`, { reason }),

  // Permission check
  hasPermission: (eventId, permission) => api.get(`/eventstaff/event/${eventId}/has-permission/${permission}`),

  // Staff dashboard
  getDashboard: (eventId) => api.get(`/eventstaff/event/${eventId}/dashboard`)
}

// Encounter API (Team Scrimmage / Lineup Management)
export const encounterApi = {
  // Division encounter config
  getDivisionConfig: (divisionId) => api.get(`/encounters/divisions/${divisionId}/config`),
  updateDivisionConfig: (divisionId, data) => api.put(`/encounters/divisions/${divisionId}/config`, data),

  // Encounter management
  getEncounter: (encounterId) => api.get(`/encounters/${encounterId}`),
  createEncounter: (eventId, data) => api.post(`/encounters/events/${eventId}`, data),

  // Match player assignment
  getMatchPlayers: (matchId) => api.get(`/encounters/matches/${matchId}/players`),
  updateMatchPlayers: (matchId, data) => api.put(`/encounters/matches/${matchId}/players`, data),

  // Lineup locking
  toggleLineupLock: (encounterId, data) => api.post(`/encounters/${encounterId}/lineup-lock`, data),
  getLineupLockStatus: (encounterId) => api.get(`/encounters/${encounterId}/lineup-lock`)
}

export default api
