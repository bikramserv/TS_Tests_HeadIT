import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/ValidateGuid';
const GUID = process.env.TEST_GUID || '3fa85f64-5717-4562-b3fc-2c963f66afa6';

const SEED_GUID_API = process.env.SEED_GUID_API; // e.g. https://localhost:7203/api/TestHelpers/SeedGuid
const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';
const NO_SKIP = String(process.env.NO_SKIP || '').toLowerCase() === '1' || String(process.env.NO_SKIP || '').toLowerCase() === 'true';

// If there is no known way to seed the DB and auth is unknown, skip the test so it doesn't fail in CI.
const canSeed = Boolean(SEED_GUID_API) || Boolean(process.env.DB_CONN_STRING);

test('Validate GET request returns true when GUID exists in the database', async () => {
  if (!canSeed && !NO_SKIP) {
    test.skip(true, 'No seeding method (SEED_GUID_API or DB_CONN_STRING) provided and NO_SKIP not set; skipping test to avoid false failures in CI');
  }

  // Arrange: build headers and request contexts
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
        data: JSON.stringify({ id: GUID }),
      });
      // Accept 200/201/204 as success; otherwise throw to surface failure
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

  // Act: send GET request to endpoint using path param: /api/ValidateGuid/{guid}
  const url = `${ENDPOINT.replace(/\/+$/,'')}/${GUID}`;
  const response = await requestContext.get(url);

  // Assert: status code is 200
  expect(response.status(), `Expected HTTP 200 OK, got ${response.status()}`).toBe(200);

  // Assert: response body contains true (handle multiple response shapes)
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
    // Check common wrapper property names
    if (obj.value === true || obj.result === true || Object.values(obj).includes(true)) booleanResult = true;
    if (obj.value === false || obj.result === false || Object.values(obj).includes(false)) booleanResult = false;
  }

  expect(booleanResult, `Expected response body to indicate true for existing GUID but got: ${text}`).toBe(true);

  await requestContext.dispose();
});
