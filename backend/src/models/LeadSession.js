/**
 * Simple in-memory store for Lead Sessions
 * In a production app, this would be a Redis or Database table
 */

class LeadSessionStore {
    constructor() {
      this.sessions = new Map();
      // Cleanup old sessions every hour
      setInterval(() => this.cleanup(), 3600000);
    }
  
    /**
     * Create a new lead session
     * @param {Object} data 
     * @returns {string} sessionId
     */
    createSession(data) {
      const sessionId = 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      this.sessions.set(sessionId, {
        id: sessionId,
        createdAt: new Date(),
        ...data
      });
      return sessionId;
    }
  
    /**
     * Get session by ID
     * @param {string} sessionId 
     */
    getSession(sessionId) {
      return this.sessions.get(sessionId);
    }
  
    /**
     * Update session data
     * @param {string} sessionId 
     * @param {Object} updates 
     */
    updateSession(sessionId, updates) {
      const session = this.sessions.get(sessionId);
      if (!session) return null;
      
      const updatedSession = { ...session, ...updates };
      this.sessions.set(sessionId, updatedSession);
      return updatedSession;
    }
  
    /**
     * Remove sessions older than 24 hours
     */
    cleanup() {
      const now = new Date();
      for (const [id, session] of this.sessions.entries()) {
        const sessionAge = now - session.createdAt;
        if (sessionAge > 86400000) { // 24 hours
          this.sessions.delete(id);
        }
      }
    }
  }
  
  module.exports = new LeadSessionStore();
  
