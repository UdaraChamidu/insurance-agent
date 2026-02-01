import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

/**
 * Comprehensive System Test
 * Tests all major components of the Insurance AI Consultant system
 */

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

function success(message) {
  log(colors.green, '✅', message);
}

function fail(message) {
  log(colors.red, '❌', message);
}

function warn(message) {
  log(colors.yellow, '⚠️ ', message);
}

function info(message) {
  log(colors.cyan, 'ℹ️ ', message);
}

function section(title) {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

async function testHTTP(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  console.log('\n');
  console.log(`${colors.cyan}╔${'═'.repeat(58)}╗${colors.reset}`);
  console.log(`${colors.cyan}║  INSURANCE AI CONSULTANT - COMPREHENSIVE SYSTEM TEST  ║${colors.reset}`);
  console.log(`${colors.cyan}╚${'═'.repeat(58)}╝${colors.reset}`);
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };

  // Test 1: Environment Variables
  section('1. ENVIRONMENT CONFIGURATION');
  
  const requiredEnv = {
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
    'MICROSOFT_CLIENT_ID': process.env.MICROSOFT_CLIENT_ID,
    'MICROSOFT_CLIENT_SECRET': process.env.MICROSOFT_CLIENT_SECRET,
    'MICROSOFT_TENANT_ID': process.env.MICROSOFT_TENANT_ID,
    'PINECONE_API_KEY': process.env.PINECONE_API_KEY,
    'SHAREPOINT_SITE_URL': process.env.SHAREPOINT_SITE_URL
  };

  for (const [key, value] of Object.entries(requiredEnv)) {
    if (value && value !== 'your_pinecone_api_key_here' && value !== 'your_api_key_here') {
      success(`${key}: Configured`);
      results.passed++;
    } else {
      fail(`${key}: NOT configured`);
      results.failed++;
    }
  }

  // Test 2: Backend Server
  section('2. BACKEND SERVER');
  
  try {
    const healthCheck = await testHTTP('/health');
    if (healthCheck.status === 200) {
      success('Backend server is running');
      success(`Health check: ${JSON.stringify(healthCheck.data)}`);
      results.passed++;
    } else {
      fail('Backend health check failed');
      results.failed++;
    }
  } catch (error) {
    fail(`Backend server not responding: ${error.message}`);
    fail('Make sure backend is running: npm run dev');
    results.failed++;
  }

  // Test 3: Meeting API
  section('3. VIDEO MEETING SYSTEM');
  
  try {
    info('Creating test meeting...');
    const meeting = await testHTTP('/api/meetings', 'POST', {});
    
    if (meeting.status === 200 && meeting.data.meetingId) {
      success(`Meeting created: ${meeting.data.meetingId}`);
      results.passed++;
      
      // Test getting meeting info
      const getMeeting = await testHTTP(`/api/meetings/${meeting.data.meetingId}`);
      if (getMeeting.status === 200) {
        success('Meeting retrieval works');
        results.passed++;
      } else {
        warn('Meeting retrieval failed');
        results.warnings++;
      }
    } else {
      fail('Meeting creation failed');
      results.failed++;
    }
  } catch (error) {
    fail(`Meeting API error: ${error.message}`);
    results.failed++;
  }

  // Test 4: Bookings API
  section('4. MICROSOFT BOOKINGS');
  
  try {
    info('Fetching appointments...');
    const bookings = await testHTTP('/api/bookings/appointments');
    
    if (bookings.status === 200) {
      if (Array.isArray(bookings.data)) {
        success(`Bookings API: ${bookings.data.length} appointments found`);
        
        if (bookings.data.length > 0) {
          const sample = bookings.data[0];
          info(`Sample: ${sample.customerName} - ${sample.service} - ${sample.status}`);
          
          // Check if mock or real data
          if (sample.id && sample.id.startsWith('mock_')) {
            warn('Using MOCK data (Real bookings not connected yet)');
            info('Add Bookings permissions in Azure to use real data');
            results.warnings++;
          } else {
            success('Using REAL Microsoft Bookings data!');
            results.passed++;
          }
        }
        results.passed++;
      } else {
        fail('Invalid bookings response format');
        results.failed++;
      }
    } else {
      fail('Bookings API failed');
      results.failed++;
    }
  } catch (error) {
    fail(`Bookings API error: ${error.message}`);
    results.failed++;
  }

  // Test 5: RAG Configuration
  section('5. RAG KNOWLEDGE BASE');
  
  try {
    // Test Pinecone
    info('Testing Pinecone configuration...');
    const { pineconeService } = await import('./src/services/pinecone-service.js');
    
    if (pineconeService.isConfigured) {
      success('Pinecone API key configured');
      results.passed++;
      
      try {
        await pineconeService.initialize();
        success('Pinecone connection successful');
        results.passed++;
      } catch (error) {
        fail(`Pinecone connection failed: ${error.message}`);
        results.failed++;
      }
    } else {
      fail('Pinecone not configured');
      results.failed++;
    }

    // Test SharePoint
    info('Testing SharePoint configuration...');
    const { sharePointService } = await import('./src/services/sharepoint-service.js');
    
    if (sharePointService.isReady()) {
      success('SharePoint URL configured');
      results.passed++;
      
      try {
        const site = await sharePointService.getSiteInfo();
        success(`SharePoint connected: ${site.displayName}`);
        results.passed++;
        
        // Try to list folders
        const folders = await sharePointService.listFolders('KBDEV');
        success(`Found ${folders.length} folders in KBDEV`);
        results.passed++;
        
        folders.forEach(folder => {
          info(`  - ${folder.name}`);
        });
      } catch (error) {
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          fail('SharePoint permission denied (403)');
          warn('Add Sites.Read.All and Files.Read.All permissions');
          results.failed++;
        } else {
          fail(`SharePoint error: ${error.message}`);
          results.failed++;
        }
      }
    } else {
      fail('SharePoint not configured');
      results.failed++;
    }
  } catch (error) {
    fail(`RAG system error: ${error.message}`);
    results.failed++;
  }

  // Test 6: OpenAI Integration
  section('6. OPENAI INTEGRATION');
  
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    info('Testing OpenAI API key...');
    
    // Test with a simple completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "test successful" if you can read this.' }],
      max_tokens: 10
    });
    
    if (completion.choices[0].message.content) {
      success('OpenAI API key works');
      success(`Response: ${completion.choices[0].message.content}`);
      results.passed++;
    } else {
      fail('OpenAI API returned empty response');
      results.failed++;
    }
  } catch (error) {
    fail(`OpenAI API error: ${error.message}`);
    results.failed++;
  }

  // Summary
  section('TEST SUMMARY');
  
  const total = results.passed + results.failed + results.warnings;
  const passRate = ((results.passed / total) * 100).toFixed(1);
  
  console.log(`Total Tests: ${total}`);
  success(`Passed: ${results.passed}`);
  fail(`Failed: ${results.failed}`);
  warn(`Warnings: ${results.warnings}`);
  console.log(`\nPass Rate: ${passRate}%\n`);
  
  if (results.failed === 0 && results.warnings === 0) {
    console.log(`${colors.green}╔${'═'.repeat(58)}╗${colors.reset}`);
    console.log(`${colors.green}║  🎉 ALL SYSTEMS OPERATIONAL! 🎉                        ║${colors.reset}`);
    console.log(`${colors.green}╚${'═'.repeat(58)}╝${colors.reset}\n`);
  } else if (results.failed === 0) {
    console.log(`${colors.yellow}╔${'═'.repeat(58)}╗${colors.reset}`);
    console.log(`${colors.yellow}║  ⚠️  SYSTEM FUNCTIONAL WITH WARNINGS                    ║${colors.reset}`);
    console.log(`${colors.yellow}╚${'═'.repeat(58)}╝${colors.reset}\n`);
  } else {
    console.log(`${colors.red}╔${'═'.repeat(58)}╗${colors.reset}`);
    console.log(`${colors.red}║  ❌ SOME SYSTEMS NEED ATTENTION                         ║${colors.reset}`);
    console.log(`${colors.red}╚${'═'.repeat(58)}╝${colors.reset}\n`);
  }
  
  // Recommendations
  section('RECOMMENDATIONS');
  
  if (results.failed > 0 || results.warnings > 0) {
    console.log('Next Steps:\n');
    
    if (!sharePointService.isReady()) {
      info('1. Add SharePoint permissions in Azure Portal:');
      info('   - Sites.Read.All');
      info('   - Files.Read.All');
      info('   - Grant admin consent\n');
    }
    
    if (results.warnings > 0) {
      info('2. Add Bookings permissions in Azure Portal:');
      info('   - Bookings.Read.All');
      info('   - Bookings.ReadWrite.All');
      info('   - BookingsAppointment.ReadWrite.All');
      info('   - Grant admin consent\n');
    }
    
    info('3. After adding permissions:');
    info('   - Wait 5 minutes');
    info('   - Run this test again: node test-system.js\n');
  } else {
    success('All systems operational! Ready to use.');
    info('\nYou can now:');
    info('1. Test video meetings at http://localhost:4000');
    info('2. View bookings at http://localhost:4000/admin');
    info('3. Upload PDFs to SharePoint and run ingestion');
  }
}

// Run tests
runTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  });
