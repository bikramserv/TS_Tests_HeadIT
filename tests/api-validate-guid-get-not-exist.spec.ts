import { test, expect, request as playwrightRequest } from '@playwright/test';

// Test environment variables supported:
// - BASE_URL: base url for the API (defaults to https://localhost:7203)
// - ENDPOINT: endpoint path (defaults to /api/ValidateGuid)
// - API_BEARER_TOKEN: optional Bearer token for Authorization header
// - API_KEY: optional API key to send as 'x-api-key' header
// - NO_AUTH: set to '1' or 'true' if the endpoint requires no authentication

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/ValidateGuid';
const GUID = process.env.TEST_GUID || '00000000-0000-0000-0000-000000000000';

const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';

// Test: Validate GET request returns false when GUID does not exist in the database
test('Validate GET request returns false for non-existent GUID', async () => {
  // Arrange: build headers and request context
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

  const requestContext = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: headers,
  });

  // Act: send GET request to endpoint using path param: /api/ValidateGuid/{guid}
  const url = `${ENDPOINT.replace(/\/+$/,'')}/${GUID}`;
  const response = await requestContext.get(url);

  // Assert: status code is 200
  expect(response.status(), `Expected HTTP 200 OK, got ${response.status()}`).toBe(200);

  // Assert: response body contains false (handle multiple response shapes)
  const text = (await response.text()).trim();

  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    // leave parsed as raw text if not JSON
  }

  // Normalize to boolean
  let booleanResult: boolean | null = null;
  if (typeof parsed === 'boolean') {
    booleanResult = parsed as boolean;
  } else if (typeof parsed === 'string') {
    const lower = (parsed as string).toLowerCase();
    if (lower === 'true') booleanResult = true;
    if (lower === 'false') booleanResult = false;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, any>;
    if (obj.value === true || obj.result === true || Object.values(obj).includes(true)) booleanResult = true;
    if (obj.value === false || obj.result === false || Object.values(obj).includes(false)) booleanResult = false;
  }

  expect(booleanResult, `Expected response body to indicate false for non-existent GUID but got: ${text}`).toBe(false);

  await requestContext.dispose();
});
