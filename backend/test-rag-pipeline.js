import dotenv from 'dotenv';
import { sharePointService } from './src/services/sharepoint-service.js';
import { pineconeService } from './src/services/pinecone-service.js';
import { pdfProcessor } from './src/services/pdf-processor.js';
import { chunkingService } from './src/services/chunking-service.js';
import { embeddingService } from './src/services/embedding-service.js';

dotenv.config();

/**
 * RAG Pipeline Test Script
 * Tests all components step-by-step
 */
async function testRAGPipeline() {
  console.log('\n🧪 RAG Pipeline Test\n');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Pinecone Configuration
    console.log('\n1️⃣  Testing Pinecone Configuration...');
    
    if (!pineconeService.isConfigured) {
      console.log('❌ Pinecone not configured');
      console.log('   Please set PINECONE_API_KEY in .env file');
      return;
    }
    
    console.log('✅ Pinecone API key found');
    
    try {
      await pineconeService.initialize();
      console.log('✅ Connected to Pinecone');
      
      // Try to create index
      const created = await pineconeService.createIndexIfNeeded();
      if (created) {
        console.log('✅ Pinecone index created (waiting for it to be ready...)');
      } else {
        console.log('✅ Pinecone index already exists');
      }
      
      // Get stats
      const stats = await pineconeService.getStats();
      console.log('📊 Index stats:', {
        totalVectorCount: stats.totalVectorCount || 0,
        namespaces: Object.keys(stats.namespaces || {})
      });
    } catch (error) {
      console.log('❌ Pinecone error:', error.message);
      console.log('   This might be okay if index doesn\'t exist yet');
    }
    
    // Test 2: SharePoint Configuration
    console.log('\n2️⃣  Testing SharePoint Configuration...');
    
    if (!sharePointService.isReady()) {
      console.log('❌ SharePoint not configured');
      console.log('   Please set SHAREPOINT_SITE_URL in .env file');
      console.log('   Current value:', process.env.SHAREPOINT_SITE_URL);
      return;
    }
    
    console.log('✅ SharePoint URL configured');
    
    try {
      const site = await sharePointService.getSiteInfo();
      console.log('✅ Connected to SharePoint site:', site.displayName);
      
      // List folders
      console.log('\n3️⃣  Listing SharePoint Folders...');
      const folders = await sharePointService.listFolders();
      
      console.log(`✅ Found ${folders.length} folders:`);
      folders.forEach(folder => {
        console.log(`   - ${folder.name} (${folder.size} bytes, modified: ${new Date(folder.lastModifiedDateTime).toLocaleDateString()})`);
      });
      
      // Test with first folder that has PDFs
      if (folders.length > 0) {
        console.log('\n4️⃣  Testing PDF Retrieval...');
        
        for (const folder of folders) {
          try {
            const pdfs = await sharePointService.listPDFsInFolder(folder.name);
            
            if (pdfs.length > 0) {
              console.log(`\n✅ Found ${pdfs.length} PDFs in ${folder.name}:`);
              pdfs.forEach(pdf => {
                console.log(`   - ${pdf.name} (${(pdf.size / 1024).toFixed(1)} KB)`);
                console.log(`      Metadata:`, pdf.metadata);
              });
              
              // Test processing first PDF
              console.log('\n5️⃣  Testing Full Pipeline with First PDF...');
              const testPDF = pdfs[0];
              
              console.log(`\n📥 Downloading: ${testPDF.name}...`);
              const pdfBuffer = await sharePointService.downloadPDF(testPDF.downloadUrl);
              console.log(`✅ Downloaded ${pdfBuffer.length} bytes`);
              
              console.log(`\n📄 Extracting text...`);
              const processed = await pdfProcessor.processPDF(pdfBuffer, testPDF.name);
              console.log(`✅ Extracted ${processed.cleanedLength} characters from ${processed.metadata.numPages} pages`);
              console.log(`   Found ${processed.headings.length} section headings`);
              
              console.log(`\n✂️  Creating chunks...`);
              const chunks = await chunkingService.createChunks(
                processed,
                testPDF.metadata,
                testPDF.namespace
              );
              console.log(`✅ Created ${chunks.length} chunks`);
              console.log(`   Sample chunk:`, {
                id: chunks[0].id,
                textPreview: chunks[0].text.substring(0, 100) + '...',
                wordCount: chunks[0].wordCount,
                section: chunks[0].section,
                namespace: chunks[0].namespace,
                authorityLevel: chunks[0].authorityLevel
              });
              
              console.log(`\n🧮 Generating embeddings...`);
              const costEstimate = embeddingService.estimateCost(chunks);
              console.log(`💰 Cost estimate: ${costEstimate.costFormatted}`);
              
              const vectors = await embeddingService.createVectorsForPinecone(chunks.slice(0, 5)); // Just test with 5 chunks
              console.log(`✅ Generated ${vectors.length} vectors`);
              console.log(`   Vector dimensions: ${vectors[0].values.length}`);
              console.log(`   Sample metadata:`, {
                fileName: vectors[0].metadata.fileName,
                section: vectors[0].metadata.section,
                regulator: vectors[0].metadata.regulator,
                authorityLevel: vectors[0].metadata.authorityLevel,
                citation: vectors[0].metadata.citation
              });
              
              console.log(`\n📤 Uploading to Pinecone namespace: ${testPDF.namespace}...`);
              await pineconeService.upsert(vectors, testPDF.namespace);
              console.log(`✅ Uploaded successfully!`);
              
              // Test query
              console.log(`\n🔍 Testing retrieval...`);
              const queryResults = await pineconeService.query({
                vector: vectors[0].values,
                namespace: testPDF.namespace,
                topK: 3
              });
              
              console.log(`✅ Query returned ${queryResults.length} results`);
              queryResults.forEach((result, i) => {
                console.log(`\n   Result ${i + 1}:`);
                console.log(`      Score: ${result.score.toFixed(4)}`);
                console.log(`      Citation: ${result.metadata.citation}`);
                console.log(`      Text: ${result.metadata.text.substring(0, 150)}...`);
              });
              
              console.log('\n' + '='.repeat(60));
              console.log('✅ END-TO-END TEST SUCCESSFUL! 🎉');
              console.log('='.repeat(60));
              console.log('\nThe RAG pipeline is working correctly!');
              console.log('You can now run full ingestion with:');
              console.log('   node run-ingestion.js');
              
              return;
            }
          } catch (error) {
            console.log(`⚠️  Error checking folder ${folder.name}:`, error.message);
          }
        }
        
        console.log('\n⚠️  No PDFs found in any folder');
      }
    } catch (error) {
      console.log('❌ SharePoint error:', error.message);
      
      if (error.message.includes('403') || error.message.includes('401')) {
        console.log('\n💡 Permission Issues:');
        console.log('   Go to Azure Portal → Your App → API Permissions');
        console.log('   Add: Sites.Read.All and Files.Read.All');
        console.log('   Then: Grant admin consent');
      }
    }
    
  } catch (error) {
    console.log('\n❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run test
testRAGPipeline()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
