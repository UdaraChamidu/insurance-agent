import { getApiBaseUrl } from '../utils/network';
import leadsService from './leadsService';

const API_URL = getApiBaseUrl();
const LEGACY_UPLOAD_MODE_KEY = 'clientDocsLegacyCensusUpload';

function hasLegacyUploadMode() {
  try {
    return window.sessionStorage.getItem(LEGACY_UPLOAD_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

function setLegacyUploadMode(enabled) {
  try {
    if (enabled) {
      window.sessionStorage.setItem(LEGACY_UPLOAD_MODE_KEY, 'true');
    } else {
      window.sessionStorage.removeItem(LEGACY_UPLOAD_MODE_KEY);
    }
  } catch {
    // Ignore storage access issues.
  }
}

async function readErrorMessage(response) {
  const raw = await response.text();
  if (!raw) {
    return `Request failed (${response.status})`;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed?.detail || parsed?.message || raw;
  } catch {
    return raw;
  }
}

class ClientDocsService {
  async uploadViaLegacyEndpoint({ leadId, file, description }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lead_id', leadId);
    if (description?.trim()) {
      formData.append('description', `Employer census upload${description.trim() ? ` - ${description.trim()}` : ''}`);
    }

    const response = await fetch(`${API_URL}/api/client-docs/upload-file`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const payload = await response.json();

    let pipelineUpdated = false;
    try {
      await leadsService.updatePipelineStatus(leadId, 'census_received');
      pipelineUpdated = true;
    } catch (pipelineError) {
      console.warn('Legacy census fallback uploaded file but could not update pipeline:', pipelineError);
    }

    return {
      ...payload,
      lead: {
        id: leadId,
        pipelineStatus: pipelineUpdated ? 'census_received' : undefined,
        pipelineUpdated,
      },
      fallbackMode: true,
    };
  }

  async uploadCensusDocument({ leadId, file, description }) {
    if (hasLegacyUploadMode()) {
      return await this.uploadViaLegacyEndpoint({ leadId, file, description });
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('lead_id', leadId);
    if (description?.trim()) {
      formData.append('description', description.trim());
    }

    const response = await fetch(`${API_URL}/api/client-docs/upload-census`, {
      method: 'POST',
      body: formData,
    });

    if (response.status === 404) {
      setLegacyUploadMode(true);
      return await this.uploadViaLegacyEndpoint({ leadId, file, description });
    }

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    setLegacyUploadMode(false);
    return await response.json();
  }
  async getPortalInfo(token) {
    const response = await fetch(`${API_URL}/api/client-docs/portal/${token}`);
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    return response.json();
  }

  async portalUpload({ token, file, description, folder }) {
    const formData = new FormData();
    formData.append('file', file);
    if (description?.trim()) formData.append('description', description.trim());
    if (folder) formData.append('folder', folder);

    const response = await fetch(`${API_URL}/api/client-docs/portal/${token}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    return response.json();
  }

  async generateUploadToken(leadId) {
    const response = await fetch(`${API_URL}/api/client-docs/generate-token/${leadId}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    return response.json();
  }

  async getLeadFolders(leadId) {
    const response = await fetch(`${API_URL}/api/client-docs/folders/${leadId}`);
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    return response.json();
  }

  async moveDocument(docId, folder) {
    const formData = new FormData();
    formData.append('folder', folder);
    const response = await fetch(`${API_URL}/api/client-docs/move/${docId}`, {
      method: 'PATCH',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    return response.json();
  }
}

export default new ClientDocsService();
