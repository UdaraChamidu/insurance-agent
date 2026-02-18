import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SchedulePage from './pages/SchedulePage';
import BookingsPage from './pages/BookingsPage';
import AdminLayout from './components/AdminLayout';
import AdminPage from './pages/AdminPage'; // Keeping for reference if needed, but routing replaced
import AdminDashboard from './pages/AdminDashboard';
import MeetingPage from './pages/MeetingPage';
import ProfilePage from './pages/ProfilePage';
import DocumentsPage from './pages/DocumentsPage';
import IntakePage from './pages/IntakePage';
import LeadsPage from './pages/LeadsPage';
import ClientProfilePage from './pages/ClientProfilePage';
import ManageAppointmentPage from './pages/ManageAppointmentPage';

import { ThemeProvider } from './context/ThemeContext';

import { NotificationProvider } from './context/NotificationContext';

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
  
            {/* Standalone Admin Views */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Routes>
        </Router>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
