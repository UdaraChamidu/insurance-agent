import { getApiBaseUrl } from '../utils/network';

const API_URL = getApiBaseUrl();
const REQUEST_TIMEOUT_MS = 20000;
const REQUEST_MAX_RETRIES = 2;
const REQUEST_RETRY_BASE_MS = 700;

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJsonWithRetry(url, options = {}) {
  for (let attempt = 0; attempt <= REQUEST_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < REQUEST_MAX_RETRIES) {
          await sleep(REQUEST_RETRY_BASE_MS * (attempt + 1));
          continue;
        }
        const detail = await response.text();
        throw new Error(detail || `Request failed (${response.status})`);
      }
      return await response.json();
    } catch (error) {
      const isAbort = error?.name === 'AbortError';
      const isNetwork = error instanceof TypeError;
      if ((isAbort || isNetwork) && attempt < REQUEST_MAX_RETRIES) {
        await sleep(REQUEST_RETRY_BASE_MS * (attempt + 1));
        continue;
      }
      if (isAbort) {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error('Request failed after retries');
}

class LeadsService {
  async getLeads(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.skip) queryParams.append('skip', filters.skip);
      if (filters.limit) queryParams.append('limit', filters.limit);
      const query = queryParams.toString();
      const url = `${API_URL}/api/leads/${query ? `?${query}` : ''}`;
      return await fetchJsonWithRetry(url);
    } catch (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }
  }

  async getLeadById(id) {
    try {
      return await fetchJsonWithRetry(`${API_URL}/api/leads/${id}`);
    } catch (error) {
      console.error('Error fetching lead:', error);
      throw error;
    }
  }

  async deleteLead(id) {
    try {
      const response = await fetch(`${API_URL}/api/leads/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Failed to delete lead (${response.status})`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error deleting lead:', error);
      throw error;
    }
  }

  /**
   * Create a new group/employer lead via the employer intake form.
   */
  async createEmployerLead(data) {
    try {
      return await fetchJsonWithRetry(`${API_URL}/api/leads/employer-intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Error creating employer lead:', error);
      throw error;
    }
  }

  /**
   * Update pipeline status for a lead (individual or group).
   */
  async updatePipelineStatus(leadId, pipelineStatus) {
    try {
      return await fetchJsonWithRetry(`${API_URL}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStatus }),
      });
    } catch (error) {
      console.error('Error updating pipeline status:', error);
      throw error;
    }
  }

  /**
   * Get pipeline stage change history for a lead.
   */
  async getPipelineHistory(leadId) {
    try {
      return await fetchJsonWithRetry(`${API_URL}/api/leads/${leadId}/pipeline-history`);
    } catch (error) {
      console.error('Error fetching pipeline history:', error);
      throw error;
    }
  }
}

export default new LeadsService();
