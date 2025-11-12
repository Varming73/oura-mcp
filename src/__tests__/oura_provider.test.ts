import { describe, it, expect, beforeEach } from '@jest/globals';
import { OuraProvider } from '../provider/oura_provider.js';

describe('OuraProvider', () => {
  describe('Initialization', () => {
    it('should create provider with Personal Access Token', () => {
      const provider = new OuraProvider({
        personalAccessToken: 'test_token_123'
      });
      expect(provider).toBeDefined();
      expect(provider.getServer()).toBeDefined();
    });

    it('should create provider with OAuth credentials', () => {
      const provider = new OuraProvider({
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        redirectUri: 'http://localhost:3000/callback'
      });
      expect(provider).toBeDefined();
      expect(provider.isUsingOAuth()).toBe(true);
    });

    it('should throw error without credentials', () => {
      expect(() => {
        new OuraProvider({});
      }).toThrow('Either personal access token or OAuth credentials must be provided');
    });
  });

  describe('OAuth Methods', () => {
    let provider: OuraProvider;

    beforeEach(() => {
      provider = new OuraProvider({
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        redirectUri: 'http://localhost:3000/callback'
      });
    });

    it('should generate authorization URL', () => {
      const url = provider.getAuthorizationUrl(['personal', 'daily']);
      expect(url).toContain('https://cloud.ouraring.com/oauth/authorize');
      expect(url).toContain('client_id=test_client_id');
      expect(url).toContain('scope=personal+daily');
      expect(url).toContain('state=');
    });

    it('should have valid OAuth tokens after setup', () => {
      expect(provider.isUsingOAuth()).toBe(true);
      expect(provider.hasValidOAuthTokens()).toBe(false); // No tokens yet
    });
  });

  describe('PAT Methods', () => {
    let provider: OuraProvider;

    beforeEach(() => {
      provider = new OuraProvider({
        personalAccessToken: 'test_token_123'
      });
    });

    it('should not be using OAuth with PAT', () => {
      expect(provider.isUsingOAuth()).toBe(false);
      expect(provider.hasValidOAuthTokens()).toBe(false);
    });

    it('should throw error when calling OAuth methods with PAT', () => {
      expect(() => {
        provider.getAuthorizationUrl();
      }).toThrow('Authorization URL not needed for Personal Access Token');
    });

    it('should throw error when trying to exchange tokens with PAT', async () => {
      await expect(
        provider.exchangeCodeForTokens('test_code')
      ).rejects.toThrow('Token exchange not needed for Personal Access Token');
    });
  });

  describe('Server Capabilities', () => {
    let provider: OuraProvider;

    beforeEach(() => {
      provider = new OuraProvider({
        personalAccessToken: 'test_token_123'
      });
    });

    it('should return MCP server instance', () => {
      const server = provider.getServer();
      expect(server).toBeDefined();
      expect(server.constructor.name).toBe('McpServer');
    });
  });
}); 