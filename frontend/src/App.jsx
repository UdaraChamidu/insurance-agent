import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';

const AdminLayout = lazy(() => import('./components/AdminLayout'));
const PublicLayout = lazy(() => import('./components/PublicLayout'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const BlogIndexPage = lazy(() => import('./pages/BlogIndexPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const BookingsPage = lazy(() => import('./pages/BookingsPage'));
const ClientProfilePage = lazy(() => import('./pages/ClientProfilePage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const IndividualHealthInsurancePage = lazy(() => import('./pages/IndividualHealthInsurancePage'));
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const ManageAppointmentPage = lazy(() => import('./pages/ManageAppointmentPage'));
const MeetingPage = lazy(() => import('./pages/MeetingPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const ShopHealthInsurancePage = lazy(() => import('./pages/ShopHealthInsurancePage'));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4efe6] px-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white px-8 py-6 text-center shadow-[0_30px_80px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Loading</p>
        <p className="mt-3 text-base text-slate-700">Preparing the page content.</p>
      </div>
    </div>
  );
}

function LegacyAdminDashboardRedirect() {
  const [searchParams] = useSearchParams();
  const meetingId = searchParams.get('meetingId') || searchParams.get('id');

  if (!meetingId) {
    return <Navigate to="/admin/bookings" replace />;
  }

  const nextParams = new URLSearchParams(searchParams);
  nextParams.set('meetingId', meetingId);
  nextParams.set('role', 'admin');
  nextParams.delete('id');

  return <Navigate to={`/meeting?${nextParams.toString()}`} replace />;
}

function RequireAdminAuth({ children }) {
  const location = useLocation();
  const isAuthenticated = sessionStorage.getItem('adminAuth') === 'true';

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }
  return children;
}

function AdminLoginRedirectIfAuth() {
  const isAuthenticated = sessionStorage.getItem('adminAuth') === 'true';
  if (isAuthenticated) {
    return <Navigate to="/admin/bookings" replace />;
  }
  return <AdminLoginPage />;
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <Router>
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route element={<HomePage />} path="/" />
                <Route element={<AboutPage />} path="/about-us" />
                <Route element={<ShopHealthInsurancePage />} path="/shop-health-insurance" />
                <Route element={<IndividualHealthInsurancePage />} path="/individual-health-insurance" />
                <Route element={<BlogIndexPage />} path="/blog" />
                <Route element={<BlogPostPage />} path="/blog/:slug" />
                <Route element={<FaqPage />} path="/faq" />
                <Route element={<ContactPage />} path="/contact" />
                <Route element={<NotFoundPage />} path="*" />
              </Route>

              <Route element={<Navigate to="/contact" replace />} path="/intake" />
              <Route element={<SchedulePage />} path="/schedule" />
              <Route element={<MeetingPage />} path="/meeting" />
              <Route element={<ManageAppointmentPage />} path="/appointment/manage/:token" />
              <Route element={<AdminLoginRedirectIfAuth />} path="/admin/login" />

              <Route
                element={(
                  <RequireAdminAuth>
                    <AdminLayout />
                  </RequireAdminAuth>
                )}
                path="/admin"
              >
                <Route element={<Navigate to="/admin/bookings" replace />} index />
                <Route element={<BookingsPage />} path="bookings" />
                <Route element={<Navigate to="/admin/leads" replace />} path="clients" />
                <Route element={<ClientProfilePage />} path="clients/:leadId" />
                <Route element={<LeadsPage />} path="leads" />
                <Route element={<ClientProfilePage />} path="leads/:leadId" />
                <Route element={<DocumentsPage />} path="documents" />
                <Route element={<ProfilePage />} path="profile" />
              </Route>

              <Route element={<LegacyAdminDashboardRedirect />} path="/admin/dashboard" />
            </Routes>
          </Suspense>
        </Router>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
