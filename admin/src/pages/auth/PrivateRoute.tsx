import { ReactNode, useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import axiosInstance from '@/utils/axiosInstance';

interface PrivateRouteProps {
  children?: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const { data } = await axiosInstance.get('/auth/me');
        if (data.status && data.user) {
          setIsAdmin(data.user.role === 'ADMIN');
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      }
    };

    if (isAuthenticated) {
      checkAdminRole();
    }
  }, [isAuthenticated]);

  if (isLoading || (isAuthenticated && isAdmin === null)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground">You do not have admin privileges.</p>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};

export default PrivateRoute;
