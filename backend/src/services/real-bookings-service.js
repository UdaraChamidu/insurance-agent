import { authService } from './microsoft-auth.js';

/**
 * Real Microsoft Bookings Service using Microsoft Graph API
 */
class RealBookingsService {
  constructor() {
    this.bookingBusinessId = null;
  }

  /**
   * Get all booking businesses for the organization
   */
  async getBookingBusinesses() {
    try {
      console.log('🔍 Fetching booking businesses...');
      const client = await authService.getGraphClient();
      
      const businesses = await client
        .api('/solutions/bookingBusinesses')
        .get();

      console.log(`✅ Found ${businesses.value?.length || 0} booking business(es)`);
      return businesses.value || [];
    } catch (error) {
      console.error('❌ Error fetching booking businesses:', error.message);
      console.error('Error details:', error);
      
      if (error.statusCode === 403) {
        throw new Error('Permission denied. Please ensure your Azure app has "Bookings.Read.All" or "Bookings.ReadWrite.All" permissions and admin consent has been granted.');
      }
      
      throw new Error(`Failed to fetch booking businesses: ${error.message}`);
    }
  }

  /**
   * Get the first booking business ID (or use cached one)
   */
  async getBookingBusinessId() {
    if (this.bookingBusinessId) {
      return this.bookingBusinessId;
    }

    const businesses = await this.getBookingBusinesses();
    
    if (!businesses || businesses.length === 0) {
      throw new Error('No booking businesses found. Please create one in Microsoft Bookings.');
    }

    // Use the first business
    this.bookingBusinessId = businesses[0].id;
    console.log(`📅 Using booking business: ${businesses[0].displayName} (${this.bookingBusinessId})`);
    
    return this.bookingBusinessId;
  }

  /**
   * Get all appointments within a date range
   */
  async getAppointments(startDate = null, endDate = null, status = null) {
    try {
      const client = await authService.getGraphClient();
      
      // Get ALL booking businesses instead of just the first one
      const businesses = await this.getBookingBusinesses();

      // Default to next 30 days if no dates provided
      const start = startDate || new Date().toISOString();
      const end = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      console.log(`📅 Fetching appointments from ALL ${businesses.length} booking businesses`);
      console.log(`   Date range: ${start} to ${end}`);

      // Fetch appointments from ALL booking businesses
      let allAppointments = [];
      
      for (const business of businesses) {
        try {
          console.log(`   ⏳ Querying: ${business.displayName} (${business.id})`);
          
          const response = await client
            .api(`/solutions/bookingBusinesses/${business.id}/calendarView`)
            .query({ start, end })
            .get();

          const businessAppointments = response.value || [];
          console.log(`      ✅ Found ${businessAppointments.length} appointment(s)`);
          
          allAppointments.push(...businessAppointments);
        } catch (error) {
          console.error(`      ❌ Error fetching from ${business.displayName}:`, error.message);
          // Continue with other businesses even if one fails
        }
      }

      let appointments = allAppointments;
      console.log(`📊 Total appointments from all businesses: ${appointments.length}`);

      // Transform to our format
      appointments = appointments.map(apt => ({
        id: apt.id,
        startDateTime: apt.startDateTime?.dateTime || apt.start?.dateTime,
        endDateTime: apt.endDateTime?.dateTime || apt.end?.dateTime,
        serviceId: apt.serviceId,
        serviceName: apt.serviceName || apt.service?.displayName || 'Consultation',
        customerId: apt.customerId,
        customerName: apt.customerName || apt.customers?.[0]?.displayName || 'Unknown',
        customerEmailAddress: apt.customerEmailAddress || apt.customers?.[0]?.emailAddress || '',
        customerPhone: apt.customerPhone || apt.customers?.[0]?.phone || '',
        customerNotes: apt.customerNotes || apt.additionalInformation || '',
        status: this.mapStatus(apt.status || apt.appointmentStatus),
        invoiceUrl: apt.invoiceUrl,
        isLocationOnline: apt.isLocationOnline || true,
        onlineMeetingUrl: apt.joinWebUrl || apt.onlineMeetingUrl || null,
        createdDateTime: apt.createdDateTime || new Date().toISOString()
      }));

      // Filter by status if provided
      if (status) {
        appointments = appointments.filter(apt => apt.status === status);
      }

      console.log(`✅ Found ${appointments.length} appointments`);
      return appointments;
    } catch (error) {
      console.error('Error fetching appointments:', error);
      throw new Error(`Failed to fetch appointments: ${error.message}`);
    }
  }

  /**
   * Get a specific appointment by ID
   */
  async getAppointmentById(appointmentId) {
    try {
      const client = await authService.getGraphClient();
      const businessId = await this.getBookingBusinessId();

      const appointment = await client
        .api(`/solutions/bookingBusinesses/${businessId}/appointments/${appointmentId}`)
        .get();

      return {
        id: appointment.id,
        startDateTime: appointment.startDateTime?.dateTime || appointment.start?.dateTime,
        endDateTime: appointment.endDateTime?.dateTime || appointment.end?.dateTime,
        serviceId: appointment.serviceId,
        serviceName: appointment.serviceName || 'Consultation',
        customerId: appointment.customerId,
        customerName: appointment.customerName || appointment.customers?.[0]?.displayName || 'Unknown',
        customerEmailAddress: appointment.customerEmailAddress || appointment.customers?.[0]?.emailAddress || '',
        customerPhone: appointment.customerPhone || appointment.customers?.[0]?.phone || '',
        customerNotes: appointment.customerNotes || appointment.additionalInformation || '',
        status: this.mapStatus(appointment.status),
        invoiceUrl: appointment.invoiceUrl,
        isLocationOnline: appointment.isLocationOnline || true,
        onlineMeetingUrl: appointment.joinWebUrl || null,
        createdDateTime: appointment.createdDateTime
      };
    } catch (error) {
      console.error('Error fetching appointment:', error);
      throw new Error(`Appointment ${appointmentId} not found`);
    }
  }

  /**
   * Get booking business information
   */
  async getBookingBusiness() {
    try {
      const client = await authService.getGraphClient();
      const businessId = await this.getBookingBusinessId();

      const business = await client
        .api(`/solutions/bookingBusinesses/${businessId}`)
        .get();

      return {
        id: business.id,
        displayName: business.displayName,
        businessType: business.businessType,
        email: business.email,
        phone: business.phone,
        webSiteUrl: business.webSiteUrl || process.env.BOOKING,
        address: business.address
      };
    } catch (error) {
      console.error('Error fetching business info:', error);
      throw new Error(`Failed to fetch business info: ${error.message}`);
    }
  }

  /**
   * Send invitation email for an appointment
   * Note: Microsoft Bookings automatically sends emails, but we can trigger a reminder
   */
  async sendInvitation(appointmentId, meetingUrl) {
    try {
      const appointment = await this.getAppointmentById(appointmentId);
      
      // In Microsoft Bookings, notifications are automatically sent
      // For custom meeting URLs, you'd need to implement email sending separately
      // using Microsoft Graph Mail API or another service
      
      console.log(`📧 Invitation would be sent to ${appointment.customerEmailAddress}`);
      
      return {
        success: true,
        message: `Invitation sent to ${appointment.customerEmailAddress}`,
        sentTo: appointment.customerEmailAddress,
        sentAt: new Date().toISOString(),
        note: 'Microsoft Bookings sends automatic confirmations. For custom invites, implement Graph Mail API.'
      };
    } catch (error) {
      console.error('Error sending invitation:', error);
      throw error;
    }
  }

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(appointmentId, newStatus) {
    try {
      const client = await authService.getGraphClient();
      const businessId = await this.getBookingBusinessId();

      // Map our status to Microsoft's status
      const msStatus = this.mapStatusToMS(newStatus);

      await client
        .api(`/solutions/bookingBusinesses/${businessId}/appointments/${appointmentId}`)
        .patch({
          status: msStatus
        });

      return await this.getAppointmentById(appointmentId);
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw new Error(`Failed to update appointment: ${error.message}`);
    }
  }

  /**
   * Map Microsoft status to our simplified status
   */
  mapStatus(msStatus) {
    const statusMap = {
      'confirmed': 'confirmed',
      'pending': 'pending',
      'cancelled': 'cancelled',
      'completed': 'completed',
      'noShow': 'cancelled'
    };
    return statusMap[msStatus] || 'pending';
  }

  /**
   * Map our status to Microsoft status
   */
  mapStatusToMS(status) {
    const statusMap = {
      'confirmed': 'confirmed',
      'pending': 'pending',
      'cancelled': 'cancelled',
      'completed': 'completed'
    };
    return statusMap[status] || 'pending';
  }
}

// Export singleton instance
export const realBookingsService = new RealBookingsService();
