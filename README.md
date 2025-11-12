# Oura MCP Server

A Model Context Protocol (MCP) server for accessing Oura Ring data.

## Setup

### Prerequisites
- Node.js (v16+)
- Oura account

### Installation
1. Clone the repository
2. Run: 
```
npm install
npm run build
```
## Configuration

### Obtaining Credentials
1. Log in to [Oura Cloud Console](https://cloud.ouraring.com/)
2. Get either:
   - [Personal Access Token](https://cloud.ouraring.com/personal-access-tokens) (for testing)
   - [OAuth2 Credentials](https://cloud.ouraring.com/oauth/applications) (for production)

### Environment Variables

#### Option 1: Personal Access Token (Recommended for Testing)
Create a `.env` file:
```bash
OURA_PERSONAL_ACCESS_TOKEN=your_token
```

This is the simplest method for testing and personal use. The token works immediately without any additional steps.

#### Option 2: OAuth2 (Required for Multi-User Applications)
Create a `.env` file:
```bash
OURA_CLIENT_ID=your_client_id
OURA_CLIENT_SECRET=your_client_secret
OURA_REDIRECT_URI=http://localhost:3000/callback
```

**OAuth Flow Steps:**
1. Initialize the provider with OAuth credentials
2. Call `auth.getAuthorizationUrl(['personal', 'daily'])` to get authorization URL
3. Direct users to this URL where they grant permissions
4. Oura redirects back to your `REDIRECT_URI` with an authorization code
5. Call `auth.exchangeCodeForTokens(code)` to exchange the code for access tokens
6. Tokens are automatically refreshed when they expire

**Example OAuth Implementation:**
```typescript
import { OuraProvider } from './provider/oura_provider.js';

const provider = new OuraProvider({
  clientId: process.env.OURA_CLIENT_ID,
  clientSecret: process.env.OURA_CLIENT_SECRET,
  redirectUri: process.env.OURA_REDIRECT_URI
});

// Step 1: Get authorization URL
const authUrl = provider.getAuthorizationUrl(['personal', 'daily']);
console.log('Visit this URL to authorize:', authUrl);

// Step 2: After user authorizes and you receive the code:
await provider.exchangeCodeForTokens(authorizationCode);

// Step 3: Now you can use the provider
const server = provider.getServer();
await server.connect(transport);
```

## Usage

### Testing
```
node test.js <tool_name> <date>
```
Example: `node test.js get_daily_sleep 2023-05-01`

### Claude Desktop Integration
Add to Claude Desktop's config (Settings → Developer → Edit Config):
```json
{
    "mcpServers": {
        "oura": {
            "command": "node",
            "args": ["/absolute/path/to/oura-mcp/build/index.js"],
            "env": {"OURA_PERSONAL_ACCESS_TOKEN": "your_token"}
        }
    }
}
```
Restart Claude Desktop after saving. See [MCP docs](https://modelcontextprotocol.io/quickstart/user) for details.

## Available Resources
- `personal_info` - User profile
- `daily_activity` - Activity summaries
- `daily_readiness` - Readiness scores
- `daily_sleep` - Sleep summaries
- `sleep` - Detailed sleep data
- `sleep_time` - Sleep timing
- `workout` - Workout data
- `session` - Session data
- `daily_spo2` - SpO2 measurements
- `rest_mode_period` - Rest periods
- `ring_configuration` - Ring config
- `daily_stress` - Stress metrics
- `daily_resilience` - Resilience metrics
- `daily_cardiovascular_age` - CV age
- `vO2_max` - VO2 max data

## Available Tools
For date-based resources, use tools like `get_daily_sleep` with `startDate` and `endDate` parameters (YYYY-MM-DD).

## API Rate Limits

### Oura API Limits
The Oura API enforces the following rate limits:
- **5,000 requests per 5 minutes**
- Rate limit applies per access token
- Exceeding this limit results in `429 Too Many Requests` errors

### Handling Rate Limits

#### HTTP 429 Response
When you exceed the rate limit, the API returns:
```json
{
  "status": 429,
  "message": "Request Rate Limit Exceeded"
}
```

#### Best Practices

1. **Implement Exponential Backoff**
```typescript
async function fetchWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes('429') && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

2. **Batch Requests Efficiently**
   - Fetch data for date ranges instead of individual days
   - Use the widest date range your application needs
   - Example: `startDate: '2024-01-01', endDate: '2024-01-31'` (1 request for 31 days)

3. **Cache API Responses**
   - Store fetched data locally
   - Implement cache expiration based on your needs
   - Avoid redundant requests for the same data

4. **Monitor Usage**
   - Track requests per time window
   - Implement request throttling if approaching limits
   - Log rate limit errors for monitoring

5. **Contact Oura for Higher Limits**
   - If your application requires >5,000 requests per 5 minutes
   - Email: [api-support@ouraring.com](mailto:api-support@ouraring.com)
   - Provide use case and expected volume

### Rate Limit Headers
The Oura API may include these headers in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Time when the rate limit resets (Unix timestamp)

**Note**: Check response headers to implement proactive throttling. 