import { test, expect, request as playwrightRequest } from '@playwright/test';

// Test environment variables supported:
// - BASE_URL: base url for the API (defaults to https://localhost:7203)
// - ENDPOINT: endpoint path (defaults to /api/ValidateGuid)
// - API_BEARER_TOKEN: optional Bearer token for Authorization header
// - API_KEY: optional API key to send as 'x-api-key' header
// - NO_AUTH: set to '1' or 'true' if the endpoint requires no authentication
// - TEST_GUID: the valid GUID string to test
// - SEED_GUID_API: optional seeding endpoint to ensure GUID exists in backend before testing

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/ValidateGuid';
const GUID = process.env.TEST_GUID || '123e4567-e89b-12d3-a456-426614174000';

const SEED_GUID_API = process.env.SEED_GUID_API;
const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';
const NO_SKIP = String(process.env.NO_SKIP || '').toLowerCase() === '1' || String(process.env.NO_SKIP || '').toLowerCase() === 'true';

// If no way to seed or verify, optionally skip to avoid false failures in CI
const canSeed = Boolean(SEED_GUID_API) || Boolean(process.env.DB_CONN_STRING);

test('Validate backend response for a valid GUID submission', async () => {
  if (!canSeed && !NO_SKIP) {
    test.skip(true, `No seeding method (SEED_GUID_API or DB_CONN_STRING) provided and NO_SKIP not set; skipping test to avoid false failures in CI`);
  }

  // Given the backend API is running and accessible
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json'
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

  // Seed the GUID if seed API is provided
  if (SEED_GUID_API) {
    const seedResponse = await requestContext.post(SEED_GUID_API, { data: { id: GUID } });
    const ok = [200,201,204].includes(seedResponse.status());
    if (!ok) {
      const body = await seedResponse.text();
      throw new Error(`Seeding GUID failed with status ${seedResponse.status()}: ${body}`);
    }
  }

  // When a valid GUID is submitted for validation
  const url = `${ENDPOINT.replace(/\/+$/,'')}/${GUID}`;
  const response = await requestContext.get(url);

  // Then the backend should respond with success indicating the GUID is valid
  expect(response.status()).toBe(200);

  // Expect the response body to indicate the GUID is valid (usually true boolean or similar)
  const text = (await response.text()).trim();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {}

  let valid = false;
  if (typeof parsed === 'boolean') {
    valid = parsed;
  } else if (typeof parsed === 'string') {
    valid = parsed.toLowerCase() === 'true';
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, any>;
    if (obj.value === true || obj.result === true || Object.values(obj).includes(true)) valid = true;
  }

  expect(valid).toBe(true);
});
