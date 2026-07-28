import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/apiConfig';
import {
  getSafeOrderSocketLog,
  getOwnerRoomJoinPayload,
  joinOwnerOrderRooms,
  registerOwnerSocketListeners,
} from '../services/ownerSocketService';
import { syncTrackedOrderStatus } from '../services/liveTrackingService';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const lastJoinedRoomKeyRef = useRef('');
  const [isConnected, setIsConnected] = useState(false);
  const [lastOrderEvent, setLastOrderEvent] = useState(null);
  const [lastAppStatusEvent, setLastAppStatusEvent] = useState(null);
  const [connectionSerial, setConnectionSerial] = useState(0);

  useEffect(() => {
    if (!isConnected || !socketRef.current) {
      return;
    }

    const joinKey = JSON.stringify(getOwnerRoomJoinPayload());

    if (joinKey === lastJoinedRoomKeyRef.current) {
      return;
    }

    joinOwnerOrderRooms(socketRef.current);
    console.log('[OWNER_SOCKET] auth join sent');
    lastJoinedRoomKeyRef.current = joinKey;
  }, [isConnected]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    socketRef.current = socket;

    const cleanupListeners = registerOwnerSocketListeners(socket, {
      onConnect: () => {
        joinOwnerOrderRooms(socket);
        console.log('[OWNER_SOCKET] connected');
        console.log('[OWNER_SOCKET] auth join sent');
        lastJoinedRoomKeyRef.current = JSON.stringify(getOwnerRoomJoinPayload());
        setConnectionSerial(current => current + 1);
        setIsConnected(true);
      },
      onDisconnect: reason => {
        setIsConnected(false);
        if (__DEV__) {
          console.log('[OWNER_SOCKET] disconnected', reason);
        }
      },
      onConnectError: error => {
        if (__DEV__) {
          console.log('[OWNER_SOCKET] connect_error', error?.message || error);
        }
      },
      onOrderEvent: (eventName, payload) => {
        if (eventName === 'order_status_updated') {
          console.log(getSafeOrderSocketLog(payload));
        }
        syncTrackedOrderStatus(payload);
        setLastOrderEvent({
          eventName,
          payload,
          receivedAt: Date.now(),
        });
      },
      onAppStatusEvent: payload => {
        if (__DEV__) {
          console.log('[OWNER_SOCKET] app status updated');
        }
        setLastAppStatusEvent({
          eventName: 'app_status_updated',
          payload,
          receivedAt: Date.now(),
        });
      },
    });

    socket.connect();

    return () => {
      cleanupListeners();
      socket.disconnect();
      lastJoinedRoomKeyRef.current = '';
      setIsConnected(false);
    };
  }, [isAuthenticated, token]);

  const value = useMemo(
    () => ({
      socket: socketRef.current,
      connectionSerial,
      isConnected,
      lastOrderEvent,
      lastAppStatusEvent,
    }),
    [connectionSerial, isConnected, lastAppStatusEvent, lastOrderEvent],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error('useSocket must be used inside SocketProvider');
  }

  return context;
};
