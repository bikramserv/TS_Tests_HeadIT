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

// Test: Validate GET request returns false when GUID format is invalid
test('Validate GET request returns false when GUID format is invalid', async () => {
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

  // Assert: Accept either a 200 with a boolean false response or a 400/422 with an invalid-guid error
  const status = response.status();

  if (status === 200) {
    // Normalize and assert boolean false in several possible response shapes
    const text = (await response.text()).trim();

    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // leave parsed as raw text if not JSON
    }

    let booleanResult: boolean | null = null;
    if (typeof parsed === 'boolean') {
      booleanResult = parsed as boolean;
    } else if (typeof parsed === 'string') {
      const lower = (parsed as string).toLowerCase();
      if (lower === 'false') booleanResult = false;
      if (lower === 'true') booleanResult = true;
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, any>;
      if (obj.value === false || obj.result === false || Object.values(obj).includes(false)) booleanResult = false;
      if (obj.value === true || obj.result === true || Object.values(obj).includes(true)) booleanResult = true;
    }

    expect(booleanResult, `Expected response body to indicate false for invalid GUID but got: ${text}`).toBe(false);
  } else if ([400, 422].includes(status)) {
    // Parse error response and verify it indicates an invalid GUID format
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
        const lower = parsed.error.toLowerCase();
        expect(lower).toContain('invalid');
        expect(lower).toContain('guid');
      } else if ('message' in parsed && typeof parsed.message === 'string') {
        const lower = parsed.message.toLowerCase();
        expect(lower).toContain('invalid');
        expect(lower).toContain('guid');
      } else if ('errors' in parsed) {
        const errStr = JSON.stringify(parsed.errors).toLowerCase();
        expect(errStr).toContain('invalid');
        expect(errStr).toContain('guid');
      } else {
        // Fallback: inspect entire object string
        const asStr = JSON.stringify(parsed).toLowerCase();
        expect(asStr).toContain('invalid');
        expect(asStr).toContain('guid');
      }
    } else if (typeof parsed === 'string') {
      const lower = parsed.toLowerCase();
      expect(lower).toContain('invalid');
      expect(lower).toContain('guid');
    } else {
      expect(false, `Unexpected error response for invalid GUID format: ${String(parsed)}`).toBeTruthy();
    }
  } else {
    // Unexpected status code
    expect([200, 400, 422], `Expected HTTP 200 or 400/422 for invalid GUID format, got ${status}`).toContain(status);
  }

  await requestContext.dispose();
});
