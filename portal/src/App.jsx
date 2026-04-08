import "./index.css";
import React, { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Idaic from "./components/idaic";
import DisclaimerPopup from "./components/DisclaimerPopup";
import { useAuth } from './context/AuthContext';

export default function App() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // Initialize currentPage from URL
  const [currentPage, setCurrentPage] = useState(() => {
    const pathname = location.pathname;
    if (pathname === '/app' || pathname === '/app/') return 'home';
    if (pathname === '/app/users') return 'portal-admin';
    return pathname.split('/').pop() || 'home';
  });

  // Sync sidebar highlight with URL
  useEffect(() => {
    const pathname = location.pathname;
    const urlToPageMap = {
      '/app': 'home',
      '/app/': 'home',
      '/app/users': 'portal-admin',
      '/app/portal-admin': 'portal-admin',
      '/app/events-admin': 'events-admin'
    };
    const mappedPage = urlToPageMap[pathname] || pathname.split('/').pop();
    if (currentPage !== mappedPage) {
      setCurrentPage(mappedPage);
    }
  }, [location.pathname, currentPage]);

  // Check disclaimer status
  useEffect(() => {
    if (user && isAuthenticated) {
      const checkDisclaimer = async () => {
        try {
          const response = await fetch(`/.netlify/functions/disclaimerAcceptance?userId=${user.id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.needsDisclaimer) setShowDisclaimer(true);
          }
        } catch (err) {
          console.error('Disclaimer check failed', err);
        }
      };
      checkDisclaimer();
    }
  }, [user, isAuthenticated]);

  const handleDisclaimerAccept = async () => {
    try {
      localStorage.setItem('idaic-disclaimer-accepted', 'true');
      await fetch('/.netlify/functions/disclaimerAcceptance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, email: user?.email })
      });
      setShowDisclaimer(false);
      navigate('/app/settings');
    } catch (err) {
      setShowDisclaimer(false);
      navigate('/app/settings');
    }
  };

  // If we reach this point, ProtectedRoute has already verified auth.
  // We only show loading if the AuthContext is still initializing.
  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Checking security...</div>;

  return (
    <div className="flex h-svh w-screen overflow-hidden">
      <DisclaimerPopup 
        isOpen={showDisclaimer} 
        onAccept={handleDisclaimerAccept} 
        onDecline={logout} 
        onNavigateToFeedback={() => navigate('/app/feedback')} 
      />
      
      <Idaic 
        onPageChange={(page) => {
          setCurrentPage(page);
          if (page === 'home') navigate('/app');
          else if (page === 'portal-admin') navigate('/app/users');
          else navigate(`/app/${page}`);
        }} 
        currentPage={currentPage}
        user={user}
      />
      
      <main className="flex-1 bg-gray-50 p-10 h-full overflow-y-auto min-h-0">
        <Outlet context={{ user, isAuthenticated }} />
      </main>
    </div>
  );
}
