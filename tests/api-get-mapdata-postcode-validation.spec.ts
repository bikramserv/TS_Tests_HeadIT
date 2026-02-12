import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE_URL = 'https://localhost:7203';
const ENDPOINT = '/api/MapDatas';

// Test case TC-165: Retrieve map data by postcode and validate postcode is a string; fail if integer

test('TC-165: Retrieve map data with a valid string postcode and validate postCode is a string', async () => {
  // Given the map data API endpoint is available
  const apiContext = await playwrightRequest.newContext({
    ignoreHTTPSErrors: true,
  });

  // When a GET request is made with a valid string postcode
  const validPostcode = '215133626211A220'; // TODO: Replace with valid string postcode for environment
  const response = await apiContext.get(`${BASE_URL}${ENDPOINT}/${validPostcode}`);

  // Then the response should contain map data with the postcode as a string
  expect(response.status(), 'Expected HTTP 200 OK').toBe(200);
  const body = await response.json();
  expect(Array.isArray(body), 'Response body should be a JSON array').toBe(true);
  expect(body.length, 'Array should not be empty').toBeGreaterThan(0);
  for (const entry of body) {
    expect(entry).toHaveProperty('postCode');
    expect(typeof entry.postCode).toBe('string');
    expect(entry.postCode).toBe(validPostcode);
  }

  // Clean up
  await apiContext.dispose();
});


test('TC-165: Retrieve map data with an integer postcode and expect an error indicating invalid postcode format', async () => {
  // Given the map data API endpoint is available
  const apiContext = await playwrightRequest.newContext({
    ignoreHTTPSErrors: true,
  });

  // When a GET request is made with an integer as postcode
  const invalidPostcode = 123456789;
  const response = await apiContext.get(`${BASE_URL}${ENDPOINT}/${invalidPostcode}`);

  // Then the API should respond with an error indicating invalid postcode format
  expect(response.status(), 'Expected HTTP client error status code').toBeGreaterThanOrEqual(400);
  expect(response.status(), 'Expected HTTP client error status code').toBeLessThan(600);

  // Check error message contains indication of invalid postcode format
  let text = await response.text();
  // try to parse JSON if possible
  let parsed;
  try { parsed = JSON.parse(text); } catch {
    parsed = null;
  }

  const hasErrorMessage = () => {
    if (typeof parsed === 'string') {
      return /invalid.*post(code|code format)?/i.test(parsed);
    }
    if (parsed && typeof parsed === 'object') {
      const keys = Object.keys(parsed);
      for (const key of keys) {
        if (/error|message|detail|title|errors/i.test(key)) {
          const val = parsed[key];
          if (typeof val === 'string' && /invalid.*post(code|code format)?/i.test(val)) {
            return true;
          }
        }
      }
      // fallback: check joined string values
      const allVals = Object.values(parsed).join(' ');
      return /invalid.*post(code|code format)?/i.test(allVals);
    }
    return false;
  };

  expect(hasErrorMessage(), 'Expected error message indicating invalid postcode format').toBe(true);

  // Clean up
  await apiContext.dispose();
});
