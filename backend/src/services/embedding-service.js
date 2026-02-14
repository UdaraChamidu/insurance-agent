import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Embedding Generation Service
 * Creates vector embeddings from text chunks using Google Gemini gemini-embedding-001
 * Note: gemini-embedding-001 outputs 3072 dims by default; we truncate to 768 for Pinecone compatibility
 */
class EmbeddingService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    this.model = 'gemini-embedding-001';
    this.dimensions = 768;
    this.requestOptions = {};
    this.batchSize = 20; // Smaller batches to stay within free-tier rate limits
    this.rateLimitDelay = 30000; // 30 seconds between batches (free tier: 100 requests/min)
    this.maxRetries = 3; // Max retries for rate-limited requests
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text) {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model }, this.requestOptions);
      const result = await model.embedContent(text);

      // Truncate to target dimensions (MRL embeddings support truncation)
      return result.embedding.values.slice(0, this.dimensions);
    } catch (error) {
      console.error('❌ Embedding generation error:', error.message);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing) with retry logic
   */
  async generateEmbeddings(texts, retryCount = 0) {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model }, this.requestOptions);
      const result = await model.batchEmbedContents({
        requests: texts.map(text => ({
          content: { parts: [{ text }] }
        }))
      });

      // Truncate each embedding to target dimensions (MRL embeddings support truncation)
      return result.embeddings.map(e => e.values.slice(0, this.dimensions));
    } catch (error) {
      // Retry on rate limit (429) errors
      if (error.message && error.message.includes('429') && retryCount < this.maxRetries) {
        const waitTime = Math.pow(2, retryCount) * 30000; // 30s, 60s, 120s
        console.log(`   ⏳ Rate limited. Retrying in ${waitTime / 1000}s... (attempt ${retryCount + 1}/${this.maxRetries})`);
        await this.sleep(waitTime);
        return this.generateEmbeddings(texts, retryCount + 1);
      }
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
      console.log(`   Using batch size: ${this.batchSize}, delay between batches: ${this.rateLimitDelay / 1000}s`);

      const embeddings = [];
      const batches = this.createBatches(chunks, this.batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchTexts = batch.map(chunk => chunk.text);

        console.log(`   Processing batch ${i + 1}/${batches.length} (${batch.length} chunks)...`);

        try {
          const batchEmbeddings = await this.generateEmbeddings(batchTexts);
          embeddings.push(...batchEmbeddings);

          // Rate limiting - wait between batches to avoid quota exhaustion
          if (i < batches.length - 1) {
            console.log(`   ⏳ Waiting ${this.rateLimitDelay / 1000}s before next batch (rate limit protection)...`);
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
    // Gemini text-embedding-004 is free tier up to limits, then very low cost
    const costPer1kTokens = 0.00001;
    const estimatedCost = (totalTokens / 1000) * costPer1kTokens;

    return {
      totalChunks: chunks.length,
      totalCharacters: totalChars,
      estimatedTokens: totalTokens,
      estimatedCost: estimatedCost,
      costFormatted: `$${estimatedCost.toFixed(6)}`
    };
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
