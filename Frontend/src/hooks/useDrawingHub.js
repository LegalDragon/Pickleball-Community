import { useState, useEffect, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from '../services/api';

/**
 * Hook for connecting to the live drawing SignalR hub
 * Allows players to watch division drawings in real-time
 */
export function useDrawingHub() {
  const [connection, setConnection] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [drawingState, setDrawingState] = useState(null);
  const connectionRef = useRef(null);
  const maxReconnectAttempts = 5;

  // Build SignalR hub URL for drawing
  const getHubUrl = useCallback(() => {
    const baseUrl = API_BASE_URL || window.location.origin;
    return `${baseUrl}/hubs/drawing`;
  }, []);

  // Create connection (doesn't require authentication - drawing is public)
  const createConnection = useCallback(() => {
    const hubUrl = getHubUrl();
    console.log('DrawingHub: Creating connection to', hubUrl);

    const token = localStorage.getItem('jwtToken');

    const connectionBuilder = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, token ? { accessTokenFactory: () => token } : {})
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.previousRetryCount >= maxReconnectAttempts) {
            return null;
          }
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    return connectionBuilder;
  }, [getHubUrl]);

  // Connect to SignalR hub
  const connect = useCallback(async () => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      console.log('DrawingHub: Already connected');
      return connectionRef.current;
    }

    const newConnection = createConnection();
    if (!newConnection) {
      return null;
    }

    // Set up connection state change handlers
    newConnection.onreconnecting((error) => {
      console.log('DrawingHub: Reconnecting...', error);
      setConnectionState('reconnecting');
    });

    newConnection.onreconnected((connectionId) => {
      console.log('DrawingHub: Reconnected with ID:', connectionId);
      setConnectionState('connected');
    });

    newConnection.onclose((error) => {
      console.log('DrawingHub: Connection closed', error);
      setConnectionState('disconnected');
      connectionRef.current = null;
      setConnection(null);
    });

    // Set up drawing event handlers
    newConnection.on('DrawingStarted', (state) => {
      console.log('DrawingHub: Drawing started', state);
      setDrawingState(state);
    });

    newConnection.on('UnitDrawn', (drawnUnit) => {
      console.log('DrawingHub: Unit drawn', drawnUnit);
      setDrawingState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          drawnCount: prev.drawnCount + 1,
          drawnUnits: [...prev.drawnUnits, drawnUnit],
          remainingUnitNames: prev.remainingUnitNames.filter(name => name !== drawnUnit.unitName)
        };
      });
    });

    newConnection.on('DrawingCompleted', (result) => {
      console.log('DrawingHub: Drawing completed', result);
      setDrawingState(prev => prev ? { ...prev, completed: true, finalOrder: result.finalOrder } : prev);
    });

    newConnection.on('DrawingCancelled', () => {
      console.log('DrawingHub: Drawing cancelled');
      setDrawingState(null);
    });

    try {
      setConnectionState('connecting');
      await newConnection.start();
      console.log('DrawingHub: Connected successfully');
      setConnectionState('connected');
      connectionRef.current = newConnection;
      setConnection(newConnection);
      return newConnection;
    } catch (err) {
      console.error('DrawingHub: Connection failed:', err);
      setConnectionState('disconnected');
      return null;
    }
  }, [createConnection]);

  // Disconnect from SignalR hub
  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      try {
        await connectionRef.current.stop();
        console.log('DrawingHub: Disconnected');
      } catch (err) {
        console.error('DrawingHub: Error disconnecting:', err);
      }
      connectionRef.current = null;
      setConnection(null);
      setConnectionState('disconnected');
      setDrawingState(null);
    }
  }, []);

  // Join a division drawing room
  const joinDrawingRoom = useCallback(async (divisionId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('JoinDrawingRoom', divisionId);
        console.log('DrawingHub: Joined drawing room for division', divisionId);
        return true;
      } catch (err) {
        console.error('DrawingHub: Error joining drawing room:', err);
        return false;
      }
    }
    return false;
  }, []);

  // Leave a division drawing room
  const leaveDrawingRoom = useCallback(async (divisionId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('LeaveDrawingRoom', divisionId);
        console.log('DrawingHub: Left drawing room for division', divisionId);
        setDrawingState(null);
        return true;
      } catch (err) {
        console.error('DrawingHub: Error leaving drawing room:', err);
        return false;
      }
    }
    return false;
  }, []);

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
    drawingState,
    connect,
    disconnect,
    joinDrawingRoom,
    leaveDrawingRoom,
    setDrawingState,
    isConnected: connectionState === 'connected'
  };
}

// Drawing event names for type safety
export const DrawingEvents = {
  DrawingStarted: 'DrawingStarted',
  UnitDrawn: 'UnitDrawn',
  DrawingCompleted: 'DrawingCompleted',
  DrawingCancelled: 'DrawingCancelled'
};
