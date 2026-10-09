import { Navigate, Outlet } from 'react-router-dom';
import { getSession } from './api';

// Wrap every page except /login:
//   <Route element={<ProtectedRoute />}> <Route path="/" element={<Dashboard/>} /> ... </Route>
// Pass roles to restrict a page: <ProtectedRoute roles={['admin','supervisor']} />
export default function ProtectedRoute({ roles }: { roles?: Array<'guard' | 'supervisor' | 'admin'> }) {
  const s = getSession();
  if (!s) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(s.user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
