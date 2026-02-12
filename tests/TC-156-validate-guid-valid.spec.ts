import { test, expect, request as playwrightRequest } from '@playwright/test';

// Test: TC-156 - Validate that a valid GUID is recognized successfully by the backend

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/ValidateGuid';
const GUID = process.env.TEST_VALID_GUID || '3fa85f64-5717-4562-b3fc-2c963f66afa6'; // Default valid GUID

const SEED_GUID_API = process.env.SEED_GUID_API; // optional endpoint to seed GUID into DB
const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';
const NO_SKIP = String(process.env.NO_SKIP || '').toLowerCase() === '1' || String(process.env.NO_SKIP || '').toLowerCase() === 'true';

// Skip test in CI if no seeding or DB connection info and skipping is allowed
const canSeed = Boolean(SEED_GUID_API) || Boolean(process.env.DB_CONN_STRING);

test('Validate that a valid GUID is recognized successfully by the backend', async () => {
  if (!canSeed && !NO_SKIP) {
    test.skip(true, `No seeding method (SEED_GUID_API or DB_CONN_STRING) provided and NO_SKIP not set; skipping test to avoid false failures in CI`);
  }

  // Arrange headers and request context
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

  // Seed the GUID if seeding endpoint is provided
  if (SEED_GUID_API) {
    const seedResponse = await requestContext.post(SEED_GUID_API, { data: { id: GUID } });
    const ok = [200, 201, 204].includes(seedResponse.status());
    if (!ok) {
      const body = await seedResponse.text();
      await requestContext.dispose();
      throw new Error(`Seeding GUID failed with status ${seedResponse.status()}: ${body}`);
    }
  }

  // Act: send GET request to validate the GUID
  const url = `${ENDPOINT.replace(/\/+$/,'')}/${GUID}`;
  const response = await requestContext.get(url);

  // Assert that response is successful and body indicates true
  expect(response.status(), `Expected HTTP 200 OK, got ${response.status()}`).toBe(200);

  const text = (await response.text()).trim();

  // Parse response robustly for truthy validation outcome
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Ignore parse errors, keep raw text
  }

  if (typeof parsed === 'boolean') {
    expect(parsed).toBe(true);
  } else if (typeof parsed === 'object' && parsed !== null) {
    // Expect property that indicates success, guess property 'isValid' or similar
    const isValid = (parsed as any).isValid ?? (parsed as any).valid ?? (parsed as any).exists;
    expect(isValid).toBe(true);
  } else if (typeof parsed === 'string') {
    expect(parsed.toLowerCase()).toBe('true');
  } else {
    throw new Error(`Unexpected response body format for valid GUID validation: ${text}`);
  }

  await requestContext.dispose();
});
