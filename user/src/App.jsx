import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import SetAvatar from "./components/SetAvatar";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import CompleteProfile from "./pages/CompleteProfile";
import PrivateRoute from "./utils/PrivateRoute";
import { setTokenGetter } from "./utils/axiosInstance";

function App() {
  const { getAccessTokenSilently } = useAuth0();

  // Wire up axiosInstance to use Auth0 tokens
  useEffect(() => {
    setTokenGetter(getAccessTokenSilently);
  }, [getAccessTokenSilently]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateRoute />}>
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/setAvatar" element={<SetAvatar />} />
        <Route path="/" element={<Chat />} />
      </Route>
    </Routes>
  );
}

export default App;
