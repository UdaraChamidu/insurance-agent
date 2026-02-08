import mammoth from 'mammoth';

/**
 * DOCX (Microsoft Word) Document Processor
 * Extracts text content from .docx files
 */
class DocxProcessor {
  /**
   * Extract text from DOCX buffer
   */
  async extractText(docxBuffer) {
    try {
      console.log('📄 Extracting text from DOCX...');
      
      // Ensure buffer is in the correct format for mammoth
      let buffer = docxBuffer;
      if (docxBuffer instanceof ArrayBuffer) {
        buffer = Buffer.from(docxBuffer);
      }
      
      const result = await mammoth.extractRawText({ buffer: buffer });
      
      // Handle case where result.text might be undefined or null
      const text = result.value || result.text || '';
      
      if (!text || text.trim().length === 0) {
        console.warn('⚠️  DOCX appears to be empty or could not extract text');
      }
      
      const extracted = {
        text: text,
        wordCount: text ? text.split(/\s+/).filter(w => w.length > 0).length : 0,
        charCount: text ? text.length : 0,
        messages: result.messages || []
      };
      
      console.log(`✅ Extracted ${extracted.wordCount} words, ${extracted.charCount} characters`);
      
      if (result.messages && result.messages.length > 0) {
        console.log(`⚠️  ${result.messages.length} conversion message(s)`);
      }
      
      return extracted;
    } catch (error) {
      console.error('❌ DOCX extraction error:', error.message);
      throw new Error(`Failed to extract DOCX text: ${error.message}`);
    }
  }
  
  /**
   * Process DOCX file (similar to processPDF)
   */
  async processDocument(docxBuffer, fileName) {
    try {
      console.log(`\n📘 Processing DOCX: ${fileName}`);
      
      const extracted = await this.extractText(docxBuffer);
      
      // Clean the text
      const cleanedText = this.cleanText(extracted.text);
      
      // Try to identify sections/headings
      const sections = this.identifyHeadings(cleanedText);
      
      return {
        text: cleanedText,
        rawText: extracted.text,
        // Match the PDF processor format for compatibility with chunking service
        headings: sections,
        metadata: {
          fileName: fileName,
          title: fileName.replace(/\.[^/.]+$/, ''),
          fileType: 'docx',
          numPages: Math.ceil(extracted.wordCount / 500), // Approximate pages
          author: null
        },
        wordCount: extracted.wordCount,
        charCount: extracted.charCount,
        conversionMessages: extracted.messages
      };
    } catch (error) {
      console.error(`❌ Error processing DOCX ${fileName}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Clean extracted text
   */
  cleanText(text) {
    return text
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .replace(/\t/g, ' ')  // Replace tabs with spaces
      .replace(/  +/g, ' ')  // Remove multiple spaces
      .trim();
  }
  
  /**
   * Identify headings in text
   */
  identifyHeadings(text) {
    const lines = text.split('\n');
    const headings = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Heuristics for headings:
      // - Short lines (< 100 chars)
      // - All caps or Title Case
      // - Followed by empty line or content
      if (trimmed.length > 0 &&  trimmed.length < 100) {
        const isAllCaps = trimmed === trimmed.toUpperCase();
        const startsWithNumber = /^\d+\./.test(trimmed);
        const endsWithColon = trimmed.endsWith(':');
        
        if (isAllCaps || startsWithNumber || endsWithColon) {
          headings.push({
            text: trimmed,
            lineNumber: index,
            type: isAllCaps ? 'section' : 'subsection'
          });
        }
      }
    });
    
    console.log(`📑 Identified ${headings.length} potential headings`);
    return headings;
  }
}

// Export singleton
export const docxProcessor = new DocxProcessor();
