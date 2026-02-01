import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

console.log('\n🔍 Checking Azure AD Credentials...\n');

// Check each credential
const clientId = process.env.MICROSOFT_CLIENT_ID;
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
const tenantId = process.env.MICROSOFT_TENANT_ID;

console.log('Client ID:');
console.log('  Length:', clientId?.length || 0);
console.log('  Value:', clientId || '❌ NOT SET');
console.log('  Format:', /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(clientId) ? '✅ Valid UUID' : '⚠️  May be incorrect');

console.log('\nTenant ID:');
console.log('  Length:', tenantId?.length || 0);
console.log('  Value:', tenantId || '❌ NOT SET');
console.log('  Format:', /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(tenantId) ? '✅ Valid UUID' : '⚠️  May be incorrect');

console.log('\nClient Secret:');
console.log('  Length:', clientSecret?.length || 0);
console.log('  First 10 chars:', clientSecret?.substring(0, 10) || '❌ NOT SET');
console.log('  Last 5 chars:', clientSecret?.substring(clientSecret.length - 5) || '');
console.log('  Contains special chars:', /[^a-zA-Z0-9]/.test(clientSecret) ? '✅ Yes (expected)' : '⚠️  No (unusual)');

// Check if secret might have been truncated
if (clientSecret && clientSecret.endsWith('_')) {
  console.log('  ⚠️  WARNING: Secret ends with underscore - might be truncated!');
  console.log('  Full value:', clientSecret);
}

console.log('\n📋 What to check in Azure Portal:');
console.log('1. Go to: https://portal.azure.com');
console.log('2. Navigate to: App registrations → Your App');
console.log('3. Check Overview page:');
console.log('   - Application (client) ID should match:', clientId);
console.log('   - Directory (tenant) ID should match:', tenantId);
console.log('4. Go to: Certificates & secrets');
console.log('   - If Client Secret is expired or you\'re unsure:');
console.log('     • Delete old secrets');
console.log('     • Click "+ New client secret"');
console.log('     • Copy the VALUE (not Secret ID)');
console.log('     • Update MICROSOFT_CLIENT_SECRET in .env');
console.log('5. Go to: API permissions');
console.log('   - Verify these permissions are "Granted":');
console.log('     ✓ Bookings.Read.All');
console.log('     ✓ Bookings.ReadWrite.All');
console.log('   - If not, click "Grant admin consent" button');

console.log('\n💡 Common Issues:');
console.log('• Client Secret copied incorrectly (check for spaces, line breaks)');
console.log('• Client Secret expired (they expire after 6-24 months)');
console.log('• Wrong Client ID or Tenant ID');
console.log('• Permissions not granted or admin consent not provided');
console.log('• Need to wait 5-10 minutes after granting permissions\n');
