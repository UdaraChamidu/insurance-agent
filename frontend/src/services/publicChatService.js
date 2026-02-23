import { getApiBaseUrl } from '../utils/network';

const API_URL = getApiBaseUrl();
const REQUEST_TIMEOUT_MS = 15000;

class PublicChatService {
  async askQuestion({ message, sessionId, mode = 'chat', history = [] }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_URL}/api/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId,
          mode,
          history
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Request failed (${response.status})`);
      }

      return await response.json();
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('Chat request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default new PublicChatService();
