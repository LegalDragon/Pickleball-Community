import axios from 'axios'
import * as signalR from '@microsoft/signalr'
import api from './api'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// Determine the SignalR hub URL
function getHubUrl() {
  const apiUrl = API_BASE_URL
  // In production, API_BASE_URL is '/api', so hub is at '/hubs/videoroom'
  // In dev, API_BASE_URL is full URL like 'https://localhost:7009'
  if (apiUrl.startsWith('http')) {
    // Dev mode: use full URL
    return `${apiUrl.replace(/\/api\/?$/, '')}/hubs/videoroom`
  }
  // Production: hubs are under /api since backend is a virtual app at /api
  return '/api/hubs/videoroom'
}

// REST API calls — use the project's api instance (has auth interceptor)
export const videoRoomApi = {
  createRoom: (data) => api.post(`/VideoRoom`, data),
  getRoom: (roomCode) => api.get(`/VideoRoom/${roomCode}`),
  getActiveRooms: () => api.get(`/VideoRoom`),
  joinRoom: (roomCode, data) => api.post(`/VideoRoom/${roomCode}/join`, data),
  getParticipants: (roomCode) => api.get(`/VideoRoom/${roomCode}/participants`),
  endRoom: (roomCode) => api.post(`/VideoRoom/${roomCode}/end`),
  lockRoom: (roomCode, locked) => api.post(`/VideoRoom/${roomCode}/lock?locked=${locked}`),

  // Club Video Rooms
  getClubRoom: (clubId) => api.get(`/VideoRoom/club/${clubId}`),
  inviteToClubRoom: (clubId, data) => api.post(`/VideoRoom/club/${clubId}/invite`, data),
  joinClubRoom: (roomCode) => api.post(`/VideoRoom/${roomCode}/join-club`),
}

// SignalR connection for video room
export function createVideoRoomConnection() {
  const token = localStorage.getItem('jwtToken')
  
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(getHubUrl(), {
      accessTokenFactory: () => token || '',
      skipNegotiation: false,
      transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  return connection
}

// WebRTC configuration with public STUN servers
export const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
}
