/**
 * Mock Oura API responses for testing
 */

export const mockPersonalInfo = {
  id: 'test-user-123',
  age: 30,
  weight: 70,
  height: 175,
  biological_sex: 'male',
  email: 'test@example.com'
};

export const mockDailySleep = {
  data: [
    {
      id: 'sleep-123',
      day: '2024-01-15',
      score: 85,
      contributors: {
        deep_sleep: 90,
        efficiency: 85,
        latency: 80,
        rem_sleep: 85,
        restfulness: 85,
        timing: 75,
        total_sleep: 85
      },
      timestamp: '2024-01-15T00:00:00+00:00'
    }
  ],
  next_token: null
};

export const mockDailyActivity = {
  data: [
    {
      id: 'activity-123',
      day: '2024-01-15',
      score: 82,
      active_calories: 450,
      steps: 8500,
      equivalent_walking_distance: 6800,
      timestamp: '2024-01-15T00:00:00+00:00'
    }
  ],
  next_token: null
};

export const mockOAuthTokenResponse = {
  access_token: 'test_access_token_abc123',
  refresh_token: 'test_refresh_token_xyz789',
  expires_in: 3600,
  token_type: 'Bearer'
};

export const mockRefreshTokenResponse = {
  access_token: 'new_access_token_def456',
  refresh_token: 'new_refresh_token_uvw012',
  expires_in: 3600,
  token_type: 'Bearer'
};

export const mockRateLimitError = {
  status: 429,
  message: 'Request Rate Limit Exceeded'
};

export const mockUnauthorizedError = {
  status: 401,
  message: 'Unauthorized'
};

export const mockNotFoundError = {
  status: 404,
  message: 'Resource not found'
};
