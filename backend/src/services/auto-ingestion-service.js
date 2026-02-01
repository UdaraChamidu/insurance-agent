import { sharePointService } from './sharepoint-service.js';
import { documentProcessor } from './document-processor.js';
import { chunkingService } from './chunking-service.js';
import { embeddingService } from './embedding-service.js';
import { pineconeService } from './pinecone-service.js';

/**
 * Auto-Ingestion Service
 * Automatically processes new files uploaded to SharePoint
 * Uses polling to check for new/modified files
 */
class AutoIngestionService {
  constructor() {
    this.pollingInterval = 5 * 60 * 1000; // 5 minutes
    this.isRunning = false;
    this.intervalId = null;
    this.processedFiles = new Map(); // Track processed files by ID + lastModified
    this.stats = {
      totalChecks: 0,
      filesProcessed: 0,
      lastCheck: null,
      errors: []
    };
  }
  
  /**
   * Start polling for new files
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Auto-ingestion already running');
      return;
    }
    
    console.log('\n🚀 Starting Auto-Ingestion Service...');
    console.log(`📡 Polling interval: ${this.pollingInterval / 1000 / 60} minutes`);
    
    // Initialize Pinecone once
    try {
      await pineconeService.initialize();
      console.log('✅ Pinecone initialized\n');
    } catch (error) {
      console.error('❌ Failed to initialize Pinecone:', error.message);
      throw error;
    }
    
    // Initial check
    await this.checkForNewFiles();
    
    // Start polling
    this.isRunning = true;
    this.intervalId = setInterval(async () => {
      await this.checkForNewFiles();
    }, this.pollingInterval);
    
    console.log('✅ Auto-ingestion service started!\n');
  }
  
  /**
   * Stop polling
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Auto-ingestion not running');
      return;
    }
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    console.log('\n⏸️  Auto-ingestion service stopped\n');
  }
  
  /**
   * Check for new or modified files
   */
  async checkForNewFiles() {
    try {
      console.log(`\n🔍 Checking for new files... (${new Date().toLocaleTimeString()})`);
      
      this.stats.totalChecks++;
      this.stats.lastCheck = new Date();
      
      // Fetch all documents from SharePoint
      const documents = await sharePointService.syncAllFolders();
      
      const newOrModified = [];
      
      for (const doc of documents) {
        const fileKey = `${doc.id}|${doc.lastModified}`;
        
        // Check if we've already processed this version
        if (!this.processedFiles.has(fileKey)) {
          newOrModified.push(doc);
        }
      }
      
      if (newOrModified.length === 0) {
        console.log('✅ No new files to process\n');
        return;
      }
      
      console.log(`📥 Found ${newOrModified.length} new/modified file(s):`);
      newOrModified.forEach(doc => {
        const fileType = doc.name.split('.').pop().toUpperCase();
        console.log(`   - ${doc.name} [${fileType}]`);
      });
      
      // Process each new file
      for (const doc of newOrModified) {
        await this.processFile(doc);
      }
      
    } catch (error) {
      console.error('❌ Error checking for new files:', error.message);
      this.stats.errors.push({
        timestamp: new Date(),
        error: error.message
      });
    }
  }
  
  /**
   * Process a single file
   */
  async processFile(doc) {
    try {
      const fileType = doc.name.split('.').pop().toUpperCase();
      console.log(`\n⚙️  Processing: ${doc.name} [${fileType}]...`);
      
      // Download document
      const docBuffer = await sharePointService.downloadDocument(doc.downloadUrl);
      
      // Extract text
      const processed = await documentProcessor.processDocument(docBuffer, doc.name);
      
      // Create chunks
      const chunks = await chunkingService.createChunks(
        processed,
        doc.metadata,
        doc.namespace
      );
      
      console.log(`   📝 Created ${chunks.length} chunks`);
      
      // Generate embeddings
      const vectors = await embeddingService.createVectorsForPinecone(chunks);
      
      console.log(`   🔢 Generated ${vectors.length} vectors`);
      
      // Upload to Pinecone
      await pineconeService.upsert(vectors, doc.namespace);
      
      console.log(`   ✅ Uploaded to namespace: ${doc.namespace}`);
      
      // Mark as processed
      const fileKey = `${doc.id}|${doc.lastModified}`;
      this.processedFiles.set(fileKey, {
        fileName: doc.name,
        namespace: doc.namespace,
        processedAt: new Date(),
        chunks: chunks.length,
        vectors: vectors.length
      });
      
      this.stats.filesProcessed++;
      
      console.log(`✅ Successfully processed ${doc.name}\n`);
      
    } catch (error) {
      console.error(`❌ Error processing ${doc.name}:`, error.message);
      this.stats.errors.push({
        timestamp: new Date(),
        file: doc.name,
        error: error.message
      });
    }
  }
  
  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      processedFileCount: this.processedFiles.size,
      pollingIntervalMinutes: this.pollingInterval / 1000 / 60
    };
  }
  
  /**
   * Get list of processed files
   */
  getProcessedFiles() {
    return Array.from(this.processedFiles.entries()).map(([key, data]) => ({
      key,
      ...data
    }));
  }
  
  /**
   * Clear processed files history (force reprocess)
   */
  clearHistory() {
    this.processedFiles.clear();
    console.log('🗑️  Cleared processed files history');
  }
  
  /**
   * Set polling interval
   */
  setPollingInterval(minutes) {
    const oldInterval = this.pollingInterval;
    this.pollingInterval = minutes * 60 * 1000;
    
    console.log(`⏱️  Polling interval changed: ${oldInterval / 1000 / 60} → ${minutes} minutes`);
    
    // Restart if running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

// Export singleton
export const autoIngestionService = new AutoIngestionService();
