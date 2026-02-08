import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SchedulePage from './pages/SchedulePage';
import BookingsPage from './pages/BookingsPage';
import AdminPage from './pages/AdminPage';
import AdminDashboard from './pages/AdminDashboard';
import MeetingPage from './pages/MeetingPage';
import ProfilePage from './pages/ProfilePage';

import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/admin" element={<Navigate to="/admin/bookings" replace />} />
          <Route path="/admin/bookings" element={<BookingsPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/bookings" element={<BookingsPage />} />
          <Route path="/admin/profile" element={<ProfilePage />} />
          <Route path="/meeting" element={<MeetingPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
