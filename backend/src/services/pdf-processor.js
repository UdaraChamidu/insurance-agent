/**
 * PDF Processing Service
 * Extracts text from PDF files and prepares for chunking
 */
class PDFProcessor {
  constructor() {
    this.options = {
      max: 0, // Process all pages
      version: 'v2.0.550', // Use latest PDF.js version
    };
    this.pdfParse = null;
  }
  
  async init() {
    if (!this.pdfParse) {
      // Use dynamic import for pdf-parse (CommonJS module)
      const module = await import('pdf-parse');
      this.pdfParse = module.default;
    }
  }
  
  /**
   * Extract text from PDF buffer
   */
  async extractText(pdfBuffer) {
    try {
      await this.init();
      
      console.log('📄 Extracting text from PDF...');
      
      const data = await this.pdfParse(pdfBuffer, this.options);
      
      const result = {
        text: data.text,
        numPages: data.numpages,
        info: data.info,
        metadata: data.metadata,
        version: data.version
      };
      
      console.log(`✅ Extracted ${data.text.length} characters from ${data.numpages} pages`);
      
      return result;
    } catch (error) {
      console.error('❌ PDF extraction error:', error.message);
      throw new Error(`Failed to extract PDF text: ${error.message}`);
    }
  }
  
  /**
   * Clean extracted text (remove page numbers, headers, footers, extra whitespace)
   */
  cleanText(text) {
    let cleaned = text;
    
    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove page numbers (common patterns)
    cleaned = cleaned.replace(/Page \d+ of \d+/gi, '');
    cleaned = cleaned.replace(/^\d+$/gm, '');
    
    // Remove common header/footer patterns
    cleaned = cleaned.replace(/^(.*?)\r?\n\1/gm, '$1');
    
    // Trim each line
    cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
    
    // Remove multiple consecutive blank lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
  }
  
  /**
   * Extract section headings from text
   * Helps identify semantic boundaries for chunking
   */
  extractHeadings(text) {
    const headings = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Patterns that typically indicate headings
      const isHeading = (
        // All caps (but not too long)
        (line === line.toUpperCase() && line.length > 3 && line.length < 100) ||
        // Numbered sections (e.g., "1.2 Introduction")
        /^\d+\.\d*\s+[A-Z]/.test(line) ||
        // Roman numerals
        /^[IVXLCDM]+\.\s+[A-Z]/.test(line) ||
        // Starts with "Section" or "Chapter"
        /^(Section|Chapter|Article|Part)\s+\d+/i.test(line)
      );
      
      if (isHeading) {
        headings.push({
          text: line,
          lineNumber: i,
          type: this.classifyHeadingType(line)
        });
      }
    }
    
    return headings;
  }
  
  /**
   * Classify heading type (for hierarchy)
   */
  classifyHeadingType(heading) {
    if (/^\d+\.\s+/.test(heading)) return 'level1'; // "1. Introduction"
    if (/^\d+\.\d+\s+/.test(heading)) return 'level2'; // "1.2 Background"
    if (/^\d+\.\d+\.\d+\s+/.test(heading)) return 'level3'; // "1.2.3 Details"
    if (/^[IVXLCDM]+\.\s+/.test(heading)) return 'roman';
    if (/^(Section|Chapter|Article|Part)/i.test(heading)) return 'section';
    return 'general';
  }
  
  /**
   * Process PDF file: extract text, clean, and prepare for chunking
   */
  async processPDF(pdfBuffer, fileName) {
    try {
      console.log(`\n🔄 Processing PDF: ${fileName}`);
      
      // Extract raw text
      const extracted = await this.extractText(pdfBuffer);
      
      // Clean text
      const cleanedText = this.cleanText(extracted.text);
      
      // Extract headings for semantic chunking
      const headings = this.extractHeadings(cleanedText);
      
      // Extract metadata from PDF properties
      const metadata = {
        title: extracted.info?.Title || fileName.replace('.pdf', ''),
        author: extracted.info?.Author || null,
        subject: extracted.info?.Subject || null,
        keywords: extracted.info?.Keywords || null,
        creationDate: extracted.info?.CreationDate || null,
        modificationDate: extracted.info?.ModDate || null,
        producer: extracted.info?.Producer || null,
        numPages: extracted.numPages,
        fileName: fileName
      };
      
      const result = {
        text: cleanedText,
        headings: headings,
        metadata: metadata,
        rawLength: extracted.text.length,
        cleanedLength: cleanedText.length
      };
      
      console.log(`✅ Processed successfully:`);
      console.log(`   - Pages: ${metadata.numPages}`);
      console.log(`   - Characters: ${cleanedText.length}`);
      console.log(`   - Headings found: ${headings.length}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Error processing ${fileName}:`, error.message);
      throw error;
    }
  }
}

// Export singleton instance
export const pdfProcessor = new PDFProcessor();
