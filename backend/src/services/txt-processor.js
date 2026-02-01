import { promises as fs } from 'fs';

/**
 * TXT (Plain Text) Document Processor
 * Reads plain text files
 */
class TxtProcessor {
  /**
   * Extract text from TXT buffer
   */
  async extractText(txtBuffer) {
    try {
      console.log('📝 Reading plain text file...');
      
      // Convert buffer to string (assume UTF-8)
      const text = txtBuffer.toString('utf-8');
      
      const extracted = {
        text: text,
        lineCount: text.split('\n').length,
        wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
        charCount: text.length
      };
      
      console.log(`✅ Read ${extracted.lineCount} lines, ${extracted.wordCount} words, ${extracted.charCount} characters`);
      
      return extracted;
    } catch (error) {
      console.error('❌ TXT reading error:', error.message);
      throw new Error(`Failed to read TXT file: ${error.message}`);
    }
  }
  
  /**
   * Process TXT file (similar to processPDF)
   */
  async processDocument(txtBuffer, fileName) {
    try {
      console.log(`\n📝 Processing TXT: ${fileName}`);
      
      const extracted = await this.extractText(txtBuffer);
      
      // Clean the text
      const cleanedText = this.cleanText(extracted.text);
      
      // Try to identify sections
      const sections = this.identifyHeadings(cleanedText);
      
      return {
        text: cleanedText,
        rawText: extracted.text,
        fileName: fileName,
        fileType: 'txt',
        lineCount: extracted.lineCount,
        wordCount: extracted.wordCount,
        charCount: extracted.charCount,
        sections: sections
      };
    } catch (error) {
      console.error(`❌ Error processing TXT ${fileName}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Clean text
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
      // - Lines with markdown headers (# Header)
      // - Lines that are all caps
      // - Lines with numbering (1. Header, 1.1 Header)
      // - Lines followed by underlines (===, ---)
      
      // Markdown headers
      const mdHeaderMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (mdHeaderMatch) {
        headings.push({
          text: mdHeaderMatch[2],
          lineNumber: index,
          type: 'markdown',
          level: mdHeaderMatch[1].length
        });
        return;
      }
      
      // Numbered sections
      const numberedMatch = trimmed.match(/^(\d+\.(\d+\.)*)\s+(.+)$/);
      if (numberedMatch) {
        headings.push({
          text: numberedMatch[3],
          lineNumber: index,
          type: 'numbered',
          number: numberedMatch[1]
        });
        return;
      }
      
      // All caps (short lines only)
      if (trimmed.length > 3 && trimmed.length < 80 && trimmed === trimmed.toUpperCase()) {
        // Check if it's not just numbers/symbols
        if (/[A-Z]/.test(trimmed)) {
          headings.push({
            text: trimmed,
            lineNumber: index,
            type: 'caps'
          });
        }
      }
      
      // Check for underlines
      if (index > 0 && /^[=\-]{3,}$/.test(trimmed)) {
        const prevLine = lines[index - 1].trim();
        if (prevLine.length > 0) {
          headings.push({
            text: prevLine,
            lineNumber: index - 1,
            type: 'underlined',
            underlineChar: trimmed[0]
          });
        }
      }
    });
    
    console.log(`📑 Identified ${headings.length} potential headings`);
    return headings;
  }
}

// Export singleton
export const txtProcessor = new TxtProcessor();
