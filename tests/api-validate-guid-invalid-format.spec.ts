import { test, expect, request as playwrightRequest } from '@playwright/test';

// Test environment variables supported:
// - BASE_URL: base url for the API (defaults to https://localhost:7203)
// - ENDPOINT: endpoint path (defaults to /api/ValidateGuid)
// - API_BEARER_TOKEN: optional Bearer token for Authorization header
// - API_KEY: optional API key to send as 'x-api-key' header
// - NO_AUTH: set to '1' or 'true' if the endpoint requires no authentication

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/ValidateGuid';

const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';

// Test: Validate POST request returns error for invalid GUID format
test('Validate POST request returns error for invalid GUID format', async () => {
  // Arrange: build headers and request context
  const headers: Record<string, string> = {
    'accept': 'application/json',
    'content-type': 'application/json',
  };

  if (!NO_AUTH && BEARER) {
    headers['authorization'] = `Bearer ${BEARER}`;
  }
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  }

  const requestContext = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: headers,
  });

  // Step 1: Send a POST request with invalid GUID format
  const invalidPayload = { id: 'invalid-guid' };
  const response = await requestContext.post(ENDPOINT, {
    data: JSON.stringify(invalidPayload),
  });

  // Step 2: Assert status code is 400
  expect(response.status(), `Expected HTTP 400 Bad Request for invalid GUID, got ${response.status()}`).toBe(400);

  // Step 3: Verify response body contains an error message indicating invalid GUID format
  let parsed: any;
  try {
    parsed = await response.json();
  } catch (err) {
    const txt = await response.text();
    try {
      parsed = JSON.parse(txt);
    } catch (err2) {
      parsed = txt;
    }
  }

  // If response is an object with an 'error' property, verify its content
  if (parsed && typeof parsed === 'object') {
    // Accept common property names: error, message, errors
    if ('error' in parsed && typeof parsed.error === 'string') {
      expect(parsed.error.toLowerCase()).toContain('invalid');
      expect(parsed.error.toLowerCase()).toContain('guid');
    } else if ('message' in parsed && typeof parsed.message === 'string') {
      expect(parsed.message.toLowerCase()).toContain('invalid');
      expect(parsed.message.toLowerCase()).toContain('guid');
    } else if ('errors' in parsed) {
      // errors could be an array or object; stringify and check
      const errStr = JSON.stringify(parsed.errors).toLowerCase();
      expect(errStr).toContain('invalid');
      expect(errStr).toContain('guid');
    } else {
      // Fallback: fail with the response body for debugging
      expect(false, `Unexpected error response shape: ${JSON.stringify(parsed)}`).toBeTruthy();
    }
  } else if (typeof parsed === 'string') {
    const lower = parsed.toLowerCase();
    expect(lower).toContain('invalid');
    expect(lower).toContain('guid');
  } else {
    expect(false, `Unexpected response type for error message: ${typeof parsed}`).toBeTruthy();
  }

  await requestContext.dispose();
});
