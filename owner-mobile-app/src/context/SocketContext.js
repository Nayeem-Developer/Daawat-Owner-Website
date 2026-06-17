import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/apiConfig";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

const ORDER_EVENT_NAMES = [
  "new_order",
  "order_created",
  "order_updated",
  "order_status_updated",
  "customer_order_cancelled",
  "orders_cleared",
];

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastOrderEvent, setLastOrderEvent] = useState(null);
  const [lastAppStatusEvent, setLastAppStatusEvent] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    ORDER_EVENT_NAMES.forEach((eventName) => {
      socket.on(eventName, (payload) => {
        setLastOrderEvent({
          eventName,
          payload,
          receivedAt: Date.now(),
        });
      });
    });

    socket.on("app_status_updated", (payload) => {
      setLastAppStatusEvent({
        eventName: "app_status_updated",
        payload,
        receivedAt: Date.now(),
      });
    });

    socket.connect();

    return () => {
      ORDER_EVENT_NAMES.forEach((eventName) => {
        socket.off(eventName);
      });
      socket.off("app_status_updated");
      socket.disconnect();
      setIsConnected(false);
    };
  }, [isAuthenticated, token]);

  const value = useMemo(
    () => ({
      socket: socketRef.current,
      isConnected,
      lastOrderEvent,
      lastAppStatusEvent,
    }),
    [isConnected, lastAppStatusEvent, lastOrderEvent]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used inside SocketProvider");
  }

  return context;
};
