import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import {
  AuthProvider,
} from './auth/AuthContext';

import ProtectedRoute
  from './auth/ProtectedRoute';

import PortalHomeRedirect
  from './components/PortalHomeRedirect';

import PortalLayout
  from './layouts/PortalLayout';

import Login
  from './pages/auth/Login';

import Signup
  from './pages/auth/Signup';

import AdminDashboard
  from './pages/admin/AdminDashboard';

import CreateId
  from './pages/admin/CreateId';

import ActiveIds
  from './pages/admin/ActiveIds';

import UserManagement
  from './pages/admin/UserManagement';

import SubAdminDashboard
  from './pages/subadmin/SubAdminDashboard';

import VendorDashboard
  from './pages/vendor/VendorDashboard';

import SupervisorDashboard
  from './pages/supervisor/SupervisorDashboard';

import Scanner
  from './pages/supervisor/Scanner';

import QRCodeGenerator
  from './pages/QRCodeGenerator';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/signup"
            element={<Signup />}
          />

          <Route
            path="/"
            element={
              <PortalHomeRedirect />
            }
          />

          <Route
            element={
              <ProtectedRoute
                roles={['admin']}
              />
            }
          >
            <Route
              path="/admin"
              element={
                <PortalLayout />
              }
            >
              <Route
                index
                element={
                  <AdminDashboard />
                }
              />

              <Route
                path="create-id"
                element={
                  <CreateId />
                }
              />

              <Route
                path="active-ids"
                element={
                  <ActiveIds />
                }
              />
            </Route>
          </Route>

          <Route
            element={
              <ProtectedRoute
                roles={[
                  'subadmin',
                ]}
              />
            }
          >
            <Route
              path="/sub-admin"
              element={
                <PortalLayout />
              }
            >
              <Route
                index
                element={
                  <SubAdminDashboard />
                }
              />

              <Route
                path="users"
                element={
                  <UserManagement />
                }
              />

              <Route
                path="scanner"
                element={
                  <Scanner />
                }
              />

              <Route
                path="qr-generator"
                element={
                  <QRCodeGenerator />
                }
              />
            </Route>
          </Route>

          <Route
            element={
              <ProtectedRoute
                roles={['vendor']}
              />
            }
          >
            <Route
              path="/vendor"
              element={
                <PortalLayout />
              }
            >
              <Route
                index
                element={
                  <VendorDashboard />
                }
              />

              <Route
                path="qr-generator"
                element={
                  <QRCodeGenerator />
                }
              />
            </Route>
          </Route>

          <Route
            element={
              <ProtectedRoute
                roles={[
                  'supervisor',
                ]}
              />
            }
          >
            <Route
              path="/supervisor"
              element={
                <PortalLayout />
              }
            >
              <Route
                index
                element={
                  <SupervisorDashboard />
                }
              />

              <Route
                path="scanner"
                element={
                  <Scanner />
                }
              />
            </Route>
          </Route>

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}