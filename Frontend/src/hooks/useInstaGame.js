import { useState, useEffect, useCallback, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { API_BASE_URL } from '../services/api'
import instaGameService from '../services/instaGameService'

/**
 * Custom hook for managing InstaGame state and real-time updates via SignalR
 *
 * Usage:
 * const {
 *   instaGame, players, currentMatch, queue, loading, error,
 *   connectionState, refresh,
 *   // Actions
 *   createMatch, startMatch, updateScore, completeMatch,
 *   generateNextMatch, joinQueue, leaveQueue,
 *   updateStatus, leave
 * } = useInstaGame(instaGameId);
 */
export function useInstaGame(instaGameId) {
  const [instaGame, setInstaGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [connectionState, setConnectionState] = useState('disconnected')

  const connectionRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  // Derived state from instaGame
  const players = instaGame?.players || []
  const currentMatch = instaGame?.currentMatch
  const recentMatches = instaGame?.recentMatches || []
  const queue = instaGame?.queue || []
  const myPlayerInfo = instaGame?.myPlayerInfo

  // Build SignalR hub URL
  const getHubUrl = useCallback(() => {
    const baseUrl = API_BASE_URL || window.location.origin
    return `${baseUrl}/hubs/notifications`
  }, [])

  // Fetch InstaGame data
  const fetchInstaGame = useCallback(async () => {
    if (!instaGameId) {
      setInstaGame(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await instaGameService.getById(instaGameId)
      setInstaGame(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching InstaGame:', err)
      setError(err.response?.data?.message || 'Failed to load game')
    } finally {
      setLoading(false)
    }
  }, [instaGameId])

  // Create SignalR connection
  const createConnection = useCallback(() => {
    const token = localStorage.getItem('jwtToken')
    if (!token) {
      console.log('InstaGame: No token available, skipping SignalR connection')
      return null
    }

    const hubUrl = getHubUrl()
    console.log('InstaGame: Creating SignalR connection to', hubUrl)

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.previousRetryCount >= maxReconnectAttempts) {
            return null
          }
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000)
        }
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    return newConnection
  }, [getHubUrl])

  // Connect to SignalR and join InstaGame group
  const connect = useCallback(async () => {
    if (!instaGameId) return

    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      // Already connected, just join the group
      try {
        await connectionRef.current.invoke('JoinInstaGameGroup', instaGameId)
      } catch (err) {
        console.error('Error joining InstaGame group:', err)
      }
      return
    }

    const newConnection = createConnection()
    if (!newConnection) return

    // Set up connection state handlers
    newConnection.onreconnecting(() => {
      console.log('InstaGame: Reconnecting...')
      setConnectionState('reconnecting')
    })

    newConnection.onreconnected(async () => {
      console.log('InstaGame: Reconnected')
      setConnectionState('connected')
      reconnectAttempts.current = 0
      // Rejoin group after reconnection
      try {
        await newConnection.invoke('JoinInstaGameGroup', instaGameId)
      } catch (err) {
        console.error('Error rejoining InstaGame group:', err)
      }
    })

    newConnection.onclose(() => {
      console.log('InstaGame: Connection closed')
      setConnectionState('disconnected')
      connectionRef.current = null
    })

    // Set up event handlers
    newConnection.on('ReceiveNotification', (notification) => {
      console.log('InstaGame: Received notification', notification)

      if (notification.referenceType === 'InstaGame' ||
          notification.referenceType === 'InstaGameMatch') {
        // Refresh data on relevant notifications
        fetchInstaGame()
      }
    })

    newConnection.on('GameScoreUpdate', (scoreUpdate) => {
      console.log('InstaGame: Score update', scoreUpdate)
      // Update current match score without full refresh
      setInstaGame(prev => {
        if (!prev || !prev.currentMatch) return prev
        if (prev.currentMatch.id !== scoreUpdate.gameId) return prev

        return {
          ...prev,
          currentMatch: {
            ...prev.currentMatch,
            team1Score: scoreUpdate.team1Score,
            team2Score: scoreUpdate.team2Score,
            winningTeam: scoreUpdate.winningTeam,
            status: scoreUpdate.status
          }
        }
      })
    })

    newConnection.on('InstaGamePlayerUpdate', (playerUpdate) => {
      console.log('InstaGame: Player update', playerUpdate)
      fetchInstaGame() // Refresh to get updated player list
    })

    newConnection.on('InstaGameQueueUpdate', (queueUpdate) => {
      console.log('InstaGame: Queue update', queueUpdate)
      fetchInstaGame() // Refresh to get updated queue
    })

    // Start connection
    try {
      setConnectionState('connecting')
      await newConnection.start()
      console.log('InstaGame: Connected to SignalR')
      setConnectionState('connected')
      connectionRef.current = newConnection
      reconnectAttempts.current = 0

      // Join InstaGame group
      await newConnection.invoke('JoinInstaGameGroup', instaGameId)
      console.log(`InstaGame: Joined group instagame_${instaGameId}`)
    } catch (err) {
      console.error('InstaGame: Connection failed:', err)
      setConnectionState('disconnected')
    }
  }, [instaGameId, createConnection, fetchInstaGame])

  // Disconnect from SignalR
  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      try {
        if (instaGameId) {
          await connectionRef.current.invoke('LeaveInstaGameGroup', instaGameId)
        }
        await connectionRef.current.stop()
        console.log('InstaGame: Disconnected')
      } catch (err) {
        console.error('InstaGame: Error disconnecting:', err)
      }
      connectionRef.current = null
      setConnectionState('disconnected')
    }
  }, [instaGameId])

  // Effect: Fetch data and connect on mount/id change
  useEffect(() => {
    fetchInstaGame()
    connect()

    return () => {
      disconnect()
    }
  }, [instaGameId, fetchInstaGame, connect, disconnect])

  // ===============================================
  // Actions
  // ===============================================

  const refresh = useCallback(() => {
    return fetchInstaGame()
  }, [fetchInstaGame])

  const createMatch = useCallback(async (team1PlayerIds, team2PlayerIds) => {
    try {
      const match = await instaGameService.createMatch(instaGameId, {
        team1PlayerIds,
        team2PlayerIds
      })
      await fetchInstaGame()
      return match
    } catch (err) {
      console.error('Error creating match:', err)
      throw err
    }
  }, [instaGameId, fetchInstaGame])

  const generateNextMatch = useCallback(async () => {
    try {
      const response = await instaGameService.generateNextMatch(instaGameId)
      await fetchInstaGame()
      return response
    } catch (err) {
      console.error('Error generating next match:', err)
      throw err
    }
  }, [instaGameId, fetchInstaGame])

  const startMatch = useCallback(async (matchId) => {
    try {
      await instaGameService.startMatch(instaGameId, matchId)
      await fetchInstaGame()
    } catch (err) {
      console.error('Error starting match:', err)
      throw err
    }
  }, [instaGameId, fetchInstaGame])

  const updateScore = useCallback(async (matchId, team1Score, team2Score) => {
    try {
      await instaGameService.updateScore(instaGameId, matchId, {
        team1Score,
        team2Score
      })
      // Optimistic update
      setInstaGame(prev => {
        if (!prev || !prev.currentMatch || prev.currentMatch.id !== matchId) return prev
        return {
          ...prev,
          currentMatch: {
            ...prev.currentMatch,
            team1Score,
            team2Score
          }
        }
      })
    } catch (err) {
      console.error('Error updating score:', err)
      throw err
    }
  }, [instaGameId])

  const completeMatch = useCallback(async (matchId, team1Score, team2Score, winningTeam) => {
    try {
      const match = await instaGameService.completeMatch(instaGameId, matchId, {
        team1Score,
        team2Score,
        winningTeam
      })
      await fetchInstaGame()
      return match
    } catch (err) {
      console.error('Error completing match:', err)
      throw err
    }
  }, [instaGameId, fetchInstaGame])

  const joinQueue = useCallback(async (team1PlayerIds, team2PlayerIds = null, queueType = 'Standard') => {
    try {
      const queueItem = await instaGameService.addToQueue(instaGameId, {
        team1PlayerIds,
        team2PlayerIds,
        queueType
      })
      await fetchInstaGame()
      return queueItem
    } catch (err) {
      console.error('Error joining queue:', err)
      throw err
    }
  }, [instaGameId, fetchInstaGame])

  const leaveQueue = useCallback(async (queueId) => {
    try {
      await instaGameService.removeFromQueue(instaGameId, queueId)
      await fetchInstaGame()
    } catch (err) {
      console.error('Error leaving queue:', err)
      throw err
    }
  }, [instaGameId, fetchInstaGame])

  const updateStatus = useCallback(async (status) => {
    try {
      await instaGameService.updateStatus(instaGameId, status)
      // Optimistic update
      setInstaGame(prev => {
        if (!prev || !prev.myPlayerInfo) return prev
        return {
          ...prev,
          myPlayerInfo: {
            ...prev.myPlayerInfo,
            status
          },
          players: prev.players.map(p =>
            p.userId === prev.myPlayerInfo.userId ? { ...p, status } : p
          )
        }
      })
    } catch (err) {
      console.error('Error updating status:', err)
      throw err
    }
  }, [instaGameId])

  const leave = useCallback(async () => {
    try {
      await instaGameService.leave(instaGameId)
      await disconnect()
    } catch (err) {
      console.error('Error leaving game:', err)
      throw err
    }
  }, [instaGameId, disconnect])

  const startSession = useCallback(async () => {
    try {
      await instaGameService.start(instaGameId)
      await fetchInstaGame()
    } catch (err) {
      console.error('Error starting session:', err)
      throw err
    }
  }, [instaGameId, fetchInstaGame])

  const pauseSession = useCallback(async () => {
    try {
      await instaGameService.pause(instaGameId)
      await fetchInstaGame()
    } catch (err) {
      console.error('Error pausing session:', err)
      throw err
    }
  }, [instaGameId, fetchInstaGame])

  const endSession = useCallback(async () => {
    try {
      await instaGameService.end(instaGameId)
      await fetchInstaGame()
    } catch (err) {
      console.error('Error ending session:', err)
      throw err
    }
  }, [instaGameId, fetchInstaGame])

  return {
    // State
    instaGame,
    players,
    currentMatch,
    recentMatches,
    queue,
    myPlayerInfo,
    loading,
    error,
    connectionState,
    isConnected: connectionState === 'connected',

    // Computed
    isCreator: instaGame?.isCreator || false,
    isOrganizer: instaGame?.isOrganizer || false,
    isPlayer: instaGame?.isPlayer || false,

    // Actions
    refresh,
    createMatch,
    generateNextMatch,
    startMatch,
    updateScore,
    completeMatch,
    joinQueue,
    leaveQueue,
    updateStatus,
    leave,
    startSession,
    pauseSession,
    endSession
  }
}

export default useInstaGame
