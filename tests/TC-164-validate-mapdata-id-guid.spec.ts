import { test, expect, request as playwrightRequest } from '@playwright/test';

// Test: TC-164 - Validate that GET response returns a valid GUID type for the id field in map data

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/MapDatas';

const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';

// Simple regex pattern to validate GUID format (case insensitive): 8-4-4-4-12 hex digits
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test('TC-164: Validate that GET response returns a valid GUID type for the id field', async () => {
  // Create a request context with appropriate headers and ignore HTTPS errors
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  };

  if (!NO_AUTH && BEARER) {
    headers['authorization'] = `Bearer ${BEARER}`;
  }
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  }

  const apiContext = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: headers,
  });

  // Given the API endpoint for retrieving map data is available (Implicitly by making the request)

  // When a GET request is made to the map data endpoint
  const response = await apiContext.get(ENDPOINT);

  // Then the response status should be 200 OK
  expect(response.status(), 'Expected HTTP 200 OK').toBe(200);

  // And the response should be a JSON array
  const body = await response.json();
  expect(Array.isArray(body), 'Response body should be a JSON array').toBeTruthy();
  expect(body.length, 'Array should contain at least one object').toBeGreaterThan(0);

  // Then the response should contain an 'id' field
  for (const entry of body) {
    expect(entry, 'Each entry should have an id field').toHaveProperty('id');

    // And the 'id' field should be a valid GUID format
    const id = entry.id;
    expect(typeof id, "'id' field should be a string").toBe('string');
    expect(GUID_REGEX.test(id), `'id' field is not a valid GUID format: ${id}`).toBe(true);
  }

  // Clean up
  await apiContext.dispose();
});
