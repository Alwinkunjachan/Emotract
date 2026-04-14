import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import PrivateRoute from '@/pages/auth/PrivateRoute';
import FormPage from '@/pages/form';
import NotFound from '@/pages/not-found';
import { Suspense, lazy } from 'react';
import { Navigate, Outlet, useRoutes } from 'react-router-dom';
import { setTokenGetter } from '@/utils/axiosInstance';

const DashboardLayout = lazy(
  () => import('@/components/layout/dashboard-layout')
);
const SignInPage = lazy(() => import('@/pages/auth/signin'));
const Logout = lazy(() => import('@/pages/auth/logout/index'));
const DashboardPage = lazy(() => import('@/pages/dashboard'));
const StudentPage = lazy(() => import('@/pages/students'));
const StudentDetailPage = lazy(
  () => import('@/pages/students/StudentDetailPage')
);

// ----------------------------------------------------------------------

export default function AppRouter() {
  const { getAccessTokenSilently } = useAuth0();

  // Wire up axiosInstance to use Auth0 tokens
  useEffect(() => {
    setTokenGetter(getAccessTokenSilently);
  }, [getAccessTokenSilently]);

  const dashboardRoutes = [
    {
      path: '/',
      element: (
        <PrivateRoute>
          <DashboardLayout>
            <Suspense>
              <Outlet />
            </Suspense>
          </DashboardLayout>
        </PrivateRoute>
      ),
      children: [
        {
          element: <DashboardPage />,
          index: true
        },
        {
          path: 'users',
          element: <StudentPage />
        },
        {
          path: 'user/details/:id',
          element: <StudentDetailPage />
        },
        {
          path: 'form',
          element: <FormPage />
        }
      ]
    }
  ];

  const publicRoutes = [
    {
      path: '/login',
      element: <SignInPage />,
      index: true
    },
    {
      path: '/logout',
      element: <Logout />,
      index: true
    },
    {
      path: '/404',
      element: <NotFound />
    },
    {
      path: '*',
      element: <Navigate to="/404" replace />
    }
  ];

  const routes = useRoutes([...dashboardRoutes, ...publicRoutes]);

  return routes;
}
