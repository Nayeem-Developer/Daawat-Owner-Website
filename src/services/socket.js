import { io } from "socket.io-client";
import { API_BASE_URL, TOKEN_KEY } from "./api";

let socketInstance;

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL;

export const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }

  return socketInstance;
};

export const connectSocket = () => {
  const socket = getSocket();
  const token = localStorage.getItem(TOKEN_KEY);

  socket.auth = token ? { token } : {};

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socketInstance?.connected) {
    socketInstance.disconnect();
  }
};

export const socket = getSocket();
