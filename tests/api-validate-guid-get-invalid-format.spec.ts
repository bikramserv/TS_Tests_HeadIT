import { test, expect, request as playwrightRequest } from '@playwright/test';

// Test environment variables supported:
// - BASE_URL: base url for the API (defaults to https://localhost:7203)
// - ENDPOINT: endpoint path (defaults to /api/ValidateGuid)
// - API_BEARER_TOKEN: optional Bearer token for Authorization header
// - API_KEY: optional API key to send as 'x-api-key' header
// - NO_AUTH: set to '1' or 'true' if the endpoint requires no authentication

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/ValidateGuid';
const GUID = process.env.TEST_GUID || 'invalid-guid-format';

const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';

// Test: Validate that a malformed GUID format is rejected by the backend
test('Validate that a malformed GUID format is rejected by the backend', async () => {
  // Given the backend API is running and accessible

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

  // When a malformed GUID string is submitted for validation
  const url = `${ENDPOINT.replace(/\/+$/,'')}/${GUID}`;
  const response = await requestContext.get(url);

  // Then the backend should respond with failure indicating the GUID format is invalid
  const status = response.status();

  if (status === 200) {
    // Accept a 200 status with a false boolean body indicating invalid format
    const text = (await response.text()).trim();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // leave parsed as raw text if not JSON
    }
    let booleanResult: boolean | null = null;

    if (typeof parsed === 'boolean') {
      booleanResult = parsed;
    } else if (typeof parsed === 'string') {
      const lower = parsed.toLowerCase();
      if (lower === 'true') booleanResult = true;
      if (lower === 'false') booleanResult = false;
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, any>;
      if (obj.value === true || obj.result === true || Object.values(obj).includes(true)) booleanResult = true;
      if (obj.value === false || obj.result === false || Object.values(obj).includes(false)) booleanResult = false;
    }

    expect(booleanResult, `Expected response body to indicate false for invalid GUID but got: ${text}`).toBe(false);

  } else {
    // Accept 400 or 422 status with an error message indicating invalid GUID format
    expect([400, 422]).toContain(status);

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

    if (parsed && typeof parsed === 'object') {
      if ('error' in parsed && typeof parsed.error === 'string') {
        expect(parsed.error.toLowerCase()).toContain('invalid');
        expect(parsed.error.toLowerCase()).toContain('guid');
      } else if ('message' in parsed && typeof parsed.message === 'string') {
        expect(parsed.message.toLowerCase()).toContain('invalid');
        expect(parsed.message.toLowerCase()).toContain('guid');
      } else if ('errors' in parsed) {
        const errStr = JSON.stringify(parsed.errors).toLowerCase();
        expect(errStr).toContain('invalid');
        expect(errStr).toContain('guid');
      } else {
        expect(false, `Unexpected error response shape: ${JSON.stringify(parsed)}`).toBeTruthy();
      }
    } else if (typeof parsed === 'string') {
      const lower = parsed.toLowerCase();
      expect(lower).toContain('invalid');
      expect(lower).toContain('guid');
    } else {
      expect(false, `Unexpected response type for error message: ${typeof parsed}`).toBeTruthy();
    }
  }

  await requestContext.dispose();
});
