import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRoles = ['admin', 'user'] }) => {
  const [currentUser, setCurrentUser] = useState(undefined);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/me`, {
      credentials: 'same-origin',
      signal: controller.signal
    }).then(async response => setCurrentUser(response.ok ? await response.json() : null))
      .catch(error => { if (error.name !== 'AbortError') setCurrentUser(null); });
    return () => controller.abort();
  }, []);

  if (currentUser === undefined) return <div>Verifica accesso in corso...</div>;
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to={currentUser.role === 'contabilita' ? '/contabilita/clienti' : '/admin/dashboard'} replace />;
  }

  return children;
};

export default ProtectedRoute;
