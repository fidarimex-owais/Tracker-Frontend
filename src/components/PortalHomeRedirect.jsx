import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { roleHome } from '../auth/roleHome';

export default function PortalHomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(user.role)} replace />;
}
