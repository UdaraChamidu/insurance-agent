import { authService } from './microsoft-auth.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * SharePoint Service for Knowledge Base Access
 * Fetches PDF files from SharePoint document libraries
 */
class SharePointService {
  constructor() {
    this.siteUrl = process.env.SHAREPOINT_SITE_URL;
    this.kbDevId =process.env.SHAREPOINT_KB_DEV_ID || 'KB-DEV';
    this.kbProdId = process.env.SHAREPOINT_KB_PROD_ID || 'KB-PROD';
    
    // Folder mapping to regulatory universes
    this.folders = [
      { name: '00_TrainingReference', universe: 'training-reference' },
      { name: '01_FL_State_Authority', universe: 'fl-state-authority' },
      { name: '02_CMS_Medicare_Authority', universe: 'cms-medicare' },
      { name: '03_Federal_ACA_Authority', universe: 'federal-aca' },
      { name: '04_ERISA_IRS_SelfFunded', universe: 'erisa-irs-selffunded' },
      { name: '05_FL_Medicaid_Agency', universe: 'fl-medicaid-agency' },
      { name: '06_Carrier_FMO_Policies', universe: 'carrier-fmo-policies' }
    ];
  }
  
  /**
   * Get Microsoft Graph client
   */
  async getGraphClient() {
    if (!authService.isReady()) {
      throw new Error('Microsoft authentication not configured');
    }
    
    return await authService.getGraphClient();
  }
  
  /**
   * Get site information
   */
  async getSiteInfo() {
    try {
      const client = await this.getGraphClient();
      
      // If full URL provided, extract site path
      let sitePath = this.siteUrl;
      if (sitePath.includes('sharepoint.com')) {
        const url = new URL(sitePath);
        sitePath = url.pathname;
      }
      
      const site = await client
        .api(`/sites/root:${sitePath}`)
        .get();
      
      console.log(`✅ Connected to SharePoint site: ${site.displayName}`);
      return site;
    } catch (error) {
      console.error('❌ Error getting site info:', error.message);
      throw new Error(`Failed to access SharePoint site: ${error.message}`);
    }
  }
  
  /**
   * Get document library (KB-DEV or KB-PROD)
   */
  async getDocumentLibrary(libraryName = 'KB-DEV') {
    try {
      const client = await this.getGraphClient();
      const site = await this.getSiteInfo();
      
      // List all document libraries
      const drives = await client
        .api(`/sites/${site.id}/drives`)
        .get();
      
      // Find the KB library
      const library = drives.value.find(drive => 
        drive.name === libraryName || drive.name.includes(libraryName)
      );
      
      if (!library) {
        throw new Error(`Library "${libraryName}" not found`);
      }
      
      console.log(`✅ Found document library: ${library.name}`);
      return library;
    } catch (error) {
      console.error(`❌ Error getting library:`, error.message);
      throw error;
    }
  }
  
  /**
   * List all folders in KB-DEV
   */
  async listFolders(libraryName = 'KB-DEV') {
    try {
      const client = await this.getGraphClient();
      const library = await this.getDocumentLibrary(libraryName);
      
      // Get root items
      const items = await client
        .api(`/drives/${library.id}/root/children`)
        .select('id,name,folder,size,lastModifiedDateTime')
        .get();
      
      // Filter only folders
      const folders = items.value.filter(item => item.folder);
      
      console.log(`✅ Found ${folders.length} folders in ${libraryName}`);
      return folders;
    } catch (error) {
      console.error('❌ Error listing folders:', error.message);
      throw error;
    }
  }
  
  /**
   * List PDF files in a specific folder (legacy - use listDocumentsInFolder)
   */
  async listPDFsInFolder(folderName, libraryName = 'KB-DEV') {
    return this.listDocumentsInFolder(folderName, libraryName);
  }
  
  /**
   * List all supported document files in a specific folder
   * Supports: PDF, DOCX, XLSX, XLS, TXT, MD, CSV
   */
  async listDocumentsInFolder(folderName, libraryName = 'KB-DEV') {
    try {
      const client = await this.getGraphClient();
      const library = await this.getDocumentLibrary(libraryName);
      
      // Get folder items
      const items = await client
        .api(`/drives/${library.id}/root:/${folderName}:/children`)
        .select('id,name,file,size,lastModifiedDateTime,@microsoft.graph.downloadUrl')
        .expand('listItem($expand=fields)')
        .get();
      
      // Supported extensions
      const supportedExts = ['.pdf', '.docx', '.xlsx', '.xls', '.txt', '.md', '.csv'];
      
      // Filter supported documents
      const documents = items.value.filter(item => {
        if (!item.file) return false;
        const fileName = item.name.toLowerCase();
        return supportedExts.some(ext => fileName.endsWith(ext));
      });
      
      // Map to our format with metadata
      const docDetails = documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        size: doc.size,
        lastModified: doc.lastModifiedDateTime,
        downloadUrl: doc['@microsoft.graph.downloadUrl'],
        metadata: this.extractMetadata(doc, folderName)
      }));
      
      console.log(`✅ Found ${docDetails.length} document(s) in ${folderName}`);
      return docDetails;
    } catch (error) {
      console.error(`❌ Error listing documents in ${folderName}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Extract metadata from SharePoint list item
   */
  extractMetadata(file, folderName) {
    const fields = file.listItem?.fields || {};
    
    return {
      state: fields.State || null,
      productUniverse: fields.ProductUniverse || null,
      regulator: fields.Regulator || null,
      authorityLevel: fields.AuthorityLevel || null,
      effectiveDate: fields.EffectiveDate || null,
      docVersion: fields.DocVersion || null,
      topicTags: fields.TopicTags || [],
      carrier: fields.Carrier || null,
      citationPrefix: fields.CitationPrefix || null,
      folderName: folderName
    };
  }
  
  /**
   * Download document file content (PDF, DOCX, XLSX, TXT, etc.)
   */
  async downloadDocument(downloadUrl) {
    try {
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      console.error('❌ Error downloading PDF:', error.message);
      throw error;
    }
  }
  
  /**
   * Sync all documents from all folders
   * Supports: PDF, DOCX, XLSX, TXT, MD, CSV
   */
  async syncAllFolders(libraryName = 'KB-DEV') {
    try {
      console.log('🔄 Starting SharePoint sync (all document types)...');
      
      const allDocuments = [];
      
      for (const folder of this.folders) {
        console.log(`\n📁 Syncing folder: ${folder.name}...`);
        
        try {
          const documents = await this.listDocumentsInFolder(folder.name, libraryName);
          
          // Add universe namespace to each document
          documents.forEach(doc => {
            doc.namespace = folder.universe;
          });
          
          allDocuments.push(...documents);
          
          console.log(`   ✅ ${documents.length} document(s) found`);
        } catch (error) {
          console.error(`   ⚠️  Error syncing ${folder.name}:`, error.message);
          // Continue with other folders
        }
      }
      
      console.log(`\n✅ Sync complete: ${allDocuments.length} total documents found`);
      return allDocuments;
    } catch (error) {
      console.error('❌ Sync error:', error);
      throw error;
    }
  }
  
  /**
   * Legacy alias - use syncAllFolders instead
   */
  async downloadPDF(downloadUrl) {
    return this.downloadDocument(downloadUrl);
  }
  
  /**
   * Check if service is ready
   */
  isReady() {
    return authService.isReady() && this.siteUrl && this.siteUrl !== 'https://helmygenesis.sharepoint.com/sites/YourSiteName';
  }
}

// Export singleton instance
export const sharePointService = new SharePointService();
