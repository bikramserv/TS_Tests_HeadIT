import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = '/api/MapDatas';

const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';

test('TC-167: Fail to create a new map data object when required fields are missing', async () => {
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

  // When a POST request is sent with missing required fields such as id or plotNo
  const incompleteMapData = {
    longitude: 12.34567,
    latitude: 54.321,
    street: 'Maple Street',
    town: 'Springfield',
    postCode: '98765',
    village: 'North Village'
  };

  const response = await apiContext.post(ENDPOINT, { data: incompleteMapData });

  // Then the API should respond with HTTP status 400 Bad Request
  expect(response.status(), `Expected HTTP 400 Bad Request, got ${response.status()}`).toBe(400);

  // And the response should contain an error message indicating the missing fields
  let responseBody: any;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = await response.text();
  }
  const errorMessage = typeof responseBody === 'string' ? responseBody.toLowerCase() : JSON.stringify(responseBody).toLowerCase();
  expect(errorMessage).toContain('missing');
  expect(errorMessage).toContain('id');
  expect(errorMessage).toContain('plotno');

  // Clean up
  await apiContext.dispose();
});
