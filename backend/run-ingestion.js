import dotenv from 'dotenv';
import { ingestionOrchestrator } from './src/services/ingestion-orchestrator.js';
import { pineconeService } from './src/services/pinecone-service.js';
import { sharePointService } from './src/services/sharepoint-service.js';

dotenv.config();

/**
 * RAG Ingestion Script
 * Processes all PDFs from SharePoint and uploads to Pinecone
 */

async function runIngestion() {
  console.log('\n🚀 Starting RAG Ingestion Pipeline\n');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Verify configuration
    console.log('\n📋 Step 1: Verifying Configuration...\n');
    
    if (!pineconeService.isConfigured) {
      console.error('❌ Pinecone not configured. Please set PINECONE_API_KEY in .env');
      process.exit(1);
    }
    console.log('✅ Pinecone API key configured');
    
    if (!sharePointService.isReady()) {
      console.error('❌ SharePoint not configured. Please set SHAREPOINT_SITE_URL in .env');
      process.exit(1);
    }
    console.log('✅ SharePoint URL configured');
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI not configured. Please set OPENAI_API_KEY in .env');
      process.exit(1);
    }
    console.log('✅ OpenAI API key configured');
    
    // Step 2: Initialize Pinecone
    console.log('\n📋 Step 2: Initializing Pinecone...\n');
    
    await pineconeService.initialize();
    console.log('✅ Connected to Pinecone');
    
    const created = await pineconeService.createIndexIfNeeded();
    if (created) {
      console.log('✅ Pinecone index created');
      console.log('⏳ Waiting 60 seconds for index to initialize...');
      await new Promise(resolve => setTimeout(resolve, 60000));
    } else {
      console.log('✅ Pinecone index already exists');
    }
    
    // Get index stats
    try {
      const stats = await pineconeService.getStats();
      console.log('\n📊 Current Index Stats:');
      console.log(`   Total vectors: ${stats.totalVectorCount || 0}`);
      console.log(`   Dimension: ${stats.dimension || 1536}`);
      
      if (stats.namespaces && Object.keys(stats.namespaces).length > 0) {
        console.log('   Namespaces with data:');
        Object.entries(stats.namespaces).forEach(([ns, data]) => {
          console.log(`      - ${ns}: ${data.vectorCount} vectors`);
        });
      }
    } catch (error) {
      console.log('⚠️  Could not fetch index stats (this is okay for new indexes)');
    }
    
    // Step 3: Check SharePoint for PDFs
    console.log('\n📋 Step 3: Checking SharePoint for PDFs...\n');
    
    const site = await sharePointService.getSiteInfo();
    console.log(`✅ Connected to SharePoint: ${site.displayName}`);
    
    const libraryName = process.env.SHAREPOINT_KB_DEV_ID || 'KB-DEV';
    const folders = await sharePointService.listFolders(libraryName);
    console.log(`✅ Found ${folders.length} folders in ${libraryName}`);
    
    let totalPDFs = 0;
    const folderSummary = [];
    
    for (const folder of folders) {
      try {
        const pdfs = await sharePointService.listPDFsInFolder(folder.name);
        totalPDFs += pdfs.length;
        folderSummary.push({ folder: folder.name, count: pdfs.length });
        
        if (pdfs.length > 0) {
          console.log(`   📁 ${folder.name}: ${pdfs.length} PDF(s)`);
        }
      } catch (error) {
        console.error(`   ❌ Error checking ${folder.name}:`, error.message);
      }
    }
    
    if (totalPDFs === 0) {
      console.log('\n⚠️  No PDFs found in SharePoint!');
      console.log('\n📝 Next Steps:');
      console.log('   1. Go to: https://helmygenesis.sharepoint.com/sites/EliteDealBroker');
      console.log('   2. Open: KBDEV library');
      console.log('   3. Upload regulatory PDFs to the appropriate folders');
      console.log('   4. Run this script again');
      process.exit(0);
    }
    
    console.log(`\n✅ Total: ${totalPDFs} PDF(s) ready to process`);
    
    // Step 4: Confirm before processing
    console.log('\n📋 Step 4: Ready to Process...\n');
    console.log('This will:');
    console.log(`   • Process ${totalPDFs} PDF files`);
    console.log('   • Extract text and create chunks');
    console.log('   • Generate OpenAI embeddings');
    console.log('   • Upload vectors to Pinecone');
    
    // Estimate costs
    const estimatedChunks = totalPDFs * 20; // Rough estimate: 20 chunks per PDF
    const embeddingCost = (estimatedChunks / 1000) * 0.0001; // $0.0001 per 1K tokens
    
    console.log(`\n💰 Estimated Cost (if full processing):`);
    console.log(`   • ~${estimatedChunks} chunks`);
    console.log(`   • ~$${embeddingCost.toFixed(4)} for embeddings`);
    
    // Check for force flag
    const forceRefresh = process.argv.includes('--force') || process.argv.includes('-f');
    
    if (forceRefresh) {
        console.log('\n⚠️  FORCE REFRESH detected - will re-process EVERYTHING.');
    } else {
        console.log('\nℹ️  INCREMENTAL MODE - will skip unchanged files.');
        console.log('    Use --force to re-process everything.');
    }
    
// Auto-proceed (you can add confirmation prompt here if needed)
    console.log('\n▶️  Starting ingestion in 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 5: Run full ingestion
    console.log('\n📋 Step 5: Running Ingestion Pipeline...\n');
    console.log('='.repeat(60));
    
    const result = await ingestionOrchestrator.runFullIngestion(forceRefresh);
    
    // Step 6: Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ INGESTION COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`   PDFs Processed: ${result.pdfsProcessed || 0}/${totalPDFs}`);
    console.log(`   Skipped: ${result.skipped || 0}`);
    console.log(`   Total Chunks: ${result.chunksCreated || 0}`);
    console.log(`   Total Vectors: ${result.vectorsUploaded || 0}`);
    console.log(`   Errors: ${result.errors ? result.errors.length : 0}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      result.errors.forEach(e => console.log(`   - ${e.file || e.stage}: ${e.error}`));
    }
    
    console.log('\n✅ Your knowledge base is ready!');
    console.log('\n🎯 Next Steps:');
    console.log('   1. Verify data in Pinecone dashboard');
    console.log('   2. Build the query & answer system');
    console.log('   3. Create the frontend chat UI');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Ingestion failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run ingestion
runIngestion()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
