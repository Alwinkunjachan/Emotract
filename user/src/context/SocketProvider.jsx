import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { host } from "../utils/axiosInstance";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  const connect = useCallback(() => {
    // Only connect if not already connected
    if (socketRef.current?.connected) return;

    const newSocket = io(host, {
      withCredentials: true,
    });
    socketRef.current = newSocket;
    setSocket(newSocket);
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
  }, []);

  // Cleanup on unmount (tab close)
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connect, disconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  return context?.socket ?? null;
};

export const useSocketActions = () => {
  const context = useContext(SocketContext);
  return { connect: context?.connect, disconnect: context?.disconnect };
};
