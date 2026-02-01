import dotenv from 'dotenv';
import { authService } from './src/services/microsoft-auth.js';
import { realBookingsService } from './src/services/real-bookings-service.js';

dotenv.config();

async function test() {
  console.log('\n🧪 Testing Microsoft Graph API Connection...\n');
  
  // Test 1: Check if configured
  console.log('1️⃣  Checking configuration...');
  console.log('   Client ID:', process.env.MICROSOFT_CLIENT_ID ? '✅ Set' : '❌ Not set');
  console.log('   Client Secret:', process.env.MICROSOFT_CLIENT_SECRET ? '✅ Set' : '❌ Not set');
  console.log('   Tenant ID:', process.env.MICROSOFT_TENANT_ID ? '✅ Set' : '❌ Not set');
  console.log('   Auth Service Ready:', authService.isReady() ? '✅ Yes' : '❌ No');
  
  if (!authService.isReady()) {
    console.log('\n❌ Microsoft credentials not configured. Exiting...\n');
    return;
  }
  
  try {
    // Test 2: Get access token
    console.log('\n2️⃣  Getting access token...');
    const token = await authService.getAccessToken();
    console.log('   ✅ Access token acquired:', token.substring(0, 50) + '...');
    
    // Test 3: Get booking businesses
    console.log('\n3️⃣  Fetching booking businesses...');
    const businesses = await realBookingsService.getBookingBusinesses();
    console.log(`   ✅ Found ${businesses.length} booking business(es):`);
    businesses.forEach(b => {
      console.log(`      - ${b.displayName} (ID: ${b.id})`);
    });
    
    if (businesses.length > 0) {
      // Test 4: Get appointments
      console.log('\n4️⃣  Fetching appointments...');
      const appointments = await realBookingsService.getAppointments();
      console.log(`   ✅ Found ${appointments.length} appointment(s):`);
      appointments.forEach(apt => {
        console.log(`      - ${apt.customerName}: ${apt.serviceName} (${apt.status})`);
      });
    }
    
    console.log('\n✅ All tests passed!\n');
    
  } catch (error) {
    console.log('\n❌ Error:',error.message);
    console.log('\nFull error:', error);
    
    if (error.message.includes('Permission denied') || error.message.includes('403')) {
      console.log('\n📋 REQUIRED PERMISSIONS:');
      console.log('   Go to Azure Portal → App Registrations → Your App → API Permissions');
      console.log('   Add these Microsoft Graph API permissions:');
      console.log('   ✅ Bookings.Read.All (Application permission)');
      console.log('   ✅ Bookings.ReadWrite.All (Application permission)');
      console.log('   Then click "Grant admin consent"');
    }
    console.log('');
  }
}

test().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
