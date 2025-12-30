import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/ValidateGuid';
// Default GUID for this test case
const GUID = process.env.TEST_GUID || '123e4567-e89b-12d3-a456-426614174000';

const SEED_GUID_API = process.env.SEED_GUID_API;
const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';
const NO_SKIP = String(process.env.NO_SKIP || '').toLowerCase() === '1' || String(process.env.NO_SKIP || '').toLowerCase() === 'true';

// If there is no known way to seed the DB and auth is unknown, skip the test so it doesn't fail in CI.
const canSeed = Boolean(SEED_GUID_API) || Boolean(process.env.DB_CONN_STRING);

test('Validate GET request returns true when GUID exists in the database', async () => {
  if (!canSeed && !NO_SKIP) {
    test.skip(true, `No seeding method (SEED_GUID_API or DB_CONN_STRING) provided and NO_SKIP not set; skipping test to avoid false failures in CI`);
  }

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

  // Act: send GET request to endpoint using path param: /api/ValidateGuid/{guid}
  const url = `${ENDPOINT.replace(/\/+$/,'')}/${GUID}`;
  const response = await requestContext.get(url);
