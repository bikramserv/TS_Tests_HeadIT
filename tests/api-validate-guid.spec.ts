import { test, expect, request as playwrightRequest } from '@playwright/test';

// Default values
const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/ValidateGuid';
const GUID = process.env.TEST_GUID || '3fa85f64-5717-4562-b3fc-2c963f66afa6';

const SEED_GUID_API = process.env.SEED_GUID_API; // e.g. https://localhost:7203/api/TestHelpers/SeedGuid
const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';
const NO_SKIP = String(process.env.NO_SKIP || '').toLowerCase() === '1' || String(process.env.NO_SKIP || '').toLowerCase() === 'true';

// If there is no known way to seed the DB and auth is unknown, skip the test so it doesn't fail in CI.
if (!SEED_GUID_API && !process.env.DB_CONN_STRING && !NO_SKIP) {
  // Provide clear instructions to the maintainer about how to satisfy preconditions.
  test.skip(true, `Test requires the GUID ${GUID} to exist and optionally authentication headers.

To run this test, provide one of the following before running tests:

1) Provide SEED_GUID_API: an HTTP endpoint that will insert the GUID into the database.
   Example (server-side helper): POST ${BASE_URL}/api/TestHelpers/SeedGuid with JSON body { "id": "${GUID}" }
   Example curl:
     curl -k -X POST "${BASE_URL}/api/TestHelpers/SeedGuid" -H "Content-Type: application/json" -d '{"id":"${GUID}"}'

2) Provide DB_CONN_STRING environment variable and implement a local seeding helper that uses it (not provided by this repo).
   Example SQL to insert a record (adjust table/schema to match your DB):
     INSERT INTO MapDatas (Id, plotNo, longitude, latitude, street, town, postCode, village) VALUES
       ('${GUID}', '1A', 0.0, 0.0, 'Seed Street', 'Seed Town', '0000', 'Seed Village');

3) If the endpoint requires authentication, set API_BEARER_TOKEN or API_KEY, or set NO_AUTH=true when the endpoint is public.

Alternatively, set NO_SKIP=1 to force the test to run without seeding (not recommended).
`);
}

// Build headers based on provided auth info
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
};
if (BEARER) headers['Authorization'] = `Bearer ${BEARER}`;
if (API_KEY) headers['x-api-key'] = API_KEY;

// Main test
test('Validate POST request returns true when GUID exists in the database', async () => {
  // Create request context that ignores self-signed SSL
  const apiContext = await playwrightRequest.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: headers,
  });

  // If a seeding API is provided, call it to ensure the GUID exists before running the assertion.
  if (SEED_GUID_API) {
    const seedResp = await apiContext.post(SEED_GUID_API, { data: { id: GUID } });
    // Accept common success codes
    if (![200, 201, 204].includes(seedResp.status())) {
      await apiContext.dispose();
      throw new Error(`Seeding endpoint returned unexpected status ${seedResp.status()} when trying to ensure GUID ${GUID} exists`);
    }
  }

  // Send POST request to validate GUID
  const response = await apiContext.post(`${BASE_URL}${ENDPOINT}`, { data: { id: GUID } });
  expect(response.status(), 'Expected HTTP 200 OK').toBe(200);

  // Parse response robustly (handle JSON boolean, JSON object wrappers, or plain text 'true')
  let parsed: any;
  try {