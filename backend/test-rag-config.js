import dotenv from 'dotenv';
import { sharePointService } from './src/services/sharepoint-service.js';
import { pineconeService } from './src/services/pinecone-service.js';

dotenv.config();

/**
 * Simple RAG Configuration Test
 * Tests Pinecone and SharePoint connectivity without PDF processing
 */
async function testConfiguration() {
  console.log('\n🧪 RAG Configuration Test\n');
  console.log('='.repeat(60));
  
  let allGood = true;
  
  try {
    // Test 1: Pinecone Configuration
    console.log('\n1️⃣  Testing Pinecone Configuration...');
    
    if (!pineconeService.isConfigured) {
      console.log('❌ Pinecone not configured');
      console.log('   PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? 'Set' : 'NOT SET');
      allGood = false;
    } else {
      console.log('✅ Pinecone API key configured');
      
      try {
        await pineconeService.initialize();
        console.log('✅ Connected to Pinecone');
        
        // Show configured namespaces
        console.log('📋 Configured namespaces:');
        Object.entries(pineconeService.namespaces).forEach(([key, ns]) => {
          console.log(`   - ${key}: ${ns}`);
        });
        
        // Try to check if index exists
        try {
const created = await pineconeService.createIndexIfNeeded();
          if (created) {
            console.log('✅ Pinecone index created successfully!');
            console.log('⏳ Index is initializing... (may take 1-2 minutes)');
          } else {
            console.log('✅ Pinecone index already exists');
            
            // Get stats
            try {
              const stats = await pineconeService.getStats();
              console.log('📊 Index stats:');
              console.log(`   Total vectors: ${stats.totalVectorCount || 0}`);
              console.log(`   Dimension: ${stats.dimension ||1536}`);
              
              if (stats.namespaces && Object.keys(stats.namespaces).length > 0) {
                console.log('   Namespaces with data:');
                Object.entries(stats.namespaces).forEach(([ns, data]) => {
                  console.log(`      - ${ns}: ${data.vectorCount} vectors`);
                });
              } else {
                console.log('   No vectors uploaded yet (index is empty)');
              }
            } catch (error) {
              console.log('⚠️  Could not fetch index stats:', error.message);
            }
          }
        } catch (error) {
          console.log('⚠️  Index operation warning:', error.message);
          console.log('   This is okay if you just created the Pinecone account');
        }
      } catch (error) {
        console.log('❌ Pinecone connection error:', error.message);
        console.log('   Please check your PINECONE_API_KEY');
        allGood = false;
      }
    }
    
    // Test 2: SharePoint Configuration
    console.log('\n2️⃣  Testing SharePoint Configuration...');
    
    const siteUrl = process.env.SHAREPOINT_SITE_URL;
    console.log(`   Site URL: ${siteUrl}`);
    
    if (!sharePointService.isReady()) {
      console.log('❌ SharePoint not configured');
      console.log('   Please update SHAREPOINT_SITE_URL in .env');
      allGood = false;
    } else {
      console.log('✅ SharePoint URL configured');
      
      try {
        const site = await sharePointService.getSiteInfo();
        console.log('✅ Connected to SharePoint!');
        console.log(`   Site: ${site.displayName}`);
        console.log(`   Web URL: ${site.webUrl}`);
        
        // List folders
        console.log('\n3️⃣  Listing Document Library Folders...');
        try {
          const folders = await sharePointService.listFolders('KB-DEV');
          
          if (folders.length === 0) {
            console.log('⚠️  No folders found in KB-DEV library');
            console.log('   Expected folders:');
            sharePointService.folders.forEach(f => {
              console.log(`      - ${f.name} → namespace: ${f.universe}`);
            });
          } else {
            console.log(`✅ Found ${folders.length} folders:`);
            folders.forEach(folder => {
              const modified = new Date(folder.lastModifiedDateTime).toLocaleDateString();
              console.log(`   - ${folder.name} (modified: ${modified})`);
            });
            
            // Try to list PDFs in first folder
            console.log('\n4️⃣  Checking for PDF Files...');
            let totalPDFs = 0;
            
            for (const folder of folders) {
              try {
                const pdfs = await sharePointService.listPDFsInFolder(folder.name);
                if (pdfs.length > 0) {
                  console.log(`\n   📁 ${folder.name}: ${pdfs.length} PDFs`);
                  pdfs.forEach(pdf => {
                    console.log(`      - ${pdf.name} (${(pdf.size / 1024).toFixed(1)} KB)`);
                  });
                  totalPDFs += pdfs.length;
                }
              } catch (error) {
                console.log(`   ⚠️  Error checking ${folder.name}:`, error.message);
              }
            }
            
            if (totalPDFs === 0) {
              console.log('\n⚠️  No PDF files found in any folder');
              console.log('   Please upload PDF files to test the complete pipeline');
            } else {
              console.log(`\n✅ Total: ${totalPDFs} PDF files ready for processing!`);
            }
          }
        } catch (error) {
          console.log('❌ Error listing folders:', error.message);
          allGood = false;
        }
      } catch (error) {
        console.log('❌ SharePoint connection error:', error.message);
        
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          console.log('\n💡 Permission Issue Detected:');
          console.log('   Go to: Azure Portal → Your App → API Permissions');
          console.log('   Add these permissions:');
          console.log('      - Sites.Read.All (Microsoft Graph, Application)');
          console.log('      - Files.Read.All (Microsoft Graph, Application)');
          console.log('   Then: Click "Grant admin consent"');
          console.log('   Wait 5 minutes and try again');
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.log('\n💡 Authentication Issue:');
          console.log('   Check your Microsoft credentials in .env:');
          console.log('      - MICROSOFT_CLIENT_ID');
          console.log('      - MICROSOFT_CLIENT_SECRET');
          console.log('      - MICROSOFT_TENANT_ID');
        }
        
        allGood = false;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    
    if (allGood) {
      console.log('✅ ALL TESTS PASSED! 🎉');
      console.log('\nYour RAG pipeline is properly configured!');
      console.log('\nNext steps:');
      console.log('1. Upload PDF files to your SharePoint folders');
      console.log('2. Run full ingestion: node run-ingestion.js');
      console.log('3. Start querying your knowledge base!');
    } else {
      console.log('⚠️  CONFIGURATION INCOMPLETE');
      console.log('\nPlease fix the issues above and run this test again.');
    }
    
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error);
  }
}

// Run test
testConfiguration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
