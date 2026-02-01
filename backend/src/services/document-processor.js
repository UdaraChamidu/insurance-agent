import { pdfProcessor } from './pdf-processor.js';
import { docxProcessor } from './docx-processor.js';
import { xlsxProcessor } from './xlsx-processor.js';
import { txtProcessor } from './txt-processor.js';

/**
 * Universal Document Processor
 * Routes documents to the appropriate processor based on file type
 * Supports: PDF, DOCX, XLSX, TXT, HTML
 */
class DocumentProcessor {
  constructor() {
    this.supportedFormats = {
      'pdf': pdfProcessor,
      'docx': docxProcessor,
      'xlsx': xlsxProcessor,
      'xls': xlsxProcessor,  // Old Excel format
      'txt': txtProcessor,
      'md': txtProcessor,    // Markdown as text
      'csv': txtProcessor    // CSV as text
    };
  }
  
  /**
   * Get file extension from filename
   */
  getFileExtension(fileName) {
    const match = fileName.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : null;
  }
  
  /**
   * Check if file type is supported
   */
  isSupported(fileName) {
    const ext = this.getFileExtension(fileName);
    return ext &&this.supportedFormats.hasOwnProperty(ext);
  }
  
  /**
   * Get processor for file type
   */
  getProcessor(fileName) {
    const ext = this.getFileExtension(fileName);
    
    if (!ext) {
      throw new Error(`Cannot determine file extension for: ${fileName}`);
    }
    
    const processor = this.supportedFormats[ext];
    
    if (!processor) {
      throw new Error(`Unsupported file format: .${ext}`);
    }
    
    return processor;
  }
  
  /**
   * Process any supported document type
   * Universal interface - works like processPDF
   */
  async processDocument(buffer, fileName) {
    try {
      const ext = this.getFileExtension(fileName);
      console.log(`\n📄 Processing document: ${fileName} (${ext?.toUpperCase()})`);
      
      if (!this.isSupported(fileName)) {
        throw new Error(`Unsupported file format: ${fileName}`);
      }
      
      const processor = this.getProcessor(fileName);
      const result = await processor.processDocument(buffer, fileName);
      
      console.log(`✅ Successfully processed ${fileName}`);
      console.log(`   Type: ${result.fileType}`);
      console.log(`   Text length: ${result.text.length} characters`);
      
      return result;
    } catch (error) {
      console.error(`❌ Error processing ${fileName}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get list of supported file extensions
   */
  getSupportedExtensions() {
    return Object.keys(this.supportedFormats);
  }
  
  /**
   * Get supported MIME types
   */
  getSupportedMimeTypes() {
    return {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xls',
      'text/plain': 'txt',
      'text/markdown': 'md',
      'text/csv': 'csv'
    };
  }
  
  /**
   * Get stats about supported formats
   */
  getStats() {
    return {
      supportedFormats: this.getSupportedExtensions().length,
      formats: this.getSupportedExtensions(),
      processors: {
        pdf: 'PDF Documents',
        docx: 'Microsoft Word',
        xlsx: 'Microsoft Excel',
        xls: 'Legacy Excel',
        txt: 'Plain Text',
        md: 'Markdown',
        csv: 'CSV Files'
      }
    };
  }
}

// Export singleton
export const documentProcessor = new DocumentProcessor();

/**
 * Utility function to check if a file should be processed
 */
export function shouldProcessFile(fileName) {
  return documentProcessor.isSupported(fileName);
}

/**
 * Legacy compatibility - alias for processDocument
 * This allows existing code using processPDF to work with new processor
 */
export async function processPDF(buffer, fileName) {
  return documentProcessor.processDocument(buffer, fileName);
}
