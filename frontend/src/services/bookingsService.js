// Frontend service for Custom Scheduling API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class BookingsService {
  /**
   * Fetch available time slots for a date range
   */
  async getAvailability(from, to) {
    try {
      const response = await fetch(
        `${API_URL}/api/scheduling/availability?from=${from}&to=${to}`
      );
      if (!response.ok) throw new Error('Failed to fetch availability');
      return await response.json();
    } catch (error) {
      console.error('Error fetching availability:', error);
      throw error;
    }
  }

  /**
   * Create a new appointment
   */
  async createAppointment(data) {
    try {
      const response = await fetch(`${API_URL}/api/scheduling/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to create appointment');
      }
      return await response.json();
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  /**
   * Fetch all appointments with optional filters
   */
  async getAppointments(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.from) queryParams.append('from', filters.from);
      if (filters.to) queryParams.append('to', filters.to);
      if (filters.limit) queryParams.append('limit', filters.limit);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(
          `${API_URL}/api/scheduling/appointments?${queryParams}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error('Failed to fetch appointments');
        return await response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Request timed out');
      console.error('Error fetching appointments:', error);
      throw error;
    }
  }

  /**
   * Fetch a specific appointment by ID
   */
  async getAppointmentById(id) {
    try {
      const response = await fetch(`${API_URL}/api/scheduling/appointments/${id}`);
      if (!response.ok) throw new Error('Failed to fetch appointment');
      return await response.json();
    } catch (error) {
      console.error('Error fetching appointment:', error);
      throw error;
    }
  }

  /**
   * Update appointment (status, notes, etc.)
   */
  async updateAppointment(id, data) {
    try {
      const response = await fetch(`${API_URL}/api/scheduling/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update appointment');
      return await response.json();
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(id) {
    try {
      const response = await fetch(`${API_URL}/api/scheduling/appointments/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to cancel appointment');
      return await response.json();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      throw error;
    }
  }

  /**
   * Get availability settings
   */
  async getAvailabilitySettings() {
    try {
      const response = await fetch(`${API_URL}/api/scheduling/settings`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      return await response.json();
    } catch (error) {
      console.error('Error fetching settings:', error);
      throw error;
    }
  }

  /**
   * Save availability settings
   */
  async saveAvailabilitySettings(slots) {
    try {
      const response = await fetch(`${API_URL}/api/scheduling/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots }),
      });
      if (!response.ok) throw new Error('Failed to save settings');
      return await response.json();
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  // ===== Utility Methods =====

  formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  formatTime(time24) {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  getRelativeTime(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.round(diffMs / 86400000);

    if (diffDays < 0) return 'Past';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `in ${diffDays} days`;
    return this.formatDate(dateString);
  }
}

export default new BookingsService();
