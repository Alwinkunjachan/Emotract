import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SignInPage() {
  const navigate = useNavigate();
  const { loginWithRedirect, isAuthenticated, isLoading, error } = useAuth0();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasRedirected.current) {
      const params = new URLSearchParams(window.location.search);
      if (params.has('error')) return;
      if (params.has('code') || params.has('state')) return;

      hasRedirected.current = true;
      loginWithRedirect();
    }
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  const handleTryAgain = () => {
    window.history.replaceState({}, document.title, '/login');
    hasRedirected.current = false;
    loginWithRedirect();
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const urlParams = new URLSearchParams(window.location.search);
  const urlError = urlParams.get('error_description') || urlParams.get('error');
  const displayError = error?.message || urlError;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Emotract Admin</h2>
      {displayError ? (
        <>
          <p className="text-destructive">Login error: {displayError}</p>
          <button
            className="mt-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={handleTryAgain}
          >
            Try Again
          </button>
        </>
      ) : (
        <p className="text-muted-foreground">Redirecting to login...</p>
      )}
    </div>
  );
}
