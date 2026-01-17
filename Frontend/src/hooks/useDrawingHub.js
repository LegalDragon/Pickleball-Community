import { useState, useEffect, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from '../services/api';

/**
 * Hook for connecting to the live drawing SignalR hub
 * Supports both division-level drawing (for spectators) and event-level drawing (for Drawing Monitor)
 */
export function useDrawingHub() {
  const [connection, setConnection] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [drawingState, setDrawingState] = useState(null);
  const [viewers, setViewers] = useState([]);
  const [divisionStates, setDivisionStates] = useState({});
  const [countdownDivisionId, setCountdownDivisionId] = useState(null); // Division that just started drawing (for countdown)
  const [fanfareEvent, setFanfareEvent] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionEndedMessage, setSessionEndedMessage] = useState(null);
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

    // Always provide accessTokenFactory that reads token at connection time
    // This ensures auth works even if token is set after hook initialization
    const connectionBuilder = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => localStorage.getItem('jwtToken') || ''
      })
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

    // Set up division-level drawing event handlers
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

    // Set up event-level drawing event handlers (for Drawing Monitor page)
    newConnection.on('EventDrawingStarted', (data) => {
      console.log('DrawingHub: Event drawing started', data);
      setDivisionStates(prev => ({
        ...prev,
        [data.divisionId]: {
          ...data.state,
          drawingInProgress: true
        }
      }));
      // Trigger countdown for all viewers
      setCountdownDivisionId(data.divisionId);
    });

    newConnection.on('EventUnitDrawn', (data) => {
      console.log('DrawingHub: Event unit drawn', data);
      setDivisionStates(prev => {
        const divState = prev[data.divisionId];
        if (!divState) return prev;
        return {
          ...prev,
          [data.divisionId]: {
            ...divState,
            drawnCount: divState.drawnCount + 1,
            drawnUnits: [...(divState.drawnUnits || []), data.drawnUnit],
            remainingUnitNames: (divState.remainingUnitNames || []).filter(name => name !== data.drawnUnit.unitName)
          }
        };
      });
    });

    newConnection.on('EventDrawingCompleted', (data) => {
      console.log('DrawingHub: Event drawing completed', data);
      setDivisionStates(prev => ({
        ...prev,
        [data.divisionId]: {
          ...prev[data.divisionId],
          drawingInProgress: false,
          drawnUnits: data.result.finalOrder,
          scheduleStatus: 'UnitsAssigned'
        }
      }));
    });

    newConnection.on('EventDrawingCancelled', (data) => {
      console.log('DrawingHub: Event drawing cancelled', data);
      setDivisionStates(prev => ({
        ...prev,
        [data.divisionId]: {
          ...prev[data.divisionId],
          drawingInProgress: false,
          drawnCount: 0,
          drawnUnits: [],
          scheduleStatus: 'NotGenerated', // Reset so drawing can start again
          remainingUnitNames: prev[data.divisionId]?.remainingUnitNames || []
        }
      }));
    });

    // Set up viewer list updates
    newConnection.on('ViewersUpdated', (viewerList) => {
      console.log('DrawingHub: Viewers updated', viewerList);
      setViewers(viewerList);
    });

    // Division fanfare - triggered when any division completes drawing
    newConnection.on('DivisionFanfare', (data) => {
      console.log('DrawingHub: Division fanfare', data);
      setFanfareEvent({
        divisionId: data.divisionId,
        divisionName: data.divisionName,
        timestamp: Date.now()
      });
      // Auto-clear fanfare after 5 seconds
      setTimeout(() => setFanfareEvent(null), 5000);
    });

    // Drawing session ended - admin has ended the drawing session
    newConnection.on('DrawingSessionEnded', (data) => {
      console.log('DrawingHub: Drawing session ended', data);
      setSessionEnded(true);
      setSessionEndedMessage(data.message);
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
      setViewers([]);
      setDivisionStates({});
    }
  }, []);

  // Join a division drawing room (for WatchDrawingModal)
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

  // Join an event drawing room (for Drawing Monitor page)
  const joinEventDrawing = useCallback(async (eventId, displayName, avatarUrl) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('JoinEventDrawing', eventId, displayName || null, avatarUrl || null);
        console.log('DrawingHub: Joined event drawing for event', eventId);
        return true;
      } catch (err) {
        console.error('DrawingHub: Error joining event drawing:', err);
        return false;
      }
    }
    return false;
  }, []);

  // Leave an event drawing room
  const leaveEventDrawing = useCallback(async (eventId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('LeaveEventDrawing', eventId);
        console.log('DrawingHub: Left event drawing for event', eventId);
        setViewers([]);
        setDivisionStates({});
        return true;
      } catch (err) {
        console.error('DrawingHub: Error leaving event drawing:', err);
        return false;
      }
    }
    return false;
  }, []);

  // Initialize division states from API data
  const initializeDivisionStates = useCallback((divisions) => {
    const states = {};
    divisions.forEach(div => {
      states[div.divisionId] = div;
    });
    setDivisionStates(states);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, []);

  // Clear countdown (called after countdown finishes)
  const clearCountdown = useCallback(() => {
    setCountdownDivisionId(null);
  }, []);

  // Clear fanfare event
  const clearFanfare = useCallback(() => {
    setFanfareEvent(null);
  }, []);

  // Reset session ended state
  const resetSessionEnded = useCallback(() => {
    setSessionEnded(false);
    setSessionEndedMessage(null);
  }, []);

  return {
    connection,
    connectionState,
    drawingState,
    setDrawingState,
    viewers,
    divisionStates,
    initializeDivisionStates,
    countdownDivisionId,
    clearCountdown,
    connect,
    disconnect,
    joinDrawingRoom,
    leaveDrawingRoom,
    joinEventDrawing,
    leaveEventDrawing,
    isConnected: connectionState === 'connected',
    // New fanfare and session end state
    fanfareEvent,
    clearFanfare,
    sessionEnded,
    sessionEndedMessage,
    resetSessionEnded
  };
}

// Drawing event names for type safety
export const DrawingEvents = {
  DrawingStarted: 'DrawingStarted',
  UnitDrawn: 'UnitDrawn',
  DrawingCompleted: 'DrawingCompleted',
  DrawingCancelled: 'DrawingCancelled',
  EventDrawingStarted: 'EventDrawingStarted',
  EventUnitDrawn: 'EventUnitDrawn',
  EventDrawingCompleted: 'EventDrawingCompleted',
  EventDrawingCancelled: 'EventDrawingCancelled',
  ViewersUpdated: 'ViewersUpdated',
  DivisionFanfare: 'DivisionFanfare',
  DrawingSessionEnded: 'DrawingSessionEnded'
};
