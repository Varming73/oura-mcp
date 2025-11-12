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