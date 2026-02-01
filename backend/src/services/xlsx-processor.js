import xlsx from 'xlsx';

/**
 * XLSX (Microsoft Excel) Spreadsheet Processor
 * Extracts text content from .xlsx files
 */
class XlsxProcessor {
  /**
   * Extract text from XLSX buffer
   */
  async extractText(xlsxBuffer) {
    try {
      console.log('📊 Extracting text from XLSX...');
      
      const workbook = xlsx.read(xlsxBuffer, { type: 'buffer' });
      
      const allText = [];
      const sheetData = [];
      
      // Process each sheet
      workbook.SheetNames.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to CSV format (preserves structure)
        const csv = xlsx.utils.sheet_to_csv(sheet);
        
        // Also get JSON for structured data
        const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        sheetData.push({
          name: sheetName,
          text: csv,
          rows: json.length,
          data: json
        });
        
        // Add sheet name as heading
        allText.push(`\n=== SHEET: ${sheetName} ===\n`);
        allText.push(csv);
        allText.push('\n');
      });
      
      const combinedText = allText.join('');
      
      const extracted = {
        text: combinedText,
        sheetCount: workbook.SheetNames.length,
        sheets: sheetData,
        totalRows: sheetData.reduce((sum, sheet) => sum + sheet.rows, 0),
        charCount: combinedText.length
      };
      
      console.log(`✅ Extracted ${extracted.sheetCount} sheet(s), ${extracted.totalRows} rows, ${extracted.charCount} characters`);
      
      return extracted;
    } catch (error) {
      console.error('❌ XLSX extraction error:', error.message);
      throw new Error(`Failed to extract XLSX text: ${error.message}`);
    }
  }
  
  /**
   * Process XLSX file (similar to processPDF)
   */
  async processDocument(xlsxBuffer, fileName) {
    try {
      console.log(`\n📊 Processing XLSX: ${fileName}`);
      
      const extracted = await this.extractText(xlsxBuffer);
      
      // Clean the text
      const cleanedText = this.cleanText(extracted.text);
      
      // Create sections for each sheet
      const sections = extracted.sheets.map((sheet, index) => ({
        text: `Sheet: ${sheet.name}`,
        lineNumber: index * 100,  // Approximate
        type: 'sheet',
        rows: sheet.rows
      }));
      
      return {
        text: cleanedText,
        rawText: extracted.text,
        fileName: fileName,
        fileType: 'xlsx',
        sheetCount: extracted.sheetCount,
        totalRows: extracted.totalRows,
        charCount: extracted.charCount,
        sections: sections,
        sheets: extracted.sheets  // Include structured data
      };
    } catch (error) {
      console.error(`❌ Error processing XLSX ${fileName}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Clean extracted text
   */
  cleanText(text) {
    return text
      .replace(/,{3,}/g, ',')  // Remove excessive commas
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .replace(/  +/g, ' ')  // Remove multiple spaces
      .trim();
  }
  
  /**
   * Extract key-value pairs from structured data
   * Useful for forms, tables with headers, etc.
   */
  extractKeyValuePairs(sheetData) {
    const pairs = [];
    
    sheetData.sheets.forEach(sheet => {
      if (sheet.data.length > 1) {
        // Assume first row is headers
        const headers = sheet.data[0];
        
        // Process each data row
        for (let i = 1; i < sheet.data.length; i++) {
          const row = sheet.data[i];
          const rowPairs = {};
          
          headers.forEach((header, colIndex) => {
            if (header && row[colIndex]) {
              rowPairs[String(header)] = String(row[colIndex]);
            }
          });
          
          if (Object.keys(rowPairs).length > 0) {
            pairs.push({
              sheet: sheet.name,
              row: i,
              data: rowPairs
            });
          }
        }
      }
    });
    
    return pairs;
  }
}

// Export singleton
export const xlsxProcessor = new XlsxProcessor();
