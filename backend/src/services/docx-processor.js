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
      
      const result = await mammoth.extractRawText({ buffer: docxBuffer });
      
      const extracted = {
        text: result.text,
        wordCount: result.text.split(/\s+/).filter(w => w.length > 0).length,
        charCount: result.text.length,
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
        fileName: fileName,
        fileType: 'docx',
        wordCount: extracted.wordCount,
        charCount: extracted.charCount,
        sections: sections,
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
