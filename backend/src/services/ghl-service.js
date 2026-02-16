const axios = require('axios');

class GHLService {
  constructor() {
    this.apiKey = process.env.GHL_API_KEY;
    this.locationId = process.env.GHL_LOCATION_ID;
    this.baseUrl = 'https://rest.gohighlevel.com/v1'; // Classic API (v1) - or use v2 if OAuth
    
    if (!this.apiKey) {
      console.warn('⚠️ GHL_API_KEY is missing in .env. GHL Service will run in MOCK mode.');
    }
  }

  /**
   *Create or update a contact in GoHighLevel
   * @param {Object} contactData - { email, phone, firstName, lastName, ... }
   * @returns {Promise<Object>} - The created/updated contact
   */
  async createContact(contactData) {
    if (!this.apiKey) {
      console.log('📝 [MOCK GHL] Creating contact:', contactData);
      return { id: 'mock-ghl-id-' + Date.now(), ...contactData };
    }

    try {
      const response = await axios.post(`${this.baseUrl}/contacts/`, contactData, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error creating GHL contact:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update an existing contact
   * @param {string} contactId 
   * @param {Object} data 
   */
  async updateContact(contactId, data) {
    if (!this.apiKey) {
      console.log(`📝 [MOCK GHL] Updating contact ${contactId}:`, data);
      return { id: contactId, ...data };
    }

    try {
      const response = await axios.put(`${this.baseUrl}/contacts/${contactId}`, data, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error updating GHL contact:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Add a tag to a contact
   * @param {string} contactId 
   * @param {string} tag 
   */
  async addTag(contactId, tag) {
    if (!this.apiKey) {
      console.log(`🏷️ [MOCK GHL] Adding tag "${tag}" to contact ${contactId}`);
      return true;
    }

    try {
      await axios.post(`${this.baseUrl}/contacts/${contactId}/tags`, {
        tags: [tag]
      }, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      return true;
    } catch (error) {
      console.error('❌ Error adding tag to GHL contact:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Trigger a workflow/automation for a contact
   * @param {string} contactId 
   * @param {string} workflowId 
   */
  async triggerWorkflow(contactId, workflowId) {
    if (!this.apiKey) {
      console.log(`⚡ [MOCK GHL] Triggering workflow ${workflowId} for contact ${contactId}`);
      return true;
    }

    try {
        // Note: Endpoint varies by API version, check GHL docs for specific workflow trigger
      await axios.post(`${this.baseUrl}/workflows/${workflowId}/activate`, {
        contact_id: contactId
      }, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      return true;
    } catch (error) {
      console.error('❌ Error triggering GHL workflow:', error.response?.data || error.message);
      // Don't throw, just log - workflows are often "fire and forget"
      return false;
    }
  }
  
    /**
   * Create an opportunity in a pipeline
   * @param {string} contactId
   * @param {string} pipelineId
   * @param {string} stageId
     * @param {string} title
   * @param {string} status - open, won, lost, abandoned
   */
  async createOpportunity(contactId, pipelineId, stageId, title, status = 'open') {
      if (!this.apiKey) {
          console.log(`Bg [MOCK GHL] Creating opportunity "${title}" in pipeline ${pipelineId} stage ${stageId}`);
          return { id: 'mock-opp-id' };
      }
      
      try {
          const response = await axios.post(`${this.baseUrl}/pipelines/${pipelineId}/opportunities`, {
              contactId,
              stageId,
              title,
              status
          }, {
              headers: { Authorization: `Bearer ${this.apiKey}` }
          });
          return response.data;
      } catch (error) {
          console.error('❌ Error creating GHL opportunity:', error.response?.data || error.message);
          throw error;
      }
  }
}

module.exports = new GHLService();
