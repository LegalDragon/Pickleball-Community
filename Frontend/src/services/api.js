import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const SHARED_AUTH_URL = import.meta.env.VITE_SHARED_AUTH_URL || ''
const SHARED_AUTH_UI_URL = import.meta.env.VITE_SHARED_AUTH_UI_URL || ''

// Helper function to get full asset URL (for avatars, images, videos, etc.)
export const getAssetUrl = (path) => {
  if (!path) return null
  // If path is already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  // Get base URL without /api suffix for asset paths
  const baseUrl = API_BASE_URL//.replace(/\/api\/?$/, '')

  // If path starts with /api, use the full API URL
  if (path.startsWith('/api/')) {
    return `${baseUrl}${path.replace('/api/', '/')}`
  }
  // If path starts with /, prepend base URL
  if (path.startsWith('/')) {
    return `${baseUrl}${path}`
  }
  // For relative paths without leading slash, prepend base URL with /
  return `${baseUrl}/${path}`
}

// Export API_BASE_URL for direct use if needed
export { API_BASE_URL }

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwtToken') ;
  // const token = localStorage.getItem('jwtToken') || 
  //               localStorage.getItem('authToken') ||
  //               JSON.parse(localStorage.getItem('pickleball_user'))?.RefreshToken;
  
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
  syncFromSharedAuth: (token) =>
    api.post('/auth/sync', { token }),

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

}

// Export shared auth URLs for components that need them
export { SHARED_AUTH_URL, SHARED_AUTH_UI_URL }

export const materialApi = {
  createMaterial: (formData) => 
    api.post('/materials', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  getMaterials: () => 
    api.get('/materials'),

  getCoachMaterials: (coachId) => {
    console.log('Getting materials for coach:', coachId);
    return api.get(`/materials/coach/${coachId}`);
  },

  purchaseMaterial: (materialId) => 
    api.post(`/materials/${materialId}/purchase`),

  updateMaterial: (id, data) =>
    api.put(`/materials/${id}`, data, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }),

  deleteMaterial: (id) =>
    api.delete(`/materials/${id}`),

  getMaterial: (id) =>
    api.get(`/materials/${id}`),

  togglePublish: (id) =>
    api.post(`/materials/${id}/toggle-publish`)
}

export const sessionApi = {
  scheduleSession: (sessionData) =>
    api.post('/sessions', sessionData),

  // Student requests a session with a coach (pending confirmation)
  requestSession: (data) =>
    api.post('/sessions/request', data),

  // Coach confirms a pending session
  confirmSession: (sessionId, data) =>
    api.post(`/sessions/${sessionId}/confirm`, data),

  // Get pending sessions for coach
  getPendingSessions: () =>
    api.get('/sessions/pending'),

  // Coach proposes changes to a session
  proposeChanges: (sessionId, data) =>
    api.post(`/sessions/${sessionId}/propose`, data),

  // Student accepts coach's proposal
  acceptProposal: (sessionId) =>
    api.post(`/sessions/${sessionId}/accept-proposal`),

  // Student declines coach's proposal
  declineProposal: (sessionId) =>
    api.post(`/sessions/${sessionId}/decline-proposal`),

  // Get sessions with pending proposals (for student)
  getSessionsWithProposals: () =>
    api.get('/sessions/proposals'),

  getCoachSessions: (coachId) => {
    console.log('Getting sessions for coach:', coachId);
    return api.get(`/sessions/coach/${coachId}`)
      .catch(error => {
        console.log('Coach sessions with ID failed, trying without ID...');
        return api.get('/sessions/coach');
      });
  },

  getStudentSessions: () =>
    api.get('/sessions/student'),

  cancelSession: (sessionId) =>
    api.delete(`/sessions/${sessionId}`)
}

// For debugging - test endpoints
export const testApi = {
  testAuth: () => api.get('/auth/test'),
  testMaterials: () => api.get('/materials/test'),
  testSessions: () => api.get('/sessions/test')
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
  reset: () => api.post('/theme/reset')
}

// User Profile API
export const userApi = {
  // Get current user's profile
  getProfile: () => api.get('/users/profile'),

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
  updateUser: (id, data) => api.put(`/users/${id}`, data)
}

// Content Types API
export const contentTypesApi = {
  // Get all active content types
  getAll: () => api.get('/contenttypes'),

  // Get content type by code
  getByCode: (code) => api.get(`/contenttypes/${code}`)
}

// Course Management API
export const courseApi = {
  // Create a new course
  createCourse: (formData) =>
    api.post('/courses', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  // Update a course
  updateCourse: (id, formData) =>
    api.put(`/courses/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  // Get all published courses
  getCourses: () =>
    api.get('/courses'),

  // Get courses for a coach
  getCoachCourses: (coachId) =>
    api.get(`/courses/coach/${coachId}`),

  // Get a single course with materials
  getCourse: (id) =>
    api.get(`/courses/${id}`),

  // Toggle publish status
  togglePublish: (id) =>
    api.post(`/courses/${id}/toggle-publish`),

  // Delete a course
  deleteCourse: (id) =>
    api.delete(`/courses/${id}`),

  // Add material to course
  addMaterial: (courseId, data) =>
    api.post(`/courses/${courseId}/materials`, data),

  // Update course material (sort order, preview status)
  updateMaterial: (courseId, courseMaterialId, data) =>
    api.put(`/courses/${courseId}/materials/${courseMaterialId}`, data),

  // Remove material from course
  removeMaterial: (courseId, courseMaterialId) =>
    api.delete(`/courses/${courseId}/materials/${courseMaterialId}`),

  // Reorder materials
  reorderMaterials: (courseId, materials) =>
    api.post(`/courses/${courseId}/materials/reorder`, { materials }),

  // Purchase course
  purchaseCourse: (courseId) =>
    api.post(`/courses/${courseId}/purchase`),

  // Check if user has purchased course
  hasPurchased: (courseId) =>
    api.get(`/courses/${courseId}/purchased`)
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

// Video Review Request API
export const videoReviewApi = {
  // Create a video review request (student)
  createRequest: (data) =>
    api.post('/videoreviews', data),

  // Update a video review request (student)
  updateRequest: (requestId, data) =>
    api.put(`/videoreviews/${requestId}`, data),

  // Get my video review requests (student)
  getMyRequests: () =>
    api.get('/videoreviews/my-requests'),

  // Cancel a request (student)
  cancelRequest: (requestId) =>
    api.delete(`/videoreviews/${requestId}`),

  // Coach proposes a price/note (bidding)
  propose: (requestId, data) =>
    api.post(`/videoreviews/${requestId}/propose`, data),

  // Student accepts coach's proposal
  acceptProposal: (requestId) =>
    api.post(`/videoreviews/${requestId}/accept-proposal`),

  // Student declines coach's proposal
  declineProposal: (requestId) =>
    api.post(`/videoreviews/${requestId}/decline-proposal`),

  // Get open requests (coach) - includes targeted and open requests
  getOpenRequests: () =>
    api.get('/videoreviews/open'),

  // Get coach's assigned requests
  getCoachRequests: () =>
    api.get('/videoreviews/coach'),

  // Accept a request directly (coach - for simple flow)
  acceptRequest: (requestId) =>
    api.post(`/videoreviews/${requestId}/accept`),

  // Complete a review (coach)
  completeReview: (requestId, data) =>
    api.post(`/videoreviews/${requestId}/complete`, data),

  // Get a specific request
  getRequest: (requestId) =>
    api.get(`/videoreviews/${requestId}`)
}

// Coach Search API (uses dedicated coaches endpoint)
export const coachApi = {
  // Get all coaches with their profiles
  getCoaches: () =>
    api.get('/users/coaches').then(response => response.data || response),

  // Get a single coach by ID
  getCoach: (id) =>
    api.get(`/users/coaches/${id}`).then(response => response.data || response),

  // Search coaches (filter on client-side for now)
  searchCoaches: (query) =>
    api.get('/users/coaches').then(response => {
      const coaches = response.data || response;
      return coaches.filter(u =>
        u.firstName?.toLowerCase().includes(query.toLowerCase()) ||
        u.lastName?.toLowerCase().includes(query.toLowerCase()) ||
        u.bio?.toLowerCase().includes(query.toLowerCase())
      );
    })
}

// Blog API
export const blogApi = {
  // Get all published blog posts (public)
  getPosts: (page = 1, pageSize = 10, category = null) => {
    const params = new URLSearchParams({ page, pageSize });
    if (category) params.append('category', category);
    return api.get(`/blog?${params.toString()}`);
  },

  // Get all categories
  getCategories: () =>
    api.get('/blog/categories'),

  // Get blog post by slug
  getPostBySlug: (slug) =>
    api.get(`/blog/slug/${slug}`),

  // Get blog post by ID
  getPostById: (id) =>
    api.get(`/blog/${id}`),

  // Get posts by coach (public - only published)
  getCoachPosts: (coachId) =>
    api.get(`/blog/coach/${coachId}`),

  // Get current coach's posts (including drafts)
  getMyPosts: () =>
    api.get('/blog/my-posts'),

  // Create a new blog post
  createPost: (data) =>
    api.post('/blog', data),

  // Update a blog post
  updatePost: (id, data) =>
    api.put(`/blog/${id}`, data),

  // Delete a blog post
  deletePost: (id) =>
    api.delete(`/blog/${id}`),

  // Toggle publish status
  togglePublish: (id) =>
    api.post(`/blog/${id}/toggle-publish`)
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
  deactivateRequest: (id) =>
    api.post(`/playercertification/requests/${id}/deactivate`),

  // Review Page (Public)
  getReviewPage: (token) =>
    api.get(`/playercertification/review/${token}`),
  submitReview: (token, data) =>
    api.post(`/playercertification/review/${token}`, data),

  // Certificate View (Student)
  getMyCertificate: () =>
    api.get('/playercertification/certificate')
}

export default api