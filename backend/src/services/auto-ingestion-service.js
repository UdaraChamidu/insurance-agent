import { sharePointService } from './sharepoint-service.js';
import { documentProcessor } from './document-processor.js';
import { chunkingService } from './chunking-service.js';
import { embeddingService } from './embedding-service.js';
import { pineconeService } from './pinecone-service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Auto-Ingestion Service
 * Automatically processes new files uploaded to SharePoint
 * Uses polling to check for new/modified files
 * Persists processed file tracking to disk to avoid re-processing on restart
 */
class AutoIngestionService {
  constructor() {
    this.pollingInterval = 5 * 60 * 1000; // 5 minutes
    this.isRunning = false;
    this.intervalId = null;
    this.processedFiles = new Map(); // Track processed files by ID + lastModified
    this.trackingFilePath = path.join(__dirname, '..', '..', 'data', 'processed-files.json');
    this.stats = {
      totalChecks: 0,
      filesProcessed: 0,
      lastCheck: null,
      errors: []
    };
    
    // Load previously processed files from disk
    this.loadProcessedFiles();
  }
  
  /**
   * Load processed files tracking from disk
   */
  loadProcessedFiles() {
    try {
      if (fs.existsSync(this.trackingFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.trackingFilePath, 'utf-8'));
        this.processedFiles = new Map(Object.entries(data));
        console.log(`📂 Loaded ${this.processedFiles.size} previously processed file(s) from tracking`);
      }
    } catch (error) {
      console.warn('⚠️  Could not load processed files tracking:', error.message);
    }
  }
  
  /**
   * Save processed files tracking to disk
   */
  saveProcessedFiles() {
    try {
      const dir = path.dirname(this.trackingFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Object.fromEntries(this.processedFiles);
      fs.writeFileSync(this.trackingFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('⚠️  Could not save processed files tracking:', error.message);
    }
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
        
        // Check if we've already processed this exact version
        if (!this.processedFiles.has(fileKey)) {
          // Check if this is a modification (same doc ID, different lastModified)
          const previousVersion = this.findPreviousVersion(doc.id);
          if (previousVersion) {
            doc._isModified = true;
            doc._previousKey = previousVersion.key;
            doc._previousData = previousVersion.data;
          }
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
        const label = doc._isModified ? '🔄 MODIFIED' : '🆕 NEW';
        console.log(`   - ${doc.name} [${fileType}] ${label}`);
      });
      
      // Check if data already exists in Pinecone for these files
      try {
        const stats = await pineconeService.getStats();
        const totalVectors = stats.totalRecordCount || 0;
        if (totalVectors > 0) {
          console.log(`📊 Pinecone already has ${totalVectors} vectors.`);
        }
      } catch (e) {
        // Non-critical, continue
      }
      
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
   * Find a previous version of a file by doc ID (different lastModified)
   */
  findPreviousVersion(docId) {
    for (const [key, data] of this.processedFiles.entries()) {
      // Keys are formatted as "{docId}|{lastModified}"
      if (key.startsWith(docId + '|')) {
        return { key, data };
      }
    }
    return null;
  }
  
  /**
   * Sanitize filename to match chunk ID prefix pattern
   * Must match ChunkingService.sanitizeFileName for correct ID matching
   */
  sanitizeFileName(fileName) {
    return fileName
      .replace('.pdf', '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase();
  }
  
  /**
   * Process a single file
   */
  async processFile(doc) {
    try {
      const fileType = doc.name.split('.').pop().toUpperCase();
      console.log(`\n⚙️  Processing: ${doc.name} [${fileType}]...`);
      
      // If this is a modified file, clean up old vectors first
      if (doc._isModified && doc._previousData) {
        const previousNamespace = doc._previousData.namespace || doc.namespace;
        const filePrefix = this.sanitizeFileName(doc.name);
        
        console.log(`🔄 File modification detected! Cleaning up old vectors...`);
        console.log(`   Previous version processed at: ${doc._previousData.processedAt}`);
        console.log(`   Previous vectors: ${doc._previousData.vectors || 'unknown'}`);
        
        try {
          const deletedCount = await pineconeService.deleteByFilePrefix(filePrefix, previousNamespace);
          console.log(`   ✅ Cleaned up ${deletedCount} old vectors from namespace: ${previousNamespace}`);
          
          // Remove old tracking entry
          this.processedFiles.delete(doc._previousKey);
          this.saveProcessedFiles();
        } catch (cleanupError) {
          console.error(`   ⚠️  Cleanup failed: ${cleanupError.message}. Proceeding with re-ingestion anyway.`);
        }
      }
      
      // Download document
      const docBuffer = await sharePointService.downloadDocument(doc.downloadUrl, doc.driveId, doc.id);
      
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
      
      if (vectors.length === 0) {
        console.warn(`⚠️  No vectors generated for ${doc.name} - skipping upload`);
        // Still mark as processed to avoid re-trying immediately
        const fileKey = `${doc.id}|${doc.lastModified}`;
        this.processedFiles.set(fileKey, {
          fileName: doc.name,
          namespace: doc.namespace,
          processedAt: new Date().toISOString(),
          chunks: chunks.length,
          vectors: 0,
          status: 'no_vectors'
        });
        this.saveProcessedFiles();
        return;
      }
      
      console.log(`   🔢 Generated ${vectors.length} vectors`);
      
      // Upload to Pinecone
      await pineconeService.upsert(vectors, doc.namespace);
      
      console.log(`   ✅ Uploaded to namespace: ${doc.namespace}`);
      
      // Mark as processed
      const fileKey = `${doc.id}|${doc.lastModified}`;
      this.processedFiles.set(fileKey, {
        fileName: doc.name,
        namespace: doc.namespace,
        processedAt: new Date().toISOString(),
        chunks: chunks.length,
        vectors: vectors.length,
        status: 'success'
      });
      
      // Save tracking to disk
      this.saveProcessedFiles();
      
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
    // Also delete the tracking file
    try {
      if (fs.existsSync(this.trackingFilePath)) {
        fs.unlinkSync(this.trackingFilePath);
      }
    } catch (e) {
      // ignore
    }
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
