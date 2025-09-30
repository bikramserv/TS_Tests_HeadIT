import { test, expect, request as playwrightRequest } from '@playwright/test';
import { validate as validateUUID } from 'uuid';

test('Validate GET request to https://localhost:7203 returns correct structured response', async () => {
  // Create a custom request context that ignores self-signed SSL errors
  const apiContext = await playwrightRequest.newContext({
    ignoreHTTPSErrors: true,
  });

  // Step 1: Send GET request
  const response = await apiContext.get('https://localhost:7203');
  expect(response.status(), 'Expected HTTP 200 OK').toBe(200);

  // Step 2: Parse response body as JSON
  const body = await response.json();
  expect(Array.isArray(body), 'Response body should be a JSON array').toBeTruthy();

  // Step 3: Validate array contains at least one object
  expect(body.length, 'Array should contain at least one object').toBeGreaterThan(0);

  // Step 4: Validate fields in the first object
  const firstObj = body[0];
  const requiredFields = [
    'id', 'plotNo', 'longitude', 'latitude',
    'street', 'town', 'postCode', 'village'
  ];
  for (const field of requiredFields) {
    expect(firstObj, `Missing required field: ${field}`).toHaveProperty(field);
  }

  // Step 5: Validate 'id' is a valid UUID string
  expect(validateUUID(firstObj.id), "'id' field is not a valid UUID string").toBe(true);

  // Step 6: Validate 'plotNo' is a string
  expect(typeof firstObj.plotNo, "'plotNo' field is not a string").toBe('string');

  // Step 7: Validate 'longitude' is a number
  expect(typeof firstObj.longitude, "'longitude' field is not a number").toBe('number');

  // Step 8: Validate 'latitude' is a number
  expect(typeof firstObj.latitude, "'latitude' field is not a number").toBe('number');

  // Step 9: Validate 'street' is a string
  expect(typeof firstObj.street, "'street' field is not a string").toBe('string');

  // Step 10: Validate 'town' is a string
  expect(typeof firstObj.town, "'town' field is not a string").toBe('string');

  // Step 11: Validate 'postCode' is a string
  expect(typeof firstObj.postCode, "'postCode' field is not a string").toBe('string');

  // Step 12: Validate 'village' is a string
  expect(typeof firstObj.village, "'village' field is not a string").toBe('string');

  // Clean up
  await apiContext.dispose();
});
