import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Pinecone Service for RAG Vector Database
 * Manages embeddings storage with namespace-based isolation for regulatory universes
 */
class PineconeService {
  constructor() {
    this.apiKey = process.env.PINECONE_API_KEY;
    this.environment = process.env.PINECONE_ENVIRONMENT;
    this.indexName = process.env.PINECONE_INDEX_NAME || 'elite-deal-broker-compliance';
    
    // Regulatory universe namespaces
    this.namespaces = {
      TRAINING: 'training-reference',
      FL_STATE: 'fl-state-authority',
      CMS_MEDICARE: 'cms-medicare',
      FEDERAL_ACA: 'federal-aca',
      ERISA: 'erisa-irs-selffunded',
      FL_MEDICAID: 'fl-medicaid-agency',
      CARRIER_FMO: 'carrier-fmo-policies'
    };
    
    if (!this.apiKey || this.apiKey === 'your_pinecone_api_key_here') {
      console.warn('⚠️  Pinecone API key not configured.');
      this.isConfigured = false;
      return;
    }
    
    this.isConfigured = true;
    this.client = null;
    this.index = null;
  }
  
  /**
   * Initialize Pinecone client and connect to index
   */
  async initialize() {
    if (!this.isConfigured) {
      throw new Error('Pinecone not configured. Set PINECONE_API_KEY in .env');
    }
    
    try {
      console.log('🔌 Connecting to Pinecone...');
      
      this.client = new Pinecone({
        apiKey: this.apiKey,
      });
      
      // Connect to index
      this.index = this.client.index(this.indexName);
      
      console.log(`✅ Connected to Pinecone index: ${this.indexName}`);
      return true;
    } catch (error) {
      console.error('❌ Pinecone initialization error:', error);
      throw error;
    }
  }
  
  /**
   * Create index if it doesn't exist
   */
  async createIndexIfNeeded() {
    if (!this.isConfigured) {
      throw new Error('Pinecone not configured');
    }
    
    try {
      // List existing indexes
      const indexes = await this.client.listIndexes();
      const indexExists = indexes.indexes?.some(idx => idx.name === this.indexName);
      
      if (indexExists) {
        console.log(`✅ Index "${this.indexName}" already exists`);
        return false;
      }
      
      console.log(`📋 Creating Pinecone index: ${this.indexName}...`);
      
      await this.client.createIndex({
        name: this.indexName,
        dimension: 1536, // OpenAI ada-002 embedding size
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      
      console.log('✅ Index created successfully');
      console.log('⏳ Waiting for index to be ready (this may take 1-2 minutes)...');
      
      // Wait for index to be ready
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      return true;
    } catch (error) {
      console.error('❌ Error creating index:', error);
      throw error;
    }
  }
  
  /**
   * Upsert vectors to a specific namespace
   */
  async upsert(vectors, namespace) {
    if (!this.index) {
      await this.initialize();
    }
    
    try {
      const ns = this.index.namespace(namespace);
      
      await ns.upsert(vectors);
      
      console.log(`✅ Upserted ${vectors.length} vectors to namespace: ${namespace}`);
      return true;
    } catch (error) {
      console.error(`❌ Error upserting to ${namespace}:`, error);
      throw error;
    }
  }
  
  /**
   * Query vectors in a specific namespace with metadata filtering
   */
  async query({ vector, namespace, topK = 10, filter = {} }) {
    if (!this.index) {
      await this.initialize();
    }
    
    try {
      const ns = this.index.namespace(namespace);
      
      const queryRequest = {
        vector,
        topK,
        includeMetadata: true,
        includeValues: false
      };
      
      // Add metadata filter if provided
      if (Object.keys(filter).length > 0) {
        queryRequest.filter = filter;
      }
      
      const results = await ns.query(queryRequest);
      
      return results.matches || [];
    } catch (error) {
      console.error(`❌ Error querying ${namespace}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete vectors by IDs in a namespace
   */
  async deleteByIds(ids, namespace) {
    if (!this.index) {
      await this.initialize();
    }
    
    try {
      const ns = this.index.namespace(namespace);
      await ns.deleteMany(ids);
      
      console.log(`✅ Deleted ${ids.length} vectors from ${namespace}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting from ${namespace}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete all vectors in a namespace
   */
  async deleteNamespace(namespace) {
    if (!this.index) {
      await this.initialize();
    }
    
    try {
      const ns = this.index.namespace(namespace);
      await ns.deleteAll();
      
      console.log(`✅ Deleted all vectors from namespace: ${namespace}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting namespace ${namespace}:`, error);
      throw error;
    }
  }
  
  /**
   * Get index statistics
   */
  async getStats() {
    if (!this.index) {
      await this.initialize();
    }
    
    try {
      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      throw error;
    }
  }
  
  /**
   * Map folder name to namespace
   */
  getFolderNamespace(folderName) {
    const folderMap = {
      '00_TrainingReference': this.namespaces.TRAINING,
      '01_FL_State_Authority': this.namespaces.FL_STATE,
      '02_CMS_Medicare_Authority': this.namespaces.CMS_MEDICARE,
      '03_Federal_ACA_Authority': this.namespaces.FEDERAL_ACA,
      '04_ERISA_IRS_SelfFunded': this.namespaces.ERISA,
      '05_FL_Medicaid_Agency': this.namespaces.FL_MEDICAID,
      '06_Carrier_FMO_Policies': this.namespaces.CARRIER_FMO
    };
    
    return folderMap[folderName] || null;
  }
  
  /**
   * Check if service is ready
   */
  isReady() {
    return this.isConfigured && this.index !== null;
  }
}

// Export singleton instance
export const pineconeService = new PineconeService();
