import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OuraAuth } from './oura_connection.js';

export interface OuraConfig {
  personalAccessToken?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

interface OuraResponse {
  data: unknown[];
  next_token?: string;
}

interface EndpointConfig {
  name: string;
  requiresDates: boolean;
  description: string;
}

export class OuraProvider {
  private server: McpServer;
  private auth: OuraAuth;

  // Configuration constants
  private static readonly DEFAULT_DAYS_LOOKBACK = 7;
  private static readonly MS_PER_DAY = 24 * 60 * 60 * 1000;

  // Oura API endpoints configuration
  private static readonly ENDPOINTS: EndpointConfig[] = [
    { name: 'personal_info', requiresDates: false, description: 'User profile information including age, weight, height, and biological sex' },
    { name: 'daily_activity', requiresDates: true, description: 'Daily activity summaries including steps, calories, and active time' },
    { name: 'daily_readiness', requiresDates: true, description: 'Daily readiness scores and contributing factors' },
    { name: 'daily_sleep', requiresDates: true, description: 'Daily sleep summaries including duration, efficiency, and sleep stages' },
    { name: 'sleep', requiresDates: true, description: 'Detailed sleep data with per-minute heart rate and HRV measurements' },
    { name: 'sleep_time', requiresDates: true, description: 'Sleep timing data including bedtime and wake time recommendations' },
    { name: 'workout', requiresDates: true, description: 'Workout session data including intensity, duration, and heart rate zones' },
    { name: 'session', requiresDates: true, description: 'Tagged session data for activities like meditation or breathing exercises' },
    { name: 'daily_spo2', requiresDates: true, description: 'Daily blood oxygen saturation (SpO2) measurements' },
    { name: 'rest_mode_period', requiresDates: true, description: 'Rest mode periods when user has paused activity tracking' },
    { name: 'ring_configuration', requiresDates: false, description: 'Ring hardware configuration and settings' },
    { name: 'daily_stress', requiresDates: true, description: 'Daily stress levels and daytime stress measurements' },
    { name: 'daily_resilience', requiresDates: true, description: 'Daily resilience metrics reflecting recovery capacity' },
    { name: 'daily_cardiovascular_age', requiresDates: true, description: 'Daily cardiovascular age estimates based on fitness data' },
    { name: 'vO2_max', requiresDates: true, description: 'VO2 max measurements indicating cardiovascular fitness level' }
  ];

  constructor(config: OuraConfig) {
    this.auth = new OuraAuth(
      config.personalAccessToken,
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    this.server = new McpServer({
      name: "oura-provider",
      version: "1.0.0",
      capabilities: {
        resources: {},
        tools: {}
      }
    });

    this.initializeResources();
  }

  private validateDateFormat(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return false;
    }
    // Parse the date and verify it matches the input (catches Feb 30, Apr 31, etc.)
    const parsedDate = new Date(date + 'T00:00:00');
    if (isNaN(parsedDate.getTime())) {
      return false;
    }
    // Ensure the parsed date matches the input string (e.g., "2024-02-30" becomes "2024-03-02")
    return parsedDate.toISOString().split('T')[0] === date;
  }

  private validateDateRange(startDate: string, endDate: string): void {
    if (!this.validateDateFormat(startDate)) {
      throw new Error(`Invalid start date format: ${startDate}. Expected YYYY-MM-DD format.`);
    }
    if (!this.validateDateFormat(endDate)) {
      throw new Error(`Invalid end date format: ${endDate}. Expected YYYY-MM-DD format.`);
    }
    if (new Date(startDate) > new Date(endDate)) {
      throw new Error(`Start date (${startDate}) must be before or equal to end date (${endDate}).`);
    }
  }

  private async fetchOuraData(endpoint: string, params?: Record<string, string>): Promise<OuraResponse> {
    const headers = await this.auth.getHeaders();
    const url = new URL(`${this.auth.getBaseUrl()}/usercollection/${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unable to read error response');
      throw new Error(
        `Failed to fetch ${endpoint}: ${response.status} ${response.statusText}. ${errorBody}`
      );
    }

    return await response.json();
  }

  private initializeResources(): void {
    // Define the date range schema for tools with descriptions
    const dateRangeSchema = {
      startDate: z.string().describe('Start date in YYYY-MM-DD format (e.g., 2024-01-01)'),
      endDate: z.string().describe('End date in YYYY-MM-DD format (e.g., 2024-01-31)')
    };

    // Add resources
    OuraProvider.ENDPOINTS.forEach(({ name, requiresDates, description }) => {
      this.server.resource(
        name,
        `oura://${name}`,
        {
          description,
          mimeType: 'application/json'
        },
        async (uri: URL) => {
          let data;
          if (requiresDates) {
            // For date-based resources, fetch last N days by default
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(
              Date.now() - OuraProvider.DEFAULT_DAYS_LOOKBACK * OuraProvider.MS_PER_DAY
            ).toISOString().split('T')[0];
            data = await this.fetchOuraData(name, { start_date: startDate, end_date: endDate });
          } else {
            data = await this.fetchOuraData(name);
          }

          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(data, null, 2),
              mimeType: 'application/json'
            }]
          };
        }
      );
    });

    // Add tools
    OuraProvider.ENDPOINTS.filter(e => e.requiresDates).forEach(({ name, description }) => {
      this.server.tool(
        `get_${name}`,
        `Retrieves ${description.toLowerCase()} for a specified date range from Oura Ring API`,
        dateRangeSchema,
        async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
          // Validate date inputs
          this.validateDateRange(startDate, endDate);

          const data = await this.fetchOuraData(name, {
            start_date: startDate,
            end_date: endDate
          });

          return {
            content: [{
              type: "text",
              text: JSON.stringify(data, null, 2)
            }]
          };
        }
      );
    });
  }

  getServer(): McpServer {
    return this.server;
  }

  /**
   * Gets the OAuth authorization URL for users to visit.
   * Only available when using OAuth credentials (not Personal Access Token).
   *
   * @param scopes - Array of OAuth scopes to request (default: ['personal', 'daily'])
   * @returns Authorization URL string
   * @throws Error if using Personal Access Token
   */
  getAuthorizationUrl(scopes?: string[]): string {
    return this.auth.getAuthorizationUrl(scopes);
  }

  /**
   * Exchanges an OAuth authorization code for access and refresh tokens.
   * Only available when using OAuth credentials (not Personal Access Token).
   *
   * @param code - Authorization code from OAuth redirect
   * @throws Error if using Personal Access Token or if exchange fails
   */
  async exchangeCodeForTokens(code: string): Promise<void> {
    await this.auth.exchangeCodeForTokens(code);
  }

  /**
   * Checks if the provider is using OAuth authentication.
   *
   * @returns true if using OAuth, false if using Personal Access Token
   */
  isUsingOAuth(): boolean {
    return this.auth.isUsingOAuth();
  }

  /**
   * Checks if OAuth tokens are currently valid.
   *
   * @returns true if OAuth tokens are present and valid, false otherwise
   */
  hasValidOAuthTokens(): boolean {
    return this.auth.hasValidOAuthTokens();
  }
} 