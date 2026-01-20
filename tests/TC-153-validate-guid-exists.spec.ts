import { test, expect, request as playwrightRequest } from '@playwright/test';

// Test: TC-153 - Validate GUID existence in backend returns true for valid existing GUID

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/ValidateGuid';
const GUID = process.env.TEST_GUID || '123e4567-e89b-12d3-a456-426614174000';

const SEED_GUID_API = process.env.SEED_GUID_API; // optional endpoint to seed GUID into DB
const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';
const NO_SKIP = String(process.env.NO_SKIP || '').toLowerCase() === '1' || String(process.env.NO_SKIP || '').toLowerCase() === 'true';

// If there is no known way to seed the DB and auth is unknown, skip the test to avoid false CI failures.
const canSeed = Boolean(SEED_GUID_API) || Boolean(process.env.DB_CONN_STRING);

test('TC-153: Validate backend reports true for an existing GUID', async () => {
  if (!canSeed && !NO_SKIP) {
    test.skip(true, 'No seeding method (SEED_GUID_API or DB_CONN_STRING) provided and NO_SKIP not set; skipping test to avoid false failures in CI');
  }

  // Given a valid GUID exists in the database
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

  // Seed the GUID if a seeding endpoint is provided
  if (SEED_GUID_API) {
    try {
      const seedResponse = await requestContext.post(SEED_GUID_API, {
        data: { id: GUID },
      });
      const ok = [200, 201, 204].includes(seedResponse.status());
      if (!ok) {
        const body = await seedResponse.text();
        throw new Error(`Seeding GUID failed with status ${seedResponse.status()}: ${body}`);
      }
    } catch (err) {
      await requestContext.dispose();
      throw err;
    }
  }

  // When the backend API validates the GUID
  const url = `${ENDPOINT.replace(/\/+$/,'')}/${GUID}`;
  const response = await requestContext.get(url);

  // Then the response should indicate the GUID is valid (true)
  expect(response.status(), `Expected HTTP 200 OK, got ${response.status()}`).toBe(200);

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

  expect(booleanResult, `Expected response body to indicate true for existing GUID but got: ${text}`).toBe(true);

  await requestContext.dispose();
});
