import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

class LeadSessionStore {
  // No constructor or cleanup needed - DB persists data

  /**
   * Create a new lead session
   * @param {Object} data 
   * @returns {Promise<string>} leadId
   */
  async createSession(data) {
    const { productType, state, triggers, utm, contactInfo } = data;

    try {
      // 1. Create Lead
      const lead = await prisma.lead.create({
        data: {
          productType,
          state,
          triggers: triggers || {},
          firstName: contactInfo?.firstName,
          lastName: contactInfo?.lastName,
          email: contactInfo?.email,
          phone: contactInfo?.phone,
          utmSource: utm?.utm_source,
          utmMedium: utm?.utm_medium,
          utmCampaign: utm?.utm_campaign,
        }
      });

      // 2. Create Session linked to Lead
      await prisma.session.create({
        data: {
          leadId: lead.id,
          status: 'new'
        }
      });

      return lead.id;
    } catch (error) {
      console.error('Error creating lead session:', error);
      throw error;
    }
  }

  /**
   * Get session by ID (using leadId)
   * @param {string} leadId 
   */
  async getSession(leadId) {
    try {
      const session = await prisma.session.findUnique({
        where: { leadId },
        include: { lead: true }
      });

      if (!session) return null;

      // Flatten for compatibility with existing frontend/backend logic
      return {
        id: session.leadId,
        startTime: session.startTime,
        status: session.status,
        ghlContactId: session.ghlContactId,
        ...session.lead, 
        // Lead fields override session fields if same name, but they are distinct in schema
        // frontend expects 'productType', 'state' at top level
      };
    } catch (error) {
      console.error('Error retrieving session:', error);
      return null;
    }
  }

  /**
   * Update session data
   * @param {string} leadId 
   * @param {Object} updates 
   */
  async updateSession(leadId, updates) {
    try {
      const { disposition, notes, planName, premium, ghlContactId, callEndedAt } = updates;
      
      const updateData = {};
      if (disposition !== undefined) updateData.disposition = disposition;
      if (notes !== undefined) updateData.notes = notes;
      if (planName !== undefined) updateData.planName = planName;
      if (premium !== undefined) updateData.premium = premium;
      if (ghlContactId !== undefined) updateData.ghlContactId = ghlContactId;
      if (callEndedAt !== undefined) updateData.endTime = new Date(callEndedAt);
      
      // Also update status if disposition is set
      if (disposition) updateData.status = 'completed';

      const session = await prisma.session.update({
        where: { leadId },
        data: updateData,
        include: { lead: true }
      });
      
      return {
        id: session.leadId,
        ...session.lead,
        ...session
      };
    } catch (error) {
      console.error('Error updating session:', error);
      return null;
    }
  }
}

export default new LeadSessionStore();
  
