import dotenv from 'dotenv';
import { sharePointService } from './src/services/sharepoint-service.js';

dotenv.config();

/**
 * Simple script to check what PDFs are in SharePoint
 */

async function checkPDFs() {
  console.log('\n📁 Checking SharePoint for PDFs...\n');
  console.log('='.repeat(60));
  
  try {
    // Test SharePoint connection
    const site = await sharePointService.getSiteInfo();
    console.log(`✅ Connected to: ${site.displayName}\n`);
    
    // List folders
    const folders = await sharePointService.listFolders('KBDEV');
    console.log(`✅ Found ${folders.length} folders in KBDEV:\n`);
    
    let totalPDFs = 0;
    
    // Check each folder for PDFs
    for (const folder of folders) {
      try {
        const pdfs = await sharePointService.listPDFsInFolder(folder.name);
        totalPDFs += pdfs.length;
        
        if (pdfs.length > 0) {
          console.log(`📂 ${folder.name}:`);
          pdfs.forEach(pdf => {
            console.log(`   - ${pdf.name} (${(pdf.size / 1024).toFixed(1)} KB)`);
          });
          console.log();
        } else {
          console.log(`📂 ${folder.name}: (empty)`);
        }
      } catch (error) {
        console.error(`❌ Error checking ${folder.name}:`, error.message);
      }
    }
    
    console.log('='.repeat(60));
    console.log(`\n📊 Summary: ${totalPDFs} total PDFs found\n`);
    
    if (totalPDFs === 0) {
      console.log('⚠️  No PDFs found yet!');
      console.log('\n📝 To add PDFs:');
      console.log('   1. Go to: https://helmygenesis.sharepoint.com/sites/EliteDealBroker');
      console.log('   2. Open: KBDEV library');
      console.log('   3. Upload PDFs to the appropriate folders');
      console.log('   4. Run: node run-ingestion.js\n');
    } else {
      console.log('✅ Ready for ingestion!');
      console.log('\n🚀 Run: node run-ingestion.js\n');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkPDFs()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
