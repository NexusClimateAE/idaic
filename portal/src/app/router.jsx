import React from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import routesConfig from './routes.json';
import { getComponent } from './routeRegistry';
import { useAuth } from '../context/AuthContext';

/**
 * A wrapper component that protects routes based on authentication 
 * and role-based access control.
 */
const ProtectedRoute = ({ children, meta = {} }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="text-gray-500 mb-4 font-medium">Checking security...</div>
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 1. Check if authentication is required
  if (meta.authRequired && !isAuthenticated) {
    console.log(`🛡️ Router Guard: Access denied to ${location.pathname}. Redirecting to login.`);
    window.location.href = `/login.html?returnTo=${encodeURIComponent(location.pathname)}`;
    return null;
  }

  // 2. Check Role-Based Access
  if (isAuthenticated && meta.roles && meta.roles.length > 0) {
    const userRole = (user?.role || 'user').toLowerCase();
    const hasRequiredRole = meta.roles.some(role => role.toLowerCase() === userRole);
    
    if (!hasRequiredRole) {
      console.warn(`🚫 Router Guard: User role [${userRole}] not authorized for ${location.pathname}`);
      return <Navigate to="/app" replace />;
    }
  }

  return children;
};

export const createRouter = () => {
  const { basePath, routes } = routesConfig;

  // Transform JSON routes into React Router objects
  const childRoutes = routes
    .filter(r => r.path.startsWith(basePath) && r.path !== basePath)
    .map(route => {
      // FIX: Only call getComponent if there is no redirect
      if (route.redirectTo) {
        return {
          path: route.path.replace(basePath + '/', ''),
          element: <Navigate to={route.redirectTo} replace />
        };
      }

      const Component = getComponent(route.component);
      return {
        path: route.path.replace(basePath + '/', ''),
        element: (
          <ProtectedRoute meta={route.meta || {}}>
            <Component />
          </ProtectedRoute>
        )
      };
    });

  const AppLayout = getComponent('App');
  const HomeComponent = getComponent('Home');
  
  const routerConfig = [
    {
      path: '/',
      element: <Navigate to={basePath} replace />
    },
    {
      path: basePath,
      element: (
        <ProtectedRoute meta={{ authRequired: true }}>
          <AppLayout />
        </ProtectedRoute>
      ),
      children: [
        { 
          index: true, 
          element: (
            <ProtectedRoute meta={{ authRequired: true }}>
              <HomeComponent />
            </ProtectedRoute>
          ) 
        },
        ...childRoutes
      ]
    },
    ...routes.filter(r => !r.path.startsWith(basePath) && r.component).map(r => {
      const Component = getComponent(r.component);
      return {
        path: r.path,
        element: (
          <ProtectedRoute meta={r.meta || {}}>
            <Component />
          </ProtectedRoute>
        )
      };
    }),
    {
      path: '*',
      element: <Navigate to={basePath} replace />
    }
  ];

  return createBrowserRouter(routerConfig);
};
