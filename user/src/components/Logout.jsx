import React from "react";
import { BiLogOut } from "react-icons/bi";
import { useAuth0 } from "@auth0/auth0-react";
import { logoutRoute } from "../utils/APIRoutes";
import axiosInstance from "../utils/axiosInstance";
import { useSocket, useSocketActions } from "../context/SocketProvider";

export default function Logout() {
  const socket = useSocket();
  const { disconnect } = useSocketActions();
  const { logout } = useAuth0();

  const handleLogout = async () => {
    try {
      // Notify backend to update online status
      await axiosInstance.post(logoutRoute);

      // Disconnect socket
      if (socket && socket.connected) {
        socket.emit("logout");
        disconnect();
      }

      // Clear any remaining session data
      sessionStorage.removeItem("currentChat");

      // Auth0 logout — clears Auth0 session and redirects
      logout({ logoutParams: { returnTo: window.location.origin + "/login" } });
    } catch (error) {
      console.error("Logout error:", error);
      // Still perform Auth0 logout even if backend call fails
      logout({ logoutParams: { returnTo: window.location.origin + "/login" } });
    }
  };

  return (
    <button className="flex cursor-pointer w-full p-2" onClick={handleLogout}>
      <BiLogOut className="w-5 h-5 text-white" />
      <span className="ml-2 text-white">Logout</span>
    </button>
  );
}
