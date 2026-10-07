import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AnimatePresence } from 'motion/react';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { PurchaseInPage } from './pages/PurchaseInPage';
import { MaterialOutPage } from './pages/MaterialOutPage';
import { MaterialReturnPage } from './pages/MaterialReturnPage';
import { PrinterSettingsPage } from './pages/PrinterSettingsPage';
import { EntryDetailPage } from './pages/EntryDetailPage';
import { RegisterPage } from './pages/RegisterPage';
import { PendingPage } from './pages/PendingPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPage } from './pages/AdminPage';
import { UsersPage } from './pages/UsersPage';
import { LoginPage } from './pages/LoginPage';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, login } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);

  // Mobile users do not have to login with web
  React.useEffect(() => {
    if (!loading && !user && !autoLoggingIn) {
      const isMobile = typeof window !== 'undefined' && (
        window.innerWidth < 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      );
      if (isMobile) {
        setAutoLoggingIn(true);
        login('guard', 'guard123', 'Mobile Terminal', 'tablet')
          .catch(() => {})
          .finally(() => setAutoLoggingIn(false));
      }
    }
  }, [loading, user, autoLoggingIn, login]);

  if (loading || autoLoggingIn) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center text-[#5f6b7a] text-sm">
        <span className="animate-spin mr-2">🔄</span> Loading Gate Terminal...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#1b1f24] flex">
      {/* Side Menubar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area (Offset by Sidebar on Desktop) */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 min-h-screen">
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 px-4 sm:px-6 py-4 sm:py-5 w-full">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <React.Fragment key={location.pathname}>
                {children}
              </React.Fragment>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedLayout>
                  <DashboardPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/in"
              element={<Navigate to="/purchase-in" replace />}
            />
            <Route
              path="/material-in"
              element={<Navigate to="/purchase-in" replace />}
            />
            <Route
              path="/purchase-in"
              element={
                <ProtectedLayout>
                  <PurchaseInPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/in/purchaser"
              element={<Navigate to="/purchase-in" replace />}
            />
            <Route
              path="/purchase"
              element={<Navigate to="/purchase-in" replace />}
            />
            <Route
              path="/out"
              element={
                <ProtectedLayout>
                  <MaterialOutPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/return"
              element={
                <ProtectedLayout>
                  <MaterialReturnPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/settings/printer"
              element={
                <ProtectedLayout>
                  <PrinterSettingsPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/printer"
              element={<Navigate to="/settings/printer" replace />}
            />
            <Route
              path="/settings"
              element={<Navigate to="/settings/printer" replace />}
            />
            <Route
              path="/e/:code"
              element={
                <ProtectedLayout>
                  <EntryDetailPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/register"
              element={
                <ProtectedLayout>
                  <RegisterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/pending"
              element={
                <ProtectedLayout>
                  <PendingPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedLayout>
                  <ReportsPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedLayout>
                  <UsersPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedLayout>
                  <AdminPage />
                </ProtectedLayout>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </SettingsProvider>
  );
}
