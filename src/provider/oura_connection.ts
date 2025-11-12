import { z } from 'zod';

export interface OuraTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export class OuraAuth {
  private baseUrl = 'https://api.ouraring.com/v2';
  private tokens: OuraTokens;
  private oauthClientId?: string;
  private oauthClientSecret?: string;
  private oauthRedirectUri?: string;
  private usingPersonalAccessToken: boolean;

  constructor(personalAccessToken?: string, clientId?: string, clientSecret?: string, redirectUri?: string) {
    if (personalAccessToken) {
      // Personal Access Token mode - simple and ready to use
      this.tokens = {
        accessToken: personalAccessToken
      };
      this.usingPersonalAccessToken = true;
    } else if (clientId && clientSecret) {
      // OAuth mode - requires user to complete authorization flow
      this.oauthClientId = clientId;
      this.oauthClientSecret = clientSecret;
      this.oauthRedirectUri = redirectUri;
      this.tokens = {
        accessToken: '',
        refreshToken: '',
        expiresAt: 0
      };
      this.usingPersonalAccessToken = false;
    } else {
      throw new Error('Either personal access token or OAuth credentials must be provided');
    }
  }

  async getHeaders(): Promise<Record<string, string>> {
    if (!this.tokens.accessToken) {
      if (this.usingPersonalAccessToken) {
        throw new Error('Not authenticated: Personal Access Token is missing');
      } else {
        throw new Error('Not authenticated: No OAuth tokens. Call getAuthorizationUrl() to start OAuth flow, then exchangeCodeForTokens() with the authorization code.');
      }
    }

    // For OAuth tokens, check expiration and refresh if needed
    if (this.tokens.expiresAt && this.tokens.expiresAt <= Date.now()) {
      await this.refreshTokens();
    }

    return {
      'Authorization': `Bearer ${this.tokens.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async refreshTokens(): Promise<void> {
    if (!this.tokens.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json();
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Generates the OAuth authorization URL for users to visit.
   * After authorization, users will be redirected to the redirect URI with a code.
   *
   * @param scopes - Array of OAuth scopes to request (e.g., ['personal', 'daily'])
   * @returns Authorization URL string
   * @throws Error if not using OAuth credentials
   */
  getAuthorizationUrl(scopes: string[] = ['personal', 'daily']): string {
    if (this.usingPersonalAccessToken) {
      throw new Error('Authorization URL not needed for Personal Access Token authentication');
    }

    if (!this.oauthClientId || !this.oauthRedirectUri) {
      throw new Error('OAuth client ID and redirect URI are required');
    }

    const params = new URLSearchParams({
      client_id: this.oauthClientId,
      redirect_uri: this.oauthRedirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state: this.generateState() // CSRF protection
    });

    return `https://cloud.ouraring.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for access and refresh tokens.
   * Call this after the user authorizes your application and you receive the code.
   *
   * @param code - Authorization code from OAuth redirect
   * @throws Error if not using OAuth or if token exchange fails
   */
  async exchangeCodeForTokens(code: string): Promise<void> {
    if (this.usingPersonalAccessToken) {
      throw new Error('Token exchange not needed for Personal Access Token authentication');
    }

    if (!this.oauthClientId || !this.oauthClientSecret || !this.oauthRedirectUri) {
      throw new Error('OAuth credentials are required for token exchange');
    }

    const response = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: this.oauthClientId,
        client_secret: this.oauthClientSecret,
        redirect_uri: this.oauthRedirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error');
      throw new Error(`Failed to exchange authorization code: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
  }

  /**
   * Checks if the current authentication is using OAuth (vs Personal Access Token).
   *
   * @returns true if using OAuth, false if using Personal Access Token
   */
  isUsingOAuth(): boolean {
    return !this.usingPersonalAccessToken;
  }

  /**
   * Checks if OAuth tokens are currently valid and available.
   *
   * @returns true if OAuth tokens are present and valid
   */
  hasValidOAuthTokens(): boolean {
    if (this.usingPersonalAccessToken) {
      return false;
    }
    return !!this.tokens.accessToken &&
           (!this.tokens.expiresAt || this.tokens.expiresAt > Date.now());
  }

  /**
   * Generates a random state parameter for CSRF protection in OAuth flow.
   *
   * @returns Random state string
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
} 