import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userRole } = useAuth();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (allowedRole && userRole !== allowedRole && userRole !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return children;
}