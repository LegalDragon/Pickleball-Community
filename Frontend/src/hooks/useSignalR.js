import { useState, useEffect, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from '../services/api';

export function useSignalR() {
  const [connection, setConnection] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const connectionRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Build SignalR hub URL
  const getHubUrl = useCallback(() => {
    const baseUrl = API_BASE_URL || window.location.origin;
    return `${baseUrl}/hubs/chat`;
  }, []);

  // Create connection
  const createConnection = useCallback(() => {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
      console.log('SignalR: No token available, skipping connection');
      return null;
    }

    const hubUrl = getHubUrl();
    console.log('SignalR: Creating connection to', hubUrl);

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

  // Connect to SignalR hub
  const connect = useCallback(async () => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      console.log('SignalR: Already connected');
      return connectionRef.current;
    }

    const newConnection = createConnection();
    if (!newConnection) {
      return null;
    }

    // Set up connection state change handlers
    newConnection.onreconnecting((error) => {
      console.log('SignalR: Reconnecting...', error);
      setConnectionState('reconnecting');
    });

    newConnection.onreconnected((connectionId) => {
      console.log('SignalR: Reconnected with ID:', connectionId);
      setConnectionState('connected');
      reconnectAttempts.current = 0;
    });

    newConnection.onclose((error) => {
      console.log('SignalR: Connection closed', error);
      setConnectionState('disconnected');
      connectionRef.current = null;
      setConnection(null);
    });

    try {
      setConnectionState('connecting');
      await newConnection.start();
      console.log('SignalR: Connected successfully');
      setConnectionState('connected');
      connectionRef.current = newConnection;
      setConnection(newConnection);
      reconnectAttempts.current = 0;
      return newConnection;
    } catch (err) {
      console.error('SignalR: Connection failed:', err);
      setConnectionState('disconnected');
      return null;
    }
  }, [createConnection]);

  // Disconnect from SignalR hub
  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      try {
        await connectionRef.current.stop();
        console.log('SignalR: Disconnected');
      } catch (err) {
        console.error('SignalR: Error disconnecting:', err);
      }
      connectionRef.current = null;
      setConnection(null);
      setConnectionState('disconnected');
    }
  }, []);

  // Subscribe to events
  const on = useCallback((eventName, callback) => {
    if (connectionRef.current) {
      connectionRef.current.on(eventName, callback);
    }
  }, []);

  // Unsubscribe from events
  const off = useCallback((eventName, callback) => {
    if (connectionRef.current) {
      connectionRef.current.off(eventName, callback);
    }
  }, []);

  // Invoke hub method
  const invoke = useCallback(async (methodName, ...args) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        return await connectionRef.current.invoke(methodName, ...args);
      } catch (err) {
        console.error(`SignalR: Error invoking ${methodName}:`, err);
        throw err;
      }
    } else {
      console.warn('SignalR: Cannot invoke method, not connected');
      throw new Error('Not connected to SignalR hub');
    }
  }, []);

  // Join a conversation group
  const joinConversation = useCallback(async (conversationId) => {
    return invoke('JoinConversation', conversationId);
  }, [invoke]);

  // Leave a conversation group
  const leaveConversation = useCallback(async (conversationId) => {
    return invoke('LeaveConversation', conversationId);
  }, [invoke]);

  // Send typing indicator
  const sendTyping = useCallback(async (conversationId, isTyping) => {
    return invoke('SendTyping', conversationId, isTyping);
  }, [invoke]);

  // Mark messages as read
  const markRead = useCallback(async (conversationId) => {
    return invoke('MarkRead', conversationId);
  }, [invoke]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, []);

  return {
    connection,
    connectionState,
    connect,
    disconnect,
    on,
    off,
    invoke,
    joinConversation,
    leaveConversation,
    sendTyping,
    markRead,
    isConnected: connectionState === 'connected'
  };
}

// SignalR event names for type safety
export const SignalREvents = {
  ReceiveMessage: 'ReceiveMessage',
  MessageEdited: 'MessageEdited',
  MessageDeleted: 'MessageDeleted',
  MessageRead: 'MessageRead',
  UserTyping: 'UserTyping',
  UserOnlineStatus: 'UserOnlineStatus'
};
