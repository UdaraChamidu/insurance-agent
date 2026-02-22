const DEFAULT_API_URL = 'http://localhost:8000';
const DEFAULT_WS_URL = 'ws://localhost:8000';

const stripTrailingSlash = (value) => value.replace(/\/+$/, '');

const sanitizeConfigValue = (value, fallback) => {
  const cleaned = String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  return cleaned || fallback;
};

const isLocalOrPrivateHost = (host) => {
  const normalized = String(host || '').toLowerCase();
  if (!normalized) return true;
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0') {
    return true;
  }
  if (/^10\./.test(normalized) || /^192\.168\./.test(normalized)) {
    return true;
  }
  return /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(normalized);
};

const parseUrl = (configured, fallback) => {
  const primary = sanitizeConfigValue(configured, fallback);
  const candidates = [primary];
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(primary)) {
    candidates.push(`http://${primary}`);
  }
  for (const candidate of candidates) {
    try {
      return new URL(candidate);
    } catch {
      // Try next candidate.
    }
  }
  return new URL(fallback);
};

const shouldUpgradeToSecureProtocol = (hostname) => {
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.location.protocol !== 'https:') {
    return false;
  }
  return !isLocalOrPrivateHost(hostname);
};

export const getApiBaseUrl = () => {
  const parsed = parseUrl(import.meta.env.VITE_API_URL, DEFAULT_API_URL);
  if (parsed.protocol === 'http:' && shouldUpgradeToSecureProtocol(parsed.hostname)) {
    parsed.protocol = 'https:';
  }
  return stripTrailingSlash(parsed.toString());
};

export const getWsBaseUrl = () => {
  const configured = sanitizeConfigValue(import.meta.env.VITE_WS_URL, '');
  const fallbackWs = getApiBaseUrl().replace(/^http/i, 'ws');
  const parsed = parseUrl(configured || fallbackWs, DEFAULT_WS_URL);
  if (parsed.protocol === 'ws:' && shouldUpgradeToSecureProtocol(parsed.hostname)) {
    parsed.protocol = 'wss:';
  }
  return stripTrailingSlash(parsed.toString());
};
