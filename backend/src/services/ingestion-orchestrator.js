import fs from 'fs';
import path from 'path';
import { sharePointService } from './sharepoint-service.js';
import { documentProcessor } from './document-processor.js';
import { chunkingService } from './chunking-service.js';
import { embeddingService } from './embedding-service.js';
import { pineconeService } from './pinecone-service.js';

const STATE_FILE = path.join(process.cwd(), 'data', 'ingestion-state.json');

/**
 * RAG Ingestion Orchestrator
 * Coordinates the entire pipeline: SharePoint → PDF → Chunks → Embeddings → Pinecone
 */
class IngestionOrchestrator {
  constructor() {
    this.stats = {
      pdfsProcessed: 0,
      chunksCreated: 0,
      vectorsUploaded: 0,
      skipped: 0,
      errors: [],
      startTime: null,
      endTime: null
    };
    
    this.state = this.loadState();
  }

  /**
   * Load ingestion state from disk
   */
  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      }
    } catch (error) {
      console.warn('⚠️ Could not load state file, starting fresh:', error.message);
    }
    return { documents: {}, lastRun: null };
  }

  /**
   * Save ingestion state to disk
   */
  saveState() {
    try {
      // Ensure directory exists
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('❌ Error saving state:', error.message);
    }
  }
  
  /**
   * Run complete ingestion pipeline for all folders
   * @param {boolean} forceRefresh - If true, re-process all files regardless of state
   */
  async runFullIngestion(forceRefresh = false) {
    try {
      console.log('\n🚀 Starting RAG Ingestion Pipeline...\n');
      console.log('=' .repeat(60));
      
      if (forceRefresh) {
        console.log('⚠️  FORCE REFRESH ENABLED: Processing all files');
      } else {
        console.log('ℹ️  INCREMENTAL MODE: Skipping unchanged files');
      }

      this.stats.startTime = new Date();
      
      // Step 1: Initialize Pinecone
      console.log('\n📍 Step 1: Initialize Pinecone');
      await pineconeService.initialize();
      
      // Step 2: Sync SharePoint files
      console.log('\n📍 Step 2: Sync SharePoint Documents (All Types)');
      const documents = await sharePointService.syncAllFolders();
      
      if (documents.length === 0) {
        console.log('⚠️  No documents found in SharePoint. Exiting.');
        return this.getStats();
      }
      
      // Step 3: Filter & Process Documents
      console.log('\n📍 Step 3: Process Documents');
      const processedDocs = [];
      const docsToProcess = [];

      // Filter documents based on state
      for (const doc of documents) {
        const storedDoc = this.state.documents[doc.id];
        const isModified = !storedDoc || storedDoc.lastModified !== doc.lastModified;
        
        if (forceRefresh || isModified) {
          docsToProcess.push(doc);
        } else {
          this.stats.skipped++;
          // console.log(`   ⏭️  Skipped (unchanged): ${doc.name}`);
        }
      }

      console.log(`\n📊 Found ${documents.length} total documents.`);
      console.log(`   Processing: ${docsToProcess.length}`);
      console.log(`   Skipped: ${this.stats.skipped}`);

      /*
      // PREVIOUS LOGIC (COMMENTED OUT AS REQUESTED)
      // for (const doc of documents) {
      //   try {
      //     const fileType = doc.name.split('.').pop().toUpperCase();
      //     console.log(`\n📄 Processing: ${doc.name} [${fileType}] (${(doc.size / 1024).toFixed(1)} KB)`);
      //     // ... download & process ... 
      //   } ...
      // }
      */
      
      for (const doc of docsToProcess) {
        try {
          const fileType = doc.name.split('.').pop().toUpperCase();
          console.log(`\n📄 Processing: ${doc.name} [${fileType}] (${(doc.size / 1024).toFixed(1)} KB)`);
          
          // Download document
          const docBuffer = await sharePointService.downloadDocument(doc.downloadUrl, doc.driveId, doc.id);
          
          // Extract text (works for PDF, DOCX, XLSX, TXT, etc.)
          const processed = await documentProcessor.processDocument(docBuffer, doc.name);
          
          processedDocs.push({
            processed,
            metadata: doc.metadata,
            namespace: doc.namespace,
            fileName: doc.name,
            docId: doc.id,
            lastModified: doc.lastModified
          });
          
          this.stats.pdfsProcessed++;
        } catch (error) {
          console.error(`❌ Error processing ${doc.name}:`, error.message);
          this.stats.errors.push({ file: doc.name, error: error.message });
        }
      }
      
      // Step 4: Create chunks
      console.log(`\n📍 Step 4: Create Chunks from ${processedDocs.length} Documents`);
      const allChunks = [];
      
      for (const item of processedDocs) {
        try {
          const chunks = await chunkingService.createChunks(
            item.processed,
            item.metadata,
            item.namespace
          );
          
          allChunks.push(...chunks);
          this.stats.chunksCreated += chunks.length;
        } catch (error) {
          console.error(`❌ Error chunking ${item.fileName}:`, error.message);
          this.stats.errors.push({ file: item.fileName, error: error.message });
        }
      }
      
      // Step 5: Generate embeddings
      console.log(`\n📍 Step 5: Generate Embeddings for ${allChunks.length} Chunks`);
      
      // Show cost estimate
      const costEstimate = embeddingService.estimateCost(allChunks);
      console.log(`💰 Estimated cost: ${costEstimate.costFormatted}`);
      console.log(`   (~${costEstimate.estimatedTokens.toLocaleString()} tokens)`);
      
      const vectors = await embeddingService.createVectorsForPinecone(allChunks);
      
      // Step 6: Upload to Pinecone (by namespace)
      console.log(`\n📍 Step 6: Upload to Pinecone`);
      const vectorsByNamespace = this.groupVectorsByNamespace(vectors);
      
      for (const [namespace, nsVectors] of Object.entries(vectorsByNamespace)) {
        try {
          console.log(`\n   Uploading to namespace: ${namespace} (${nsVectors.length} vectors)`);
          
          // Upload in batches of 100
          const batches = this.createBatches(nsVectors, 100);
          
          for (let i = 0; i < batches.length; i++) {
            await pineconeService.upsert(batches[i], namespace);
            console.log(`      Batch ${i + 1}/${batches.length} uploaded`);
          }
          
          this.stats.vectorsUploaded += nsVectors.length;
        } catch (error) {
          console.error(`   ❌ Error uploading to ${namespace}:`, error.message);
          this.stats.errors.push({ namespace, error: error.message });
        }
      }
      
      // Step 7: Update State for successful documents
      console.log(`\n📍 Step 7: Update State`);
      let newDocs = 0;
      
      this.state.lastRun = new Date().toISOString();
      
      for (const item of processedDocs) {
        // Check if this document had any errors
        const hasError = this.stats.errors.some(e => e.file === item.fileName);
        
        if (!hasError) {
          this.state.documents[item.docId] = {
            fileName: item.fileName,
            lastModified: item.lastModified,
            processedAt: new Date().toISOString(),
            namespace: item.namespace
          };
          newDocs++;
        }
      }
      
      this.saveState();
      console.log(`✅ State updated for ${newDocs} documents`);
      
      this.stats.endTime = new Date();
      
      // Show summary
      console.log('\n' + '='.repeat(60));
      console.log('✅ INGESTION COMPLETE!\n');
      this.printSummary();
      
      return this.getStats();
    } catch (error) {
      console.error('\n❌ INGESTION FAILED:', error);
      this.stats.endTime = new Date();
      this.stats.errors.push({ stage: 'orchestrator', error: error.message });
      throw error;
    }
  }
  
  /**
   * Process a single PDF file
   */
  async processSinglePDF(folderName, fileName) {
    try {
      console.log(`\n🔄 Processing single PDF: ${fileName} from ${folderName}`);
      
      await pineconeService.initialize();
      
      // Get PDF list from folder
      const pdfs = await sharePointService.listPDFsInFolder(folderName);
      const pdf = pdfs.find(p => p.name === fileName);
      
      if (!pdf) {
        throw new Error(`PDF "${fileName}" not found in folder "${folderName}"`);
      }
      
      // Download and process
      const pdfBuffer = await sharePointService.downloadPDF(pdf.downloadUrl);
      const processed = await pdfProcessor.processPDF(pdfBuffer, pdf.name);
      
      // Create chunks
      const chunks = await chunkingService.createChunks(
        processed,
        pdf.metadata,
        pdf.namespace
      );
      
      // Generate embeddings
      const vectors = await embeddingService.createVectorsForPinecone(chunks);
      
      // Upload to Pinecone
      await pineconeService.upsert(vectors, pdf.namespace);
      
      console.log(`✅ Successfully processed ${fileName}`);
      
      return {
        success: true,
        fileName: pdf.name,
        chunks: chunks.length,
        vectors: vectors.length,
        namespace: pdf.namespace
      };
    } catch (error) {
      console.error('❌ Single PDF processing error:', error);
      throw error;
    }
  }
  
  /**
   * Group vectors by namespace
   */
  groupVectorsByNamespace(vectors) {
    const grouped = {};
    
    for (const vector of vectors) {
      const namespace = vector.metadata.folderName;
      const ns = pineconeService.getFolderNamespace(namespace);
      
      if (!ns) {
        console.warn(`⚠️  Unknown namespace for folder: ${namespace}`);
        continue;
      }
      
      if (!grouped[ns]) {
        grouped[ns] = [];
      }
      
      grouped[ns].push(vector);
    }
    
    return grouped;
  }
  
  /**
   * Create batches from array
   */
  createBatches(array, size) {
    const batches = [];
    for (let i = 0; i < array.length; i += size) {
      batches.push(array.slice(i, i + size));
    }
    return batches;
  }
  
  /**
   * Print summary stats
   */
  printSummary() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    
    console.log('📊 Summary:');
    console.log(`   PDFs Processed: ${this.stats.pdfsProcessed}`);
    console.log(`   Skipped (Unchanged): ${this.stats.skipped}`);
    console.log(`   Chunks Created: ${this.stats.chunksCreated}`);
    console.log(`   Vectors Uploaded: ${this.stats.vectorsUploaded}`);
    console.log(`   Errors: ${this.stats.errors.length}`);
    console.log(`   Duration: ${duration.toFixed(1)}s`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      this.stats.errors.forEach(err => {
        console.log(`   - ${err.file || err.namespace || err.stage}: ${err.error}`);
      });
    }
  }
  
  /**
   * Get stats object
   */
  getStats() {
    return {
      ...this.stats,
      duration: this.stats.endTime ? (this.stats.endTime - this.stats.startTime) / 1000 : null
    };
  }
  
  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      pdfsProcessed: 0,
      chunksCreated: 0,
      vectorsUploaded: 0,
      errors: [],
      startTime: null,
      endTime: null
    };
  }
}

// Export singleton instance
export const ingestionOrchestrator = new IngestionOrchestrator();
