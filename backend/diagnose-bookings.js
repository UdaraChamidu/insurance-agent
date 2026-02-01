import dotenv from 'dotenv';
import { authService } from './src/services/microsoft-auth.js';
import { Client } from '@microsoft/microsoft-graph-client';

dotenv.config();

async function diagnoseBookings() {
  console.log('\n🔍 Microsoft Bookings Diagnostic Tool\n');
  
  try {
    console.log('1️⃣  Getting access token...');
    const token = await authService.getAccessToken();
    console.log('   ✅ Access token acquired\n');
    
    const client = Client.init({
      authProvider: (done) => {
        done(null, token);
      },
    });
    
    // Test 1: Can we access Graph API at all?
    console.log('2️⃣  Testing basic Graph API access...');
    try {
      const response = await client.api('/me').get();
      console.log('   ❌ This is using app-only auth, /me endpoint won\'t work');
    } catch (error) {
      if (error.statusCode === 403 || error.statusCode === 401) {
        console.log('   ✅ Expected error - app-only authentication working correctly');
      }
    }
    
    // Test 2: Try to get organization info
    console.log('\n3️⃣  Checking organization access...');
    try {
      const org = await client.api('/organization').get();
      console.log('   ✅ Organization access works!');
      console.log('   Org name:', org.value[0]?.displayName || 'Unknown');
    } catch (error) {
      console.log('   ❌ Cannot access organization:', error.message);
    }
    
    // Test 3: Try bookings with more details
    console.log('\n4️⃣  Testing Bookings API access...');
    try {
      const bookings = await client.api('/solutions/bookingBusinesses').get();
      console.log('   ✅ SUCCESS! Found', bookings.value?.length || 0, 'booking business(es)');
      
      if (bookings.value && bookings.value.length > 0) {
        bookings.value.forEach(biz => {
          console.log('\n   📅 Booking Business:');
          console.log('      Name:', biz.displayName);
          console.log('      Email:', biz.email);
          console.log('      ID:', biz.id);
        });
      } else {
        console.log('\n   ⚠️  No booking businesses found in this tenant');
        console.log('   This could mean:');
        console.log('   1. Microsoft Bookings is not set up for this tenant');
        console.log('   2. The booking business is in a different Microsoft account');
        console.log('   3. Microsoft Bookings is not enabled/licensed');
      }
    } catch (error) {
      console.log('   ❌ Bookings API Error:');
      console.log('      Status:', error.statusCode);
      console.log('      Code:', error.code);
      console.log('      Message:', error.message || 'No message');
      
      if (error.statusCode === 401) {
        console.log('\n   💡 Possible causes of 401 error:');
        console.log('   1. Permissions not granted or admin consent missing');
        console.log('   2. Microsoft Bookings not available in this tenant/license');
        console.log('   3. Need to wait longer (5-15 min) after granting permissions');
        console.log('   4. Using personal account instead of business account');
      }
      
      if (error.statusCode === 403) {
        console.log('\n   💡 403 means permissions issue:');
        console.log('   Go to Azure Portal and verify:');
        console.log('   - Bookings.Read.All is granted');
        console.log('   - Admin consent button was clicked');
      }
    }
    
    // Test 4: Check what scopes the token has
    console.log('\n5️⃣  Checking token permissions...');
    const tokenParts = token.split('.');
    if (tokenParts.length === 3) {
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      console.log('   Roles/Scopes in token:', payload.roles || payload.scp || 'None found');
      
      if (payload.roles && payload.roles.includes('Bookings.Read.All')) {
        console.log('   ✅ Token has Bookings.Read.All permission');
      } else {
        console.log('   ⚠️  Token does NOT have Bookings.Read.All permission');
        console.log('   This means admin consent was not granted!');
      }
    }
    
  } catch (error) {
    console.log('\n❌ Fatal error:', error.message);
    console.error(error);
  }
  
  console.log('\n');
}

diagnoseBookings().then(() => process.exit(0)).catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
