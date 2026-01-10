import { test, expect, request as playwrightRequest } from '@playwright/test';

// This test verifies that when an error is induced during map data retrieval,
// the API returns an appropriate error response and does not return map data entries.

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/MapDatas';
// Endpoint (or control API) that instructs the service to return an error for subsequent map data requests
const FORCE_ERROR_ENDPOINT = process.env.FORCE_ERROR_ENDPOINT || 'PLACEHOLDER_FORCE_ERROR_ENDPOINT'; // TODO: set to a real control endpoint if available
// Optional endpoint to clear the forced error state after the test
const CLEAR_ERROR_ENDPOINT = process.env.CLEAR_ERROR_ENDPOINT || 'PLACEHOLDER_CLEAR_ERROR_ENDPOINT'; // TODO: set to a real clear endpoint if available

const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';

// Skip test when no control endpoint is provided (placeholders detected)
if (!FORCE_ERROR_ENDPOINT || String(FORCE_ERROR_ENDPOINT).startsWith('PLACEHOLDER')) {
  test.skip(true, 'No FORCE_ERROR_ENDPOINT provided (placeholder detected); skipping error-handling test. Set FORCE_ERROR_ENDPOINT env var to run this test.');
}

test('Handle errors when retrieving a list of available map data entries', async () => {
  // Given the map data service is available
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  };
  if (!NO_AUTH && BEARER) headers['authorization'] = `Bearer ${BEARER}`;
  if (API_KEY) headers['x-api-key'] = API_KEY;

  const apiContext = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: headers,
  });

  // Sanity check that the service is reachable before inducing an error
  const baselineResp = await apiContext.get(ENDPOINT).catch(() => null);
  if (!baselineResp || baselineResp.status() === 0) {
    await apiContext.dispose();
    test.skip(true, `Service at ${BASE_URL}${ENDPOINT} is not reachable; skipping test.`);
    return;
  }

  // When a request to retrieve the list of available map data entries is made
  // And an error occurs during data retrieval (induce via control endpoint)
  // Attempt to instruct the service to enter an error state
  try {
    await apiContext.post(FORCE_ERROR_ENDPOINT);
  } catch (e) {
    // best-effort: ignore errors from control endpoint call and proceed to validation
  }

  // Allow a brief moment for the service to apply the error condition
  await new Promise((r) => setTimeout(r, 500));

  // Then the system should return an appropriate error response
  const errorResp = await apiContext.get(ENDPOINT).catch(() => null);
  expect(errorResp, `Expected an HTTP error response from ${ENDPOINT} after inducing failure`).not.toBeNull();

  // Status should indicate an error (>=400)
  const status = errorResp!.status();
  expect(status, `Expected HTTP status >= 400 when an error occurs, got ${status}`).toBeGreaterThanOrEqual(400);
  expect(status, `Expected HTTP status < 600, got ${status}`).toBeLessThan(600);

  // And the error message should clearly indicate the failure reason
  const text = (await errorResp!.text()).trim();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* non-JSON body is acceptable */ }

  const hasErrorMessage = (() => {
    if (typeof parsed === 'string') {
      return parsed.length > 0 && /error|fail|exception|unable/i.test(parsed);
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, any>;
      const candidates = ['error', 'message', 'detail', 'title', 'errors'];
      for (const c of candidates) {
        if (c in obj) return true;
      }
      // check stringified values
      const joined = Object.values(obj).join(' ');
      return /error|fail|exception|unable/i.test(joined);
    }
    return false;
  })();

  expect(hasErrorMessage, `Expected response to contain an error message or fields indicating failure; body: ${text}`).toBeTruthy();

  // And no map data entries should be returned
  const returnedEntriesEmpty = (() => {
    if (Array.isArray(parsed)) {
      return parsed.length === 0;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, any>;
      if (Array.isArray(obj.data)) return obj.data.length === 0;
      if (Array.isArray(obj.items)) return obj.items.length === 0;
    }
    // If the body is not an array or containing data, treat as no entries returned
    return true;
  })();

  expect(returnedEntriesEmpty, 'Expected no map data entries to be returned when an error occurs').toBeTruthy();

  // Cleanup: attempt to clear the induced error state if a clear endpoint is configured
  if (CLEAR_ERROR_ENDPOINT && !String(CLEAR_ERROR_ENDPOINT).startsWith('PLACEHOLDER')) {
    try {
      await apiContext.post(CLEAR_ERROR_ENDPOINT).catch(() => {});
    } catch { /* ignore cleanup failures */ }
  }

  await apiContext.dispose();
});
