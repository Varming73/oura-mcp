import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { OuraAuth } from '../provider/oura_connection.js';
import {
  mockOAuthTokenResponse,
  mockRefreshTokenResponse,
  mockUnauthorizedError
} from './mocks/oura_api_responses.js';

// Mock fetch globally
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetch = jest.fn() as any;
global.fetch = mockFetch;

describe('OuraAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with Personal Access Token', () => {
      const auth = new OuraAuth('test_pat_token');
      expect(auth.isUsingOAuth()).toBe(false);
      expect(auth.hasValidOAuthTokens()).toBe(false);
    });

    it('should initialize with OAuth credentials', () => {
      const auth = new OuraAuth(undefined, 'client_id', 'client_secret', 'http://localhost:3000/callback');
      expect(auth.isUsingOAuth()).toBe(true);
      expect(auth.hasValidOAuthTokens()).toBe(false);
    });

    it('should throw error without any credentials', () => {
      expect(() => new OuraAuth()).toThrow('Either personal access token or OAuth credentials must be provided');
    });

    it('should throw error with only client ID', () => {
      expect(() => new OuraAuth(undefined, 'client_id')).toThrow('Either personal access token or OAuth credentials must be provided');
    });
  });

  describe('Personal Access Token Authentication', () => {
    let auth: OuraAuth;

    beforeEach(() => {
      auth = new OuraAuth('test_pat_token_123');
    });

    it('should return correct headers with PAT', async () => {
      const headers = await auth.getHeaders();
      expect(headers).toEqual({
        'Authorization': 'Bearer test_pat_token_123',
        'Content-Type': 'application/json'
      });
    });

    it('should throw error when trying to get authorization URL with PAT', () => {
      expect(() => auth.getAuthorizationUrl()).toThrow('Authorization URL not needed for Personal Access Token authentication');
    });

    it('should throw error when trying to exchange tokens with PAT', async () => {
      await expect(auth.exchangeCodeForTokens('test_code')).rejects.toThrow('Token exchange not needed for Personal Access Token authentication');
    });

    it('should return correct base URL', () => {
      expect(auth.getBaseUrl()).toBe('https://api.ouraring.com/v2');
    });
  });

  describe('OAuth Authentication', () => {
    let auth: OuraAuth;

    beforeEach(() => {
      auth = new OuraAuth(undefined, 'test_client_id', 'test_client_secret', 'http://localhost:3000/callback');
    });

    describe('Authorization URL Generation', () => {
      it('should generate authorization URL with default scopes', () => {
        const url = auth.getAuthorizationUrl();
        expect(url).toContain('https://cloud.ouraring.com/oauth/authorize');
        expect(url).toContain('client_id=test_client_id');
        expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
        expect(url).toContain('response_type=code');
        expect(url).toContain('scope=personal+daily');
        expect(url).toContain('state=');
      });

      it('should generate authorization URL with custom scopes', () => {
        const url = auth.getAuthorizationUrl(['personal', 'daily', 'heartrate']);
        expect(url).toContain('scope=personal+daily+heartrate');
      });

      it('should generate unique state parameter for CSRF protection', () => {
        const url1 = auth.getAuthorizationUrl();
        const url2 = auth.getAuthorizationUrl();

        const state1 = new URL(url1).searchParams.get('state');
        const state2 = new URL(url2).searchParams.get('state');

        expect(state1).toBeTruthy();
        expect(state2).toBeTruthy();
        expect(state1).not.toBe(state2);
        expect(state1?.length).toBe(64); // 32 bytes = 64 hex chars
      });
    });

    describe('Token Exchange', () => {
      it('should exchange authorization code for tokens', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockOAuthTokenResponse
        });

        await auth.exchangeCodeForTokens('test_auth_code');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.ouraring.com/oauth/token',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: expect.any(URLSearchParams)
          }
        );

        const callBody = mockFetch.mock.calls[0][1].body;
        expect(callBody.get('grant_type')).toBe('authorization_code');
        expect(callBody.get('code')).toBe('test_auth_code');
        expect(callBody.get('client_id')).toBe('test_client_id');
        expect(callBody.get('client_secret')).toBe('test_client_secret');
        expect(callBody.get('redirect_uri')).toBe('http://localhost:3000/callback');

        expect(auth.hasValidOAuthTokens()).toBe(true);
      });

      it('should throw error when token exchange fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => JSON.stringify(mockUnauthorizedError)
        });

        await expect(auth.exchangeCodeForTokens('invalid_code')).rejects.toThrow('Failed to exchange authorization code');
      });

      it('should handle token exchange network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(auth.exchangeCodeForTokens('test_code')).rejects.toThrow('Network error');
      });
    });

    describe('Token Validation', () => {
      it('should report no valid tokens before exchange', () => {
        expect(auth.hasValidOAuthTokens()).toBe(false);
      });

      it('should report valid tokens after successful exchange', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockOAuthTokenResponse
        });

        await auth.exchangeCodeForTokens('test_code');
        expect(auth.hasValidOAuthTokens()).toBe(true);
      });

      it('should throw error when getting headers without tokens', async () => {
        await expect(auth.getHeaders()).rejects.toThrow('Not authenticated: No OAuth tokens');
      });
    });

    describe('Token Refresh', () => {
      beforeEach(async () => {
        // First exchange code for initial tokens
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockOAuthTokenResponse,
            expires_in: 1 // Expire in 1 second
          })
        });

        await auth.exchangeCodeForTokens('test_code');
        jest.clearAllMocks();
      });

      it('should refresh expired tokens automatically when getting headers', async () => {
        // Wait for token to expire
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Mock refresh token response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockRefreshTokenResponse
        });

        const headers = await auth.getHeaders();

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.ouraring.com/oauth/token',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: expect.any(URLSearchParams)
          }
        );

        const callBody = mockFetch.mock.calls[0][1].body;
        expect(callBody.get('grant_type')).toBe('refresh_token');
        expect(callBody.get('refresh_token')).toBe('test_refresh_token_xyz789');

        expect(headers['Authorization']).toBe('Bearer new_access_token_def456');
      });

      it('should throw error when refresh fails', async () => {
        // Wait for token to expire
        await new Promise(resolve => setTimeout(resolve, 1100));

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        });

        await expect(auth.getHeaders()).rejects.toThrow('Failed to refresh token');
      });

      it('should not refresh tokens that are still valid', async () => {
        // Mock a fresh token exchange with long expiry
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockOAuthTokenResponse,
            expires_in: 3600 // 1 hour
          })
        });

        await auth.exchangeCodeForTokens('test_code');
        jest.clearAllMocks();

        // Get headers immediately - should not trigger refresh
        await auth.getHeaders();

        expect(mockFetch).not.toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing redirect URI in OAuth mode', () => {
      const auth = new OuraAuth(undefined, 'client_id', 'client_secret');
      expect(() => auth.getAuthorizationUrl()).toThrow('OAuth client ID and redirect URI are required');
    });

    it('should reject empty Personal Access Token', () => {
      expect(() => new OuraAuth('')).toThrow('Either personal access token or OAuth credentials must be provided');
    });

    it('should reject OAuth with only client ID', () => {
      expect(() => new OuraAuth(undefined, 'client_id')).toThrow('Either personal access token or OAuth credentials must be provided');
    });
  });
});
