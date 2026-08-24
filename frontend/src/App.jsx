import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import PortalLayout from './layouts/PortalLayout';

import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';

import AdminDashboard from './pages/admin/AdminDashboard';
import CreateId from './pages/admin/CreateId';
import SignupRequests from './pages/admin/SignupRequests';
import UserManagement from './pages/admin/UserManagement';
import AdminQrScanner from './pages/admin/AdminQrScanner';
import AdminBarcodeScanner from './pages/admin/AdminBarcodeScanner';
import QrBrandDetails from './pages/admin/QrBrandDetails';

import SubAdminDashboard from './pages/subadmin/SubAdminDashboard';
import VendorDashboard from './pages/vendor/VendorDashboard';
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import QRCodeGenerator from './pages/QRCodeGenerator';
import RecoverySheet from './pages/recovery/RecoverySheet';

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
            element={<LandingPage />}
          />

          <Route
            element={
              <ProtectedRoute roles={['admin']} />
            }
          >
            <Route
              path="/admin"
              element={<PortalLayout />}
            >
              <Route
                index
                element={<AdminDashboard />}
              />

              <Route
                path="create-id"
                element={<CreateId />}
              />

              <Route
                path="users"
                element={<UserManagement />}
              />

              <Route
                path="signup-requests"
                element={<SignupRequests />}
              />

              <Route
                path="qr-generator"
                element={<QRCodeGenerator />}
              />

              <Route
                path="qr-scanner"
                element={<AdminQrScanner />}
              />

              <Route
                path="qr-brand-details"
                element={<QrBrandDetails />}
              />

              <Route
                path="barcode-scanner"
                element={<AdminBarcodeScanner />}
              />

              <Route
                path="recovery-sheets"
                element={<RecoverySheet />}
              />
            </Route>
          </Route>

          <Route
            element={
              <ProtectedRoute roles={['subadmin']} />
            }
          >
            <Route
              path="/sub-admin"
              element={<PortalLayout />}
            >
              <Route
                index
                element={<SubAdminDashboard />}
              />

              <Route
                path="create-id"
                element={<CreateId />}
              />

              <Route
                path="signup-requests"
                element={<SignupRequests />}
              />

              <Route
                path="users"
                element={<UserManagement />}
              />

              <Route
                path="qr-generator"
                element={<QRCodeGenerator />}
              />

              <Route
                path="qr-scanner"
                element={<AdminQrScanner />}
              />

              <Route
                path="barcode-scanner"
                element={<AdminBarcodeScanner />}
              />

              <Route
                path="recovery-sheets"
                element={<RecoverySheet />}
              />
            </Route>
          </Route>

          <Route
            element={
              <ProtectedRoute roles={['vendor']} />
            }
          >
            <Route
              path="/vendor"
              element={<PortalLayout />}
            >
              <Route
                index
                element={<VendorDashboard />}
              />

              <Route
                path="create-id"
                element={<CreateId />}
              />

              <Route
                path="signup-requests"
                element={<SignupRequests />}
              />

              <Route
                path="users"
                element={<UserManagement />}
              />

              <Route
                path="barcode-scanner"
                element={<AdminBarcodeScanner />}
              />

              <Route
                path="recovery-sheets"
                element={<RecoverySheet />}
              />
            </Route>
          </Route>

          <Route
            element={
              <ProtectedRoute roles={['supervisor']} />
            }
          >
            <Route
              path="/supervisor"
              element={<PortalLayout />}
            >
              <Route
                index
                element={<SupervisorDashboard />}
              />

              <Route
                path="barcode-scanner"
                element={<AdminBarcodeScanner />}
              />
            </Route>
          </Route>

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
