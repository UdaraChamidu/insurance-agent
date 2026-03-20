import { getApiBaseUrl } from '../utils/network';

const API_URL = getApiBaseUrl();

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json();
}

export async function listTemplates() {
  return request(`${API_URL}/api/templates/`);
}

export async function getTemplate(id) {
  return request(`${API_URL}/api/templates/${id}`);
}

export async function createTemplate(data) {
  return request(`${API_URL}/api/templates/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateTemplate(id, data) {
  return request(`${API_URL}/api/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteTemplate(id) {
  return request(`${API_URL}/api/templates/${id}`, { method: 'DELETE' });
}

export async function sendTemplate(templateId, leadId, extraVariables = null) {
  return request(`${API_URL}/api/templates/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, leadId, extraVariables }),
  });
}

export async function seedDefaultTemplates() {
  return request(`${API_URL}/api/templates/seed`, { method: 'POST' });
}
