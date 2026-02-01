// Mock data for Microsoft Bookings
// This will be replaced with real API calls once credentials are provided

export const mockAppointments = [
  {
    id: 'apt-001',
    startDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    endDateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    serviceId: 'srv-001',
    serviceName: 'Life Insurance Consultation',
    customerId: 'cust-001',
    customerName: 'John Smith',
    customerEmailAddress: 'john.smith@email.com',
    customerPhone: '+1 (555) 123-4567',
    customerNotes: 'Interested in term life insurance for family protection',
    status: 'confirmed',
    invoiceUrl: null,
    isLocationOnline: true,
    onlineMeetingUrl: null,
    createdDateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'apt-002',
    startDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    endDateTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    serviceId: 'srv-002',
    serviceName: 'Health Insurance Review',
    customerId: 'cust-002',
    customerName: 'Sarah Johnson',
    customerEmailAddress: 'sarah.j@email.com',
    customerPhone: '+1 (555) 234-5678',
    customerNotes: 'Looking to switch to a better health insurance plan',
    status: 'confirmed',
    invoiceUrl: null,
    isLocationOnline: true,
    onlineMeetingUrl: null,
    createdDateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'apt-003',
    startDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
    endDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 1800000).toISOString(),
    serviceId: 'srv-003',
    serviceName: 'Auto Insurance Quote',
    customerId: 'cust-003',
    customerName: 'Michael Chen',
    customerEmailAddress: 'mchen@email.com',
    customerPhone: '+1 (555) 345-6789',
    customerNotes: 'Need quote for 2 vehicles',
    status: 'pending',
    invoiceUrl: null,
    isLocationOnline: true,
    onlineMeetingUrl: null,
    createdDateTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'apt-004',
    startDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    endDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
    serviceId: 'srv-001',
    serviceName: 'Life Insurance Consultation',
    customerId: 'cust-004',
    customerName: 'Emily Rodriguez',
    customerEmailAddress: 'emily.r@email.com',
    customerPhone: '+1 (555) 456-7890',
    customerNotes: 'First-time buyer, interested in whole life insurance',
    status: 'confirmed',
    invoiceUrl: null,
    isLocationOnline: true,
    onlineMeetingUrl: null,
    createdDateTime: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'apt-005',
    startDateTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday (completed)
    endDateTime: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    serviceId: 'srv-004',
    serviceName: 'Property Insurance Consultation',
    customerId: 'cust-005',
    customerName: 'David Wilson',
    customerEmailAddress: 'dwilson@email.com',
    customerPhone: '+1 (555) 567-8901',
    customerNotes: 'New homeowner, needs coverage advice',
    status: 'completed',
    invoiceUrl: null,
    isLocationOnline: true,
    onlineMeetingUrl: 'https://meet.example.com/completed-meeting',
    createdDateTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'apt-006',
    startDateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days from now
    endDateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 1800000).toISOString(),
    serviceId: 'srv-002',
    serviceName: 'Health Insurance Review',
    customerId: 'cust-006',
    customerName: 'Amanda Brown',
    customerEmailAddress: 'abrown@email.com',
    customerPhone: '+1 (555) 678-9012',
    customerNotes: 'Annual policy review',
    status: 'confirmed',
    invoiceUrl: null,
    isLocationOnline: true,
    onlineMeetingUrl: null,
    createdDateTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  }
];

export const mockBookingBusiness = {
  id: 'business-001',
  displayName: 'SecureLife Insurance Consultations',
  businessType: 'insurance',
  email: 'EliteDealBroker6@helmygenesis.com',
  phone: '+1 (555) 100-2000',
  webSiteUrl: 'https://outlook.office.com/book/EliteDealBroker6@helmygenesis.com/s/5U1tObEiFkWzwCOEK--Pfw2',
  address: {
    street: '123 Insurance Way',
    city: 'Business City',
    state: 'BC',
    postalCode: '12345',
    countryOrRegion: 'USA'
  }
};

/**
 * Mock service to simulate Microsoft Bookings API
 * Replace with real API implementation when credentials are available
 */
class MockBookingsService {
  constructor() {
    this.appointments = [...mockAppointments];
    this.business = mockBookingBusiness;
  }

  /**
   * Get all appointments within a date range
   */
  async getAppointments(startDate, endDate, status = null) {
    await this.simulateDelay();

    let filtered = [...this.appointments];

    if (startDate) {
      filtered = filtered.filter(apt => new Date(apt.startDateTime) >= new Date(startDate));
    }

    if (endDate) {
      filtered = filtered.filter(apt => new Date(apt.endDateTime) <= new Date(endDate));
    }

    if (status) {
      filtered = filtered.filter(apt => apt.status === status);
    }

    // Sort by start date
    filtered.sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));

    return filtered;
  }

  /**
   * Get a specific appointment by ID
   */
  async getAppointmentById(appointmentId) {
    await this.simulateDelay();

    const appointment = this.appointments.find(apt => apt.id === appointmentId);
    if (!appointment) {
      throw new Error(`Appointment ${appointmentId} not found`);
    }

    return appointment;
  }

  /**
   * Get booking business information
   */
  async getBookingBusiness() {
    await this.simulateDelay();
    return this.business;
  }

  /**
   * Send invitation email for an appointment
   */
  async sendInvitation(appointmentId, meetingUrl) {
    await this.simulateDelay();

    const appointment = await this.getAppointmentById(appointmentId);
    
    // In real implementation, this would send an email via Microsoft Graph
    // For now, we'll just simulate it and update the meeting URL
    const appointmentIndex = this.appointments.findIndex(apt => apt.id === appointmentId);
    if (appointmentIndex !== -1) {
      this.appointments[appointmentIndex].onlineMeetingUrl = meetingUrl;
    }

    return {
      success: true,
      message: `Invitation sent to ${appointment.customerEmailAddress}`,
      sentTo: appointment.customerEmailAddress,
      sentAt: new Date().toISOString()
    };
  }

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(appointmentId, newStatus) {
    await this.simulateDelay();

    const appointmentIndex = this.appointments.findIndex(apt => apt.id === appointmentId);
    if (appointmentIndex === -1) {
      throw new Error(`Appointment ${appointmentId} not found`);
    }

    this.appointments[appointmentIndex].status = newStatus;
    return this.appointments[appointmentIndex];
  }

  /**
   * Simulate network delay
   */
  async simulateDelay() {
    return new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
  }
}

// Export singleton instance
export const bookingsService = new MockBookingsService();

// Import and setup real service
import { authService } from './microsoft-auth.js';
import { realBookingsService } from './real-bookings-service.js';

/**
 * Smart Bookings Service Wrapper
 * Automatically uses real Microsoft Graph API when credentials are configured
 * Falls back to mock data for testing
 */
class SmartBookingsService {
  async getAppointments(...args) {
    if (authService.isReady()) {
      console.log('📡 Using REAL Microsoft Bookings API');
      return await realBookingsService.getAppointments(...args);
    } else {
      console.log('🔧 Using mock data (Microsoft credentials not configured)');
      return await bookingsService.getAppointments(...args);
    }
  }

  async getAppointmentById(...args) {
    if (authService.isReady()) {
      return await realBookingsService.getAppointmentById(...args);
    } else {
      return await bookingsService.getAppointmentById(...args);
    }
  }

  async getBookingBusiness(...args) {
    if (authService.isReady()) {
      return await realBookingsService.getBookingBusiness(...args);
    } else {
      return await bookingsService.getBookingBusiness(...args);
    }
  }

  async sendInvitation(...args) {
    if (authService.isReady()) {
      return await realBookingsService.sendInvitation(...args);
    } else {
      return await bookingsService.sendInvitation(...args);
    }
  }

  async updateAppointmentStatus(...args) {
    if (authService.isReady()) {
      return await realBookingsService.updateAppointmentStatus(...args);
    } else {
      return await bookingsService.updateAppointmentStatus(...args);
    }
  }

  isUsingRealData() {
    return authService.isReady();
  }
}

// Export the smart wrapper as the main service
export const smartBookingsService = new SmartBookingsService();
