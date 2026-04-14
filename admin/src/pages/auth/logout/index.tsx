import { logoutRoute } from "@/constants/api";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";

export default function Logout() {
  const { logout } = useAuth0();

  useEffect(() => {
    const handleLogout = async () => {
      try {
        await axiosInstance.post(logoutRoute);
      } catch (error) {
        console.error("Logout error:", error);
      }

      // Auth0 logout — clears session and redirects
      logout({ logoutParams: { returnTo: window.location.origin + "/login" } });
    };

    handleLogout();
  }, [logout]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <p>Logging out...</p>
    </div>
  );
}
