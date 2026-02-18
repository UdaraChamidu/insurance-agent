import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const sendEmail = async (templateParams) => {
  try {
    const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
    console.log('SUCCESS!', response.status, response.text);
    return response;
  } catch (err) {
    console.error('FAILED...', err);
    throw err;
  }
};

export const sendBookingConfirmation = async (appointment, lead) => {
  const firstName = lead.contactInfo?.firstName || lead.firstName || '';
  const lastName = lead.contactInfo?.lastName || lead.lastName || '';
  const email = lead.contactInfo?.email || lead.email || '';
  const fullName = `${firstName} ${lastName}`.trim();

  const templateParams = {
    // Standard fields
    to_name: fullName,
    user_name: fullName, // Alias
    name: fullName,      // Alias
    customer_name: fullName, // Alias for user template
    to_email: email,

    // Date & Time
    booking_date: appointment.date,
    date: appointment.date, // Alias
    booking_time: appointment.startTime,
    time: appointment.startTime, // Alias
    start_time: appointment.startTime, // Alias
    end_time: appointment.endTime,
    duration: appointment.durationMinutes,
    date_time: `${appointment.date} at ${appointment.startTime}`, // Composite Alias
    meeting_time: `${appointment.date} at ${appointment.startTime}`, // Alias for user template

    // Service Description
    service_name: appointment.serviceName,
    description: appointment.serviceName, // Alias
    message: appointment.notes || 'No additional notes', // Alias
    notes: appointment.notes || 'No additional notes',

    // Meeting Details (Mapping for Zoom-like templates)
    meeting_link: `${window.location.origin}${appointment.meetingLink}`,
    join_link: `${window.location.origin}${appointment.meetingLink}`, // Alias
    link: `${window.location.origin}${appointment.meetingLink}`,      // Alias
    zoom_link: `${window.location.origin}${appointment.meetingLink}`, // Alias
    
    meeting_id: appointment.meetingId || 'N/A',
    meeting_password: 'No Password Required',
    passcode: 'No Password Required', // Alias
    password: 'No Password Required', // Alias
    
    // Management
    manage_link: `${window.location.origin}/appointment/manage/${appointment.manageToken}`,
    cancel_link: `${window.location.origin}/appointment/manage/${appointment.manageToken}?action=cancel`,
    reschedule_link: `${window.location.origin}/appointment/manage/${appointment.manageToken}?action=reschedule`,
    
    // System
    booking_ref: appointment.bookingRef || 'Pending'
  };

  console.log('Sending EmailJS params:', templateParams);
  return sendEmail(templateParams);
};

export const sendCancellationEmail = async (appointment) => {
  // Try to find a specific cancellation template, otherwise fallback
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_CANCEL;
  
  // Appointment object from manage API has customer details flattened
  const customerName = appointment.customerName || 'Customer';
  const customerEmail = appointment.customerEmail || '';
  
  const templateParams = {
    to_name: customerName,
    customer_name: customerName,
    to_email: customerEmail,
    
    // Status context - User might need a separate template for this, 
    // or use a generic one with dynamic message
    message: `Your appointment for ${appointment.serviceName} has been cancelled.`,
    description: `CANCELLED: ${appointment.serviceName}`,
    
    booking_date: appointment.date,
    date: appointment.date,
    booking_time: appointment.startTime,
    time: appointment.startTime,
    date_time: `${appointment.date} at ${appointment.startTime}`,
    meeting_time: `${appointment.date} at ${appointment.startTime}`,
    
    service_name: appointment.serviceName,
    booking_ref: appointment.bookingRef,
    
    // Links to re-book? 
    manage_link: window.location.origin, // Send to home page to re-book
    cancel_link: window.location.origin,
    reschedule_link: window.location.origin,
  };
  
  return sendEmail(templateParams, templateId);
};

export const sendRescheduleEmail = async (appointment) => {
  // Try to find a specific reschedule template, otherwise fallback
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_RESCHEDULE;

  const customerName = appointment.customerName || 'Customer';
  const customerEmail = appointment.customerEmail || '';
  const link = `${window.location.origin}${appointment.meetingLink}`;
  const manageLink = `${window.location.origin}/appointment/manage/${appointment.manageToken}`;
  
  const templateParams = {
    to_name: customerName,
    customer_name: customerName,
    to_email: customerEmail,
    
    message: `Your appointment has been rescheduled.`,
    description: `RESCHEDULED: ${appointment.serviceName}`,
    
    booking_date: appointment.date,
    date: appointment.date,
    booking_time: appointment.startTime,
    time: appointment.startTime,
    date_time: `${appointment.date} at ${appointment.startTime}`,
    meeting_time: `${appointment.date} at ${appointment.startTime}`,
    
    service_name: appointment.serviceName,
    booking_ref: appointment.bookingRef,
    
    join_link: link,
    meeting_link: link,
    link: link,
    zoom_link: link,
    
    meeting_id: appointment.meetingId || 'N/A',
    passcode: 'No Password Required',
    
    manage_link: manageLink,
    cancel_link: manageLink,
    reschedule_link: manageLink,
  };
  
  return sendEmail(templateParams, templateId);
};
