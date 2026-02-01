import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Helper to log to file
const logToFile = (message) => {
  const logPath = path.join(process.cwd(), 'email-error.log');
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(logPath, logMessage);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
};

/**
 * Email Service using Nodemailer (SMTP)
 * Sends meeting invitations to customers
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Check if SMTP credentials are provided
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ SMTP credentials not found in .env. Email sending will be simulated.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: process.env.SMTP_SERVICE || 'gmail', // Default to Gmail
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Send meeting invitation email
   */
  async sendMeetingInvitation(recipientEmail, recipientName, meetingDetails) {
    try {
      const startMsg = `📧 ==== EMAIL SERVICE START (Nodemailer) ==== \nTo: ${recipientEmail}`;
      console.log(startMsg);
      logToFile(startMsg);

      if (!this.transporter) {
        // Try initializing again
        this.initializeTransporter();
        if (!this.transporter) {
          const msg = '❌ SMTP credentials missing. Please set SMTP_USER and SMTP_PASS in .env';
          console.error(msg);
          logToFile(msg);
          throw new Error('SMTP credentials missing. Please configure .env file.');
        }
      }
      
      const meetingUrl = meetingDetails.meetingUrl;
      const dateStr = new Date(meetingDetails.startDateTime).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      const timeStr = new Date(meetingDetails.startDateTime).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true
      });
      
      const emailBody = this.generateEmailTemplate(recipientName, {
        date: dateStr,
        time: timeStr,
        agentName: meetingDetails.staffMemberDisplayName || 'Your Agent',
        meetingUrl: meetingUrl
      });
      
      const mailOptions = {
        from: `"SecureLife Insurance" <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject: `Your Insurance Consultation - ${dateStr}`,
        html: emailBody
      };
      
      console.log(`📤 Sending via ${process.env.SMTP_SERVICE || 'gmail'}...`);
      const info = await this.transporter.sendMail(mailOptions);
      
      const successMsg = `✅ Email sent successfully! Message ID: ${info.messageId}`;
      console.log(successMsg);
      logToFile(successMsg);
      
      return {
        success: true,
        sentTo: recipientEmail,
        sentAt: new Date().toISOString(),
        messageId: info.messageId
      };
      
    } catch (error) {
      const errorMsg = `❌ ========== EMAIL ERROR =========\nError Name: ${error.name}\nError Message: ${error.message}\nFull Error: ${JSON.stringify(error, null, 2)}\n==================================\n`;
      console.error(errorMsg);
      logToFile(errorMsg);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
  
  /**
   * Generate HTML email template
   */
  generateEmailTemplate(customerName, details) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                SecureLife Insurance
              </h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 14px;">
                Your Consultation is Confirmed
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.5;">
                Hi <strong>${customerName}</strong>,
              </p>
              
              <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.5;">
                Your insurance consultation is confirmed! We're looking forward to speaking with you.
              </p>
              
              <!-- Meeting Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-left: 4px solid #3b82f6; border-radius: 6px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; width: 80px;">📅 Date:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600;">${details.date}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">🕐 Time:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600;">${details.time}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">👤 Agent:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600;">${details.agentName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Join Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="${details.meetingUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                      📹 Join Meeting
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px; text-align: center;">
                Or copy this link: <br>
                <a href="${details.meetingUrl}" style="color: #3b82f6; word-break: break-all;">${details.meetingUrl}</a>
              </p>
              
              <!-- Instructions -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px; background-color: #fef3c7; border-radius: 6px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 15px 0; color: #92400e; font-size: 14px; font-weight: 600;">
                      📋 Before Joining:
                    </p>
                    <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 1.8;">
                      <li>Test your camera and microphone</li>
                      <li>Find a quiet, well-lit space</li>
                      <li>Have any relevant documents ready</li>
                      <li>Use a stable internet connection</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; color: #374151; font-size: 16px; line-height: 1.5;">
                See you soon!<br>
                <strong>The SecureLife Team</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
                Questions? Reply to this email or contact us at support@securelife.com
              </p>
              <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 11px;">
                © ${new Date().getFullYear()} SecureLife Insurance. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}

export const emailService = new EmailService();
