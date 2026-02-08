import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client;

try {
  if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
    console.log('✅ Twilio client initialized');
  } else {
    console.warn('⚠️ Twilio credentials missing in .env');
  }
} catch (error) {
  console.error('❌ Error initializing Twilio client:', error);
}

export const sendSMS = async (to, message) => {
  if (!client) {
    throw new Error('Twilio client not initialized');
  }

  try {
    const response = await client.messages.create({
      body: message,
      from: fromNumber,
      to: to
    });
    console.log(`📩 SMS sent to ${to}: ${response.sid}`);
    return response;
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    throw error;
  }
};
