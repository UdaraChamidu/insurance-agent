import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';
import { ClientSecretCredential } from '@azure/identity';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Microsoft Authentication Service
 * Handles OAuth 2.0 authentication with Microsoft Identity Platform
 */
class MicrosoftAuthService {
  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    this.tenantId = process.env.MICROSOFT_TENANT_ID;
    this.redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    if (!this.clientId || !this.clientSecret || !this.tenantId) {
      console.warn('⚠️  Microsoft credentials not configured. Using mock data.');
      this.isConfigured = false;
      return;
    }

    this.isConfigured = true;

    // Initialize MSAL (Microsoft Authentication Library)
    this.msalConfig = {
      auth: {
        clientId: this.clientId,
        authority: `https://login.microsoftonline.com/${this.tenantId}`,
        clientSecret: this.clientSecret,
      },
    };

    this.msalClient = new ConfidentialClientApplication(this.msalConfig);

    // Initialize Azure Identity credential
    this.credential = new ClientSecretCredential(
      this.tenantId,
      this.clientId,
      this.clientSecret
    );

    console.log('✅ Microsoft Authentication Service initialized');
  }

  /**
   * Get access token using client credentials flow
   * This is for app-only access (no user login required)
   */
  async getAccessToken() {
    if (!this.isConfigured) {
      throw new Error('Microsoft credentials not configured');
    }

    try {
      console.log('🔑 Requesting access token...');
      console.log('   Tenant ID:', this.tenantId);
      console.log('   Client ID:', this.clientId);
      
      const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
      };

      const response = await this.msalClient.acquireTokenByClientCredential(tokenRequest);
      
      if (!response || !response.accessToken) {
        throw new Error('Failed to acquire access token');
      }

      console.log('✅ Access token acquired successfully');
      return response.accessToken;
    } catch (error) {
      console.error('❌ Error getting access token:');
      console.error('   Error message:', error.message);
      console.error('   Error code:', error.errorCode);
      console.error('   Status:', error.status);
      
      if (error.errorCode === 'invalid_client') {
        console.error('\n⚠️  INVALID CLIENT - Possible issues:');
        console.error('   1. Client Secret is incorrect or expired');
        console.error('   2. Client ID or Tenant ID is wrong');
        console.error('   3. Generate a new Client Secret in Azure Portal');
      }
      
      if (error.status === 401 || error.status === 403) {
        console.error('\n⚠️  AUTHENTICATION FAILED - Possible issues:');
        console.error('   1. API permissions not granted');
        console.error('   2. Admin consent not provided');
        console.error('   3. Wait 5-10 minutes after granting permissions');
      }
      
      throw error;
    }
  }

  /**
   * Create authenticated Microsoft Graph client
   */
  async getGraphClient() {
    if (!this.isConfigured) {
      throw new Error('Microsoft credentials not configured');
    }

    try {
      const accessToken = await this.getAccessToken();

      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      return client;
    } catch (error) {
      console.error('Error creating Graph client:', error);
      throw error;
    }
  }

  /**
   * Check if Microsoft integration is properly configured
   */
  isReady() {
    return this.isConfigured;
  }
}

// Export singleton instance
export const authService = new MicrosoftAuthService();
