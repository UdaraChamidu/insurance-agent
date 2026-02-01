/**
 * Intelligent Text Chunking Service
 * Creates semantically meaningful chunks with proper overlap and context preservation
 */
class ChunkingService {
  constructor() {
    // Configurable chunking parameters
    this.chunkSize = 800; // Characters per chunk (approx 150-200 words)
    this.chunkOverlap = 200; // Overlap to preserve context
    this.separators = ['\n\n', '\n', '. ', ' ']; // Semantic boundaries
  }
  
  /**
   * Custom text splitter (replaces langchain dependency)
   */
  splitText(text) {
    const chunks = [];
    let currentChunk = '';
    const sentences = text.split(/(?<=[.!?])\s+/); // Split by sentences
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= this.chunkSize) {
        currentChunk += sentence + ' ';
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence + ' ';
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.map(chunk => ({ pageContent: chunk }));
  }
  
  /**
   * Create chunks from processed PDF text
   */
  async createChunks(processedPDF, sharePointMetadata, namespace) {
    try {
      console.log(`\n✂️  Chunking document: ${processedPDF.metadata.fileName}`);
      
      const { text, headings, metadata } = processedPDF;
      
      // Use custom splitter
      const textChunks = this.splitText(text);
      
      // Enhance chunks with metadata and context
      const enhancedChunks = textChunks.map((chunk, index) => {
        // Find the section this chunk belongs to
        const section = this.findRelevantSection(chunk.pageContent, headings);
        
        // Create unique chunk ID
        const chunkId = `${this.sanitizeFileName(metadata.fileName)}_chunk_${index.toString().padStart(4, '0')}`;
        
        return {
          id: chunkId,
          text: chunk.pageContent,
          chunkIndex: index,
          totalChunks: textChunks.length,
          
          // Section context
          section: section?.text || 'General',
          sectionType: section?.type || 'general',
          
          // Document metadata
          fileName: metadata.fileName,
          documentTitle: metadata.title,
          numPages: metadata.numPages,
          author: metadata.author,
          
          // SharePoint metadata (compliance-critical!)
          state: sharePointMetadata.state,
          productUniverse: sharePointMetadata.productUniverse,
          regulator: sharePointMetadata.regulator,
          authorityLevel: sharePointMetadata.authorityLevel,
          effectiveDate: sharePointMetadata.effectiveDate,
          docVersion: sharePointMetadata.docVersion,
          topicTags: sharePointMetadata.topicTags || [],
          carrier: sharePointMetadata.carrier,
          citationPrefix: sharePointMetadata.citationPrefix,
          folderName: sharePointMetadata.folderName,
          
          // Namespace for Pinecone
          namespace: namespace,
          
          // Timestamps
          processedAt: new Date().toISOString(),
          
          // For retrieval quality
          characterCount: chunk.pageContent.length,
          wordCount: this.countWords(chunk.pageContent)
        };
      });
      
      console.log(`✅ Created ${enhancedChunks.length} chunks`);
      console.log(`   Average chunk size: ${Math.round(enhancedChunks.reduce((sum, c) => sum + c.characterCount, 0) / enhancedChunks.length)} chars`);
      
      return enhancedChunks;
    } catch (error) {
      console.error('❌ Chunking error:', error.message);
      throw error;
    }
  }
  
  /**
   * Find which section a chunk belongs to based on headings
   */
  findRelevantSection(chunkText, headings) {
    if (!headings || headings.length === 0) {
      return null;
    }
    
    // Find the heading that appears in or before this chunk
    for (let i = headings.length - 1; i >= 0; i--) {
      const heading = headings[i];
      
      // Check if heading text appears in chunk
      if (chunkText.includes(heading.text)) {
        return heading;
      }
    }
    
    return headings[0]; // Default to first heading
  }
  
  /**
   * Count words in text
   */
  countWords(text) {
    return text.trim().split(/\s+/).length;
  }
  
  /**
   * Sanitize filename for use in IDs
   */
  sanitizeFileName(fileName) {
    return fileName
      .replace('.pdf', '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase();
  }
  
  /**
   * Create citation text for a chunk
   */
  createCitation(chunk) {
    const parts = [];
    
    if (chunk.citationPrefix) {
      parts.push(chunk.citationPrefix);
    }
    
    if (chunk.documentTitle && chunk.documentTitle !== chunk.fileName) {
      parts.push(chunk.documentTitle);
    } else {
      parts.push(chunk.fileName);
    }
    
    if (chunk.effectiveDate) {
      const date = new Date(chunk.effectiveDate);
      parts.push(`(Effective: ${date.toLocaleDateString()})`);
    }
    
    if (chunk.section && chunk.section !== 'General') {
      parts.push(`§ ${chunk.section}`);
    }
    
    return parts.join(', ');
  }
  
  /**
   * Validate chunk quality
   */
  validateChunk(chunk) {
    const issues = [];
    
    // Check minimum length
    if (chunk.characterCount < 50) {
      issues.push('Chunk too short');
    }
    
    // Check maximum length
    if (chunk.characterCount > this.chunkSize * 1.5) {
      issues.push('Chunk too long');
    }
    
    // Check for critical metadata
    if (!chunk.namespace) {
      issues.push('Missing namespace');
    }
    
    if (!chunk.authorityLevel) {
      issues.push('Missing authority level (compliance risk!)');
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }
  
  /**
   * Batch process multiple PDFs
   */
  async batchCreateChunks(processedPDFs, sharePointMetadataList, namespaces) {
    const allChunks = [];
    
    for (let i = 0; i < processedPDFs.length; i++) {
      try {
        const chunks = await this.createChunks(
          processedPDFs[i],
          sharePointMetadataList[i],
          namespaces[i]
        );
        
        // Validate chunks
        chunks.forEach(chunk => {
          const validation = this.validateChunk(chunk);
          if (!validation.isValid) {
            console.warn(`⚠️  Chunk validation issues for ${chunk.id}:`, validation.issues);
          }
        });
        
        allChunks.push(...chunks);
      } catch (error) {
        console.error(`❌ Error chunking PDF ${i + 1}:`, error.message);
        // Continue with other PDFs
      }
    }
    
    console.log(`\n✅ Batch chunking complete: ${allChunks.length} total chunks from ${processedPDFs.length} PDFs`);
    
    return allChunks;
  }
}

// Export singleton instance
export const chunkingService = new ChunkingService();
