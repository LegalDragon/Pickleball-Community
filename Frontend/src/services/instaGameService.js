import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwtToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('InstaGame API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

/**
 * InstaGame API service for spontaneous pickup games
 */
const instaGameService = {
  // ===============================================
  // Session Management
  // ===============================================

  /**
   * Create a new InstaGame session
   * @param {Object} data - { name, schedulingMethod, teamSize, maxPlayers, scoreFormatId, venueId, customLocationName, latitude, longitude }
   */
  create: (data) => api.post('/instagame', data),

  /**
   * Get InstaGame by ID
   * @param {number} id
   */
  getById: (id) => api.get(`/instagame/${id}`),

  /**
   * Get InstaGame by join code
   * @param {string} joinCode
   */
  getByCode: (joinCode) => api.get(`/instagame/code/${joinCode.toUpperCase()}`),

  /**
   * Get active InstaGames
   * @param {number} limit
   */
  getActive: (limit = 20) => api.get('/instagame/active', { params: { limit } }),

  /**
   * Find nearby InstaGames
   * @param {number} latitude
   * @param {number} longitude
   * @param {number} radiusMiles
   * @param {number} limit
   */
  getNearby: (latitude, longitude, radiusMiles = 10, limit = 20) =>
    api.get('/instagame/nearby', { params: { latitude, longitude, radiusMiles, limit } }),

  /**
   * Update InstaGame settings
   * @param {number} id
   * @param {Object} data - { name, schedulingMethod, maxPlayers, scoreFormatId }
   */
  update: (id, data) => api.put(`/instagame/${id}`, data),

  /**
   * Start the InstaGame session
   * @param {number} id
   */
  start: (id) => api.post(`/instagame/${id}/start`),

  /**
   * Pause the InstaGame session
   * @param {number} id
   */
  pause: (id) => api.post(`/instagame/${id}/pause`),

  /**
   * End the InstaGame session
   * @param {number} id
   */
  end: (id) => api.post(`/instagame/${id}/end`),

  // ===============================================
  // Player Management
  // ===============================================

  /**
   * Join an InstaGame by code
   * @param {string} joinCode
   */
  join: (joinCode) => api.post('/instagame/join', { joinCode: joinCode.toUpperCase() }),

  /**
   * Leave an InstaGame
   * @param {number} id
   */
  leave: (id) => api.post(`/instagame/${id}/leave`),

  /**
   * Update player status
   * @param {number} id
   * @param {string} status - 'Available' or 'Resting'
   */
  updateStatus: (id, status) => api.put(`/instagame/${id}/status`, { status }),

  /**
   * Toggle organizer status for a player
   * @param {number} id
   * @param {number} targetUserId
   */
  toggleOrganizer: (id, targetUserId) => api.put(`/instagame/${id}/players/${targetUserId}/organizer`),

  // ===============================================
  // Match Management
  // ===============================================

  /**
   * Create a manual match with specified teams
   * @param {number} id
   * @param {Object} data - { team1PlayerIds: number[], team2PlayerIds: number[] }
   */
  createMatch: (id, data) => api.post(`/instagame/${id}/matches`, data),

  /**
   * Auto-generate next match based on scheduling method
   * @param {number} id
   */
  generateNextMatch: (id) => api.post(`/instagame/${id}/matches/auto`),

  /**
   * Start a match
   * @param {number} id
   * @param {number} matchId
   */
  startMatch: (id, matchId) => api.post(`/instagame/${id}/matches/${matchId}/start`),

  /**
   * Update match score
   * @param {number} id
   * @param {number} matchId
   * @param {Object} data - { team1Score, team2Score }
   */
  updateScore: (id, matchId, data) => api.put(`/instagame/${id}/matches/${matchId}/score`, data),

  /**
   * Complete a match with final score
   * @param {number} id
   * @param {number} matchId
   * @param {Object} data - { team1Score, team2Score, winningTeam: 1|2 }
   */
  completeMatch: (id, matchId, data) => api.post(`/instagame/${id}/matches/${matchId}/complete`, data),

  // ===============================================
  // Queue Management
  // ===============================================

  /**
   * Get the current queue
   * @param {number} id
   */
  getQueue: (id) => api.get(`/instagame/${id}/queue`),

  /**
   * Add teams to queue
   * @param {number} id
   * @param {Object} data - { team1PlayerIds, team2PlayerIds?, queueType }
   */
  addToQueue: (id, data) => api.post(`/instagame/${id}/queue`, data),

  /**
   * Remove from queue
   * @param {number} id
   * @param {number} queueId
   */
  removeFromQueue: (id, queueId) => api.delete(`/instagame/${id}/queue/${queueId}`),

  /**
   * Reorder queue
   * @param {number} id
   * @param {number[]} queueItemIds - Array of queue item IDs in desired order
   */
  reorderQueue: (id, queueItemIds) => api.put(`/instagame/${id}/queue/reorder`, { queueItemIds })
}

export default instaGameService
