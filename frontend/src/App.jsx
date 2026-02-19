import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SchedulePage from './pages/SchedulePage';
import BookingsPage from './pages/BookingsPage';
import AdminLayout from './components/AdminLayout';
import MeetingPage from './pages/MeetingPage';
import ProfilePage from './pages/ProfilePage';
import DocumentsPage from './pages/DocumentsPage';
import IntakePage from './pages/IntakePage';
import LeadsPage from './pages/LeadsPage';
import ClientProfilePage from './pages/ClientProfilePage';
import ManageAppointmentPage from './pages/ManageAppointmentPage';

import { ThemeProvider } from './context/ThemeContext';

import { NotificationProvider } from './context/NotificationContext';

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

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/intake" element={<IntakePage />} />
            <Route path="/meeting" element={<MeetingPage />} />
            <Route path="/appointment/manage/:token" element={<ManageAppointmentPage />} />
            
            {/* Admin Routes with Layout */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/bookings" replace />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="leads/:leadId" element={<ClientProfilePage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
  
            {/* Legacy route: redirect into canonical meeting page */}
            <Route path="/admin/dashboard" element={<LegacyAdminDashboardRedirect />} />
          </Routes>
        </Router>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
