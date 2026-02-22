const resolveApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Prevent mixed-content failures when frontend is served over HTTPS.
  // Keep localhost and private network hosts on HTTP for local development.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && configured.startsWith('http://')) {
    try {
      const parsed = new URL(configured);
      const host = parsed.hostname.toLowerCase();
      const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
      const isPrivateIp = /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
      if (!isLocalHost && !isPrivateIp) {
        parsed.protocol = 'https:';
        return parsed.toString().replace(/\/$/, '');
      }
    } catch {
      // Fall back to configured value if URL parsing fails.
    }
  }

  return configured.replace(/\/$/, '');
};

const API_URL = resolveApiBaseUrl();
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
      return await fetchJsonWithRetry(`${API_URL}/api/leads?${queryParams}`);
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
}

export default new LeadsService();
