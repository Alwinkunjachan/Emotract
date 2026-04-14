import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth0 } from "@auth0/auth0-react";
import { host } from "../utils/axiosInstance";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const connectingRef = useRef(false);

  const connect = useCallback(async () => {
    // Only connect if not already connected or in progress
    if (socketRef.current?.connected || connectingRef.current) return;
    connectingRef.current = true;

    // Disconnect any stale socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    let token;
    try {
      token = await getAccessTokenSilently();
    } catch (e) {
      console.error("Cannot get token for socket:", e);
      return;
    }

    const newSocket = io(host, {
      withCredentials: true,
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      connectingRef.current = false;
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
      connectingRef.current = false;
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, [getAccessTokenSilently]);

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
