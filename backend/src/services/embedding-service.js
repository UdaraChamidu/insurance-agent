import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Embedding Generation Service
 * Creates vector embeddings from text chunks using OpenAI ada-002
 */
class EmbeddingService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.model = 'text-embedding-ada-002';
    this.dimensions = 1536;
    this.batchSize = 100; // Process 100 chunks at a time
    this.rateLimitDelay = 200; // ms between batches
  }
  
  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Embedding generation error:', error.message);
      throw error;
    }
  }
  
  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async generateEmbeddings(texts) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts,
      });
      
      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('❌ Batch embedding error:', error.message);
      throw error;
    }
  }
  
  /**
   * Generate embeddings for chunks with progress tracking
   */
  async generateChunkEmbeddings(chunks) {
    try {
      console.log(`\n🧮 Generating embeddings for ${chunks.length} chunks...`);
      
      const embeddings = [];
      const batches = this.createBatches(chunks, this.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchTexts = batch.map(chunk => chunk.text);
        
        console.log(`   Processing batch ${i + 1}/${batches.length} (${batch.length} chunks)...`);
        
        try {
          const batchEmbeddings = await this.generateEmbeddings(batchTexts);
          embeddings.push(...batchEmbeddings);
          
          // Rate limiting
          if (i < batches.length - 1) {
            await this.sleep(this.rateLimitDelay);
          }
        } catch (error) {
          console.error(`   ❌ Error in batch ${i + 1}:`, error.message);
          // Add nulls for failed batch
          embeddings.push(...new Array(batch.length).fill(null));
        }
      }
      
      console.log(`✅ Generated ${embeddings.filter(e => e !== null).length} embeddings`);
      
      return embeddings;
    } catch (error) {
      console.error('❌ Chunk embedding error:', error.message);
      throw error;
    }
  }
  
  /**
   * Create vectors for Pinecone upsert
   */
  async createVectorsForPinecone(chunks) {
    try {
      console.log('\n🎯 Creating vectors for Pinecone...');
      
      // Generate embeddings
      const embeddings = await this.generateChunkEmbeddings(chunks);
      
      // Create Pinecone vector format
      const vectors = chunks.map((chunk, index) => {
        const embedding = embeddings[index];
        
        if (!embedding) {
          console.warn(`⚠️  Skipping chunk ${chunk.id} - no embedding`);
          return null;
        }
        
        return {
          id: chunk.id,
          values: embedding,
          metadata: {
            // Text for retrieval
            text: chunk.text,
            
            // Document info
            fileName: chunk.fileName,
            documentTitle: chunk.documentTitle,
            section: chunk.section,
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            
            // Compliance metadata (filterable!)
            state: chunk.state || 'unknown',
            productUniverse: chunk.productUniverse || 'unknown',
            regulator: chunk.regulator || 'unknown',
            authorityLevel: chunk.authorityLevel || 'unknown',
            effectiveDate: chunk.effectiveDate || '',
            docVersion: chunk.docVersion || '',
            topicTags: chunk.topicTags?.join(',') || '',
            carrier: chunk.carrier || '',
            citationPrefix: chunk.citationPrefix || '',
            folderName: chunk.folderName || '',
            
            // Processing info
            processedAt: chunk.processedAt,
            wordCount: chunk.wordCount,
            
            // For citation generation
            citation: this.createCitation(chunk)
          }
        };
      }).filter(v => v !== null); // Remove failed embeddings
      
      console.log(`✅ Created ${vectors.length} vectors for Pinecone`);
      
      return vectors;
    } catch (error) {
      console.error('❌ Vector creation error:', error.message);
      throw error;
    }
  }
  
  /**
   * Create citation string
   */
  createCitation(chunk) {
    const parts = [];
    
    if (chunk.citationPrefix) {
      parts.push(chunk.citationPrefix);
    }
    
    parts.push(chunk.fileName);
    
    if (chunk.section && chunk.section !== 'General') {
      parts.push(`§ ${chunk.section}`);
    }
    
    if (chunk.effectiveDate) {
      const date = new Date(chunk.effectiveDate);
      parts.push(`(${date.getFullYear()})`);
    }
    
    return parts.join(', ');
  }
  
  /**
   * Split array into batches
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
  
  /**
   * Sleep utility for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Estimate cost for embedding generation
   */
  estimateCost(chunks) {
    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.characterCount, 0);
    const totalTokens = Math.ceil(totalChars / 4); // Rough estimate: 4 chars per token
    const costPer1kTokens = 0.0001;
    const estimatedCost = (totalTokens / 1000) * costPer1kTokens;
    
    return {
      totalChunks: chunks.length,
      totalCharacters: totalChars,
      estimatedTokens: totalTokens,
      estimatedCost: estimatedCost,
      costFormatted: `$${estimatedCost.toFixed(4)}`
    };
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
