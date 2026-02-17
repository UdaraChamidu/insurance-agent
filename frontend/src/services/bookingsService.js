// Frontend service for Microsoft Bookings API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class BookingsService {
  /**
   * Fetch all appointments with optional filters
   */
  async getAppointments(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.startDate) {
        queryParams.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        queryParams.append('endDate', filters.endDate);
      }
      if (filters.status) {
        queryParams.append('status', filters.status);
      }

      const response = await fetch(`${API_URL}/api/bookings/appointments?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }

      const data = await response.json();
      return Array.isArray(data) ? data : (data.appointments || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      throw error;
    }
  }

  /**
   * Fetch a specific appointment by ID
   */
  async getAppointmentById(id) {
    try {
      const response = await fetch(`${API_URL}/api/bookings/appointments/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch appointment');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching appointment:', error);
      throw error;
    }
  }

  /**
   * Get booking business information
   */
  async getBookingBusiness() {
    try {
      const response = await fetch(`${API_URL}/api/bookings/business`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch business info');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching business info:', error);
      throw error;
    }
  }

  /**
   * Send invitation email for an appointment
   */
  async sendInvitation(appointmentId, meetingUrl = null) {
    try {
      const response = await fetch(`${API_URL}/api/bookings/appointments/${appointmentId}/send-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ meetingUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to send invitation');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending invitation:', error);
      throw error;
    }
  }

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(appointmentId, status) {
    try {
      const response = await fetch(`${API_URL}/api/bookings/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update appointment status');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating appointment status:', error);
      throw error;
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Format time for display
   */
  formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Calculate duration in minutes
   */
  calculateDuration(startDateTime, endDateTime) {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    return Math.round((end - start) / 60000); // Convert to minutes
  }

  /**
   * Get relative time (e.g., "in 2 hours", "tomorrow")
   */
  getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date - now;
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffHours < 0) {
      return 'Past';
    } else if (diffHours < 1) {
      const diffMins = Math.round(diffMs / 60000);
      return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays < 7) {
      return `in ${diffDays} days`;
    } else {
      return this.formatDate(dateString);
    }
  }
}

export default new BookingsService();
