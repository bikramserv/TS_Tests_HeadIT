import { test, expect, request as playwrightRequest } from '@playwright/test';

test('Retrieve map data filtered by valid post code using GET endpoint', async () => {
  // Create a custom request context that ignores self-signed SSL errors
  const apiContext = await playwrightRequest.newContext({
    ignoreHTTPSErrors: true,
  });

  // Given the Gateway API is running and accessible
  // (Implicit in the ability to make a request)

  // When a GET request is made to the map data retrieval endpoint with a valid post code parameter
  const validPostCode = '2159TT11'; // TODO: Replace with a valid post code for your environment
  const response = await apiContext.get(`https://localhost:7203/api/MapDatas/${validPostCode}`);

  // Then the response status should be 200 OK
  expect(response.status(), 'Expected HTTP 200 OK').toBe(200);

  // And the response should contain only map data entries matching the specified post code
  const body = await response.json();
  expect(Array.isArray(body), 'Response body should be a JSON array').toBeTruthy();
  expect(body.length, 'Array should contain at least one object').toBeGreaterThan(0);

  for (const entry of body) {
    expect(entry).toHaveProperty('postCode');
    expect(entry.postCode, `Entry postCode should match requested postCode ${validPostCode}`).toBe(validPostCode);
  }

  // Clean up
  await apiContext.dispose();
});
