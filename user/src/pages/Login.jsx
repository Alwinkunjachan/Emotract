import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import styled from "styled-components";
import Logo from "../assets/logo.svg";

export default function Login() {
  const navigate = useNavigate();
  const { loginWithRedirect, isAuthenticated, isLoading, error } = useAuth0();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Auto-redirect to Auth0 only once, skip if processing callback
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasRedirected.current) {
      const params = new URLSearchParams(window.location.search);

      // If Auth0 returned an error (e.g., user declined consent), don't auto-redirect
      if (params.has("error")) {
        return;
      }

      // If processing a valid callback, let Auth0 SDK handle it
      if (params.has("code") || params.has("state")) {
        return;
      }

      hasRedirected.current = true;
      loginWithRedirect();
    }
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  const handleTryAgain = () => {
    // Clear URL params and restart login flow
    window.history.replaceState({}, document.title, "/login");
    hasRedirected.current = false;
    loginWithRedirect();
  };

  if (isLoading) {
    return (
      <Container>
        <div className="brand">
          <img src={Logo} className="w-15" alt="logo" />
          <h1 className="text-red-200">Emotract v1</h1>
        </div>
        <p>Loading...</p>
      </Container>
    );
  }

  // Check for Auth0 error OR URL error param (e.g., consent denied)
  const urlParams = new URLSearchParams(window.location.search);
  const urlError = urlParams.get("error_description") || urlParams.get("error");
  const displayError = error?.message || urlError;

  return (
    <Container>
      <div className="brand">
        <img src={Logo} className="w-15" alt="logo" />
        <h1 className="text-red-200">Emotract v1</h1>
      </div>
      {displayError ? (
        <>
          <p style={{ color: "#ff6b6b" }}>Login error: {displayError}</p>
          <button onClick={handleTryAgain}>Try Again</button>
        </>
      ) : (
        <p>Redirecting to login...</p>
      )}
    </Container>
  );
}

const Container = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  background-color: #131324;
  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
    img {
      height: 5rem;
    }
    h1 {
      color: white;
      text-transform: uppercase;
    }
  }
  p {
    color: white;
    font-size: 1.2rem;
  }
  button {
    background-color: #4e0eff;
    color: white;
    padding: 0.8rem 2rem;
    border: none;
    font-weight: bold;
    cursor: pointer;
    border-radius: 0.4rem;
    font-size: 1rem;
    text-transform: uppercase;
    &:hover {
      background-color: #6b3fff;
    }
  }
`;
