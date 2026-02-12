import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = '/api/MapDatas';

const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';

test('TC-168: Fail to create a new map data object when id is not a valid GUID', async () => {
  // Given the API endpoint for creating map data is available
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

  // Create API request context with authorization and headers
  const apiContext = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: headers,
  });

  // When a POST request is sent with an invalid GUID format for the id field
  const invalidMapData = { id: 'invalid-guid-format' };
  const response = await apiContext.post(ENDPOINT, { data: invalidMapData });

  // Then the API should respond with HTTP status 400 Bad Request
  expect(response.status(), `Expected HTTP 400 Bad Request, got ${response.status()}`).toBe(400);

  // And the response should contain an error message indicating invalid GUID format
  let responseBody: any;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = await response.text();
  }
  const errorMessage = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
  expect(errorMessage.toLowerCase()).toContain('invalid guid');

  // Clean up
  await apiContext.dispose();
});
