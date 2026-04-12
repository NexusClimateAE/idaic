import { useAuth as useAuthContext } from '../context/AuthContext';

/**
 * Compatibility hook that wraps the new AuthContext.
 * Use this to avoid breaking existing components while refactoring.
 */
export function useAuth() {
  const { user, isAuthenticated, loading, logout, refresh } = useAuthContext();
  
  // Return the same interface as before, but backed by Context
  return { 
    session: user, // Mapping user to session for legacy compatibility
    loading, 
    user,
    isAuthenticated,
    logout,
    refresh,
    getAuthToken: async () => {
      // Logic moved to context if needed, but keeping interface for now
      return localStorage.getItem('idaic-token');
    }
  };
}
