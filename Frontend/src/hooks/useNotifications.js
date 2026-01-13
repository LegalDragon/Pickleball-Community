import { useState, useEffect, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from '../services/api';

/**
 * Custom hook for managing real-time notifications via SignalR
 *
 * Usage:
 * const { notifications, unreadCount, connect, disconnect, isConnected } = useNotifications();
 *
 * // Connect when user logs in
 * useEffect(() => {
 *   if (user) {
 *     connect();
 *   } else {
 *     disconnect();
 *   }
 * }, [user]);
 */
export function useNotifications() {
  const [connection, setConnection] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const connectionRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const listenersRef = useRef([]);

  // Build SignalR hub URL
  const getHubUrl = useCallback(() => {
    const baseUrl = API_BASE_URL || window.location.origin;
    return `${baseUrl}/hubs/notifications`;
  }, []);

  // Create connection
  const createConnection = useCallback(() => {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
      console.log('Notifications: No token available, skipping connection');
      return null;
    }

    const hubUrl = getHubUrl();
    console.log('Notifications: Creating connection to', hubUrl);

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 0, 2, 4, 8, 16, 30 seconds
          if (retryContext.previousRetryCount >= maxReconnectAttempts) {
            return null; // Stop reconnecting
          }
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    return newConnection;
  }, [getHubUrl]);

  // Connect to notification hub
  const connect = useCallback(async () => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      console.log('Notifications: Already connected');
      return connectionRef.current;
    }

    const newConnection = createConnection();
    if (!newConnection) {
      return null;
    }

    // Set up connection state change handlers
    newConnection.onreconnecting((error) => {
      console.log('Notifications: Reconnecting...', error);
      setConnectionState('reconnecting');
    });

    newConnection.onreconnected((connectionId) => {
      console.log('Notifications: Reconnected with ID:', connectionId);
      setConnectionState('connected');
      reconnectAttempts.current = 0;
    });

    newConnection.onclose((error) => {
      console.log('Notifications: Connection closed', error);
      setConnectionState('disconnected');
      connectionRef.current = null;
      setConnection(null);
    });

    // Listen for notifications
    newConnection.on('ReceiveNotification', (notification) => {
      console.log('Notifications: Received', notification);
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Call all registered listeners
      listenersRef.current.forEach(listener => {
        try {
          listener(notification);
        } catch (e) {
          console.error('Notification listener error:', e);
        }
      });
    });

    try {
      setConnectionState('connecting');
      await newConnection.start();
      console.log('Notifications: Connected successfully');
      setConnectionState('connected');
      connectionRef.current = newConnection;
      setConnection(newConnection);
      reconnectAttempts.current = 0;
      return newConnection;
    } catch (err) {
      console.error('Notifications: Connection failed:', err);
      setConnectionState('disconnected');
      return null;
    }
  }, [createConnection]);

  // Disconnect from notification hub
  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      try {
        await connectionRef.current.stop();
        console.log('Notifications: Disconnected');
      } catch (err) {
        console.error('Notifications: Error disconnecting:', err);
      }
      connectionRef.current = null;
      setConnection(null);
      setConnectionState('disconnected');
    }
  }, []);

  // Add notification listener
  const addListener = useCallback((callback) => {
    listenersRef.current.push(callback);
    return () => {
      listenersRef.current = listenersRef.current.filter(cb => cb !== callback);
    };
  }, []);

  // Clear a specific notification
  const clearNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Mark notifications as read (updates local count only - use API to persist)
  const markAsRead = useCallback((count = 1) => {
    setUnreadCount(prev => Math.max(0, prev - count));
  }, []);

  // Set initial unread count (from API)
  const setInitialUnreadCount = useCallback((count) => {
    setUnreadCount(count);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, []);

  // Join a game group to receive score updates
  const joinGame = useCallback(async (gameId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('JoinGameGroup', gameId);
        console.log(`Joined game group: ${gameId}`);
      } catch (err) {
        console.error('Error joining game group:', err);
      }
    }
  }, []);

  // Leave a game group
  const leaveGame = useCallback(async (gameId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('LeaveGameGroup', gameId);
        console.log(`Left game group: ${gameId}`);
      } catch (err) {
        console.error('Error leaving game group:', err);
      }
    }
  }, []);

  // Join an event group
  const joinEvent = useCallback(async (eventId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('JoinEventGroup', eventId);
        console.log(`Joined event group: ${eventId}`);
      } catch (err) {
        console.error('Error joining event group:', err);
      }
    }
  }, []);

  // Leave an event group
  const leaveEvent = useCallback(async (eventId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('LeaveEventGroup', eventId);
        console.log(`Left event group: ${eventId}`);
      } catch (err) {
        console.error('Error leaving event group:', err);
      }
    }
  }, []);

  // Join a club group
  const joinClub = useCallback(async (clubId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('JoinClubGroup', clubId);
        console.log(`Joined club group: ${clubId}`);
      } catch (err) {
        console.error('Error joining club group:', err);
      }
    }
  }, []);

  // Leave a club group
  const leaveClub = useCallback(async (clubId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('LeaveClubGroup', clubId);
        console.log(`Left club group: ${clubId}`);
      } catch (err) {
        console.error('Error leaving club group:', err);
      }
    }
  }, []);

  return {
    connection,
    connectionState,
    notifications,
    unreadCount,
    connect,
    disconnect,
    addListener,
    clearNotification,
    clearAll,
    markAsRead,
    setInitialUnreadCount,
    isConnected: connectionState === 'connected',
    // Group methods
    joinGame,
    leaveGame,
    joinEvent,
    leaveEvent,
    joinClub,
    leaveClub
  };
}

// SignalR event names
export const NotificationEvents = {
  ReceiveNotification: 'ReceiveNotification'
};

export default useNotifications;
