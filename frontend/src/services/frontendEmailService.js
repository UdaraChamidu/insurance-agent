import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const isEmailJsConfigured = (templateId = TEMPLATE_ID) =>
  Boolean(SERVICE_ID && PUBLIC_KEY && templateId);

export const sendEmail = async (templateParams, templateId = TEMPLATE_ID) => {
  if (!isEmailJsConfigured(templateId)) {
    console.warn('EmailJS is not fully configured. Skipping email send.', {
      hasServiceId: Boolean(SERVICE_ID),
      hasTemplateId: Boolean(templateId),
      hasPublicKey: Boolean(PUBLIC_KEY),
    });
    return { skipped: true, reason: 'emailjs_not_configured' };
  }

  try {
    const response = await emailjs.send(SERVICE_ID, templateId, templateParams, PUBLIC_KEY);
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
  const baseUrl = window.location.origin;

  const templateParams = {
    to_name: fullName,
    user_name: fullName,
    name: fullName,
    customer_name: fullName,
    to_email: email,
    booking_date: appointment.date,
    date: appointment.date,
    booking_time: appointment.startTime,
    time: appointment.startTime,
    start_time: appointment.startTime,
    end_time: appointment.endTime,
    duration: appointment.durationMinutes,
    date_time: `${appointment.date} at ${appointment.startTime}`,
    meeting_time: `${appointment.date} at ${appointment.startTime}`,
    service_name: appointment.serviceName,
    description: appointment.serviceName,
    message: appointment.notes || 'No additional notes',
    notes: appointment.notes || 'No additional notes',
    meeting_link: `${baseUrl}${appointment.meetingLink}`,
    join_link: `${baseUrl}${appointment.meetingLink}`,
    link: `${baseUrl}${appointment.meetingLink}`,
    zoom_link: `${baseUrl}${appointment.meetingLink}`,
    meeting_id: appointment.meetingId || 'N/A',
    meeting_password: 'No Password Required',
    passcode: 'No Password Required',
    password: 'No Password Required',
    manage_link: `${baseUrl}/appointment/manage/${appointment.manageToken}`,
    cancel_link: `${baseUrl}/appointment/manage/${appointment.manageToken}?action=cancel`,
    reschedule_link: `${baseUrl}/appointment/manage/${appointment.manageToken}?action=reschedule`,
    booking_ref: appointment.bookingRef || 'Pending',
  };

  console.log('Sending EmailJS params:', templateParams);
  return sendEmail(templateParams, TEMPLATE_ID);
};

export const sendCancellationEmail = async (appointment) => {
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_CANCEL || TEMPLATE_ID;
  const customerName = appointment.customerName || 'Customer';
  const customerEmail = appointment.customerEmail || '';

  const templateParams = {
    to_name: customerName,
    customer_name: customerName,
    to_email: customerEmail,
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
    manage_link: window.location.origin,
    cancel_link: window.location.origin,
    reschedule_link: window.location.origin,
  };

  return sendEmail(templateParams, templateId);
};

export const sendRescheduleEmail = async (appointment) => {
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_RESCHEDULE || TEMPLATE_ID;
  const customerName = appointment.customerName || 'Customer';
  const customerEmail = appointment.customerEmail || '';
  const link = `${window.location.origin}${appointment.meetingLink}`;
  const manageLink = `${window.location.origin}/appointment/manage/${appointment.manageToken}`;

  const templateParams = {
    to_name: customerName,
    customer_name: customerName,
    to_email: customerEmail,
    message: 'Your appointment has been rescheduled.',
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
