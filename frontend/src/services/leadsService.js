const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class LeadsService {
  async getLeads(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.skip) queryParams.append('skip', filters.skip);
      if (filters.limit) queryParams.append('limit', filters.limit);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const response = await fetch(`${API_URL}/api/leads?${queryParams}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error('Failed to fetch leads');
        return await response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }
  }

  async getLeadById(id) {
    try {
      const response = await fetch(`${API_URL}/api/leads/${id}`);
      if (!response.ok) throw new Error('Failed to fetch lead');
      return await response.json();
    } catch (error) {
      console.error('Error fetching lead:', error);
      throw error;
    }
  }
}

export default new LeadsService();
