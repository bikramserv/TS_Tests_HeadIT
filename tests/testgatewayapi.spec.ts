import { test, expect, request as playwrightRequest } from '@playwright/test';

test('PI server API response validation', async () => {
  // Create a custom request context that ignores self-signed SSL
  const apiContext = await playwrightRequest.newContext({
    ignoreHTTPSErrors: true,
  });

  // Step 01: GET request
  const response = await apiContext.get('https://localhost:7203/api/MapDatas');
  expect(response.status(), 'Expected HTTP 200 OK').toBe(200);

  // Step 02: Parse response as JSON
  const body = await response.json();
  expect(Array.isArray(body), 'Response body should be a JSON array').toBeTruthy();
  expect(body.length, 'Array should contain at least one object').toBeGreaterThan(0);

  // Step 03: Validate fields in the first object
  const firstObj = body[0];
  const requiredFields = [
    'id', 'plotNo', 'longitude', 'latitude',
    'street', 'town', 'postCode', 'village'
  ];
  for (const field of requiredFields) {
    expect(firstObj, `Missing required field: ${field}`).toHaveProperty(field);
  }

  // Clean up
  await apiContext.dispose();
});
