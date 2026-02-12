import { test, expect, request } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/MapDatas';

// This test verifies retrieval of map data by postcode validates that postcode is a string
// and fails with an error when the postcode parameter is passed as an integer.

test.describe('Retrieve map data by postcode and validate postcode is a string; fail if integer', () => {
  test('GET with valid string postcode returns map data with postcode as string', async () => {
    // Create API request context
    const apiContext = await request.newContext({ ignoreHTTPSErrors: true });

    // Define a valid postcode as a string (replace with valid postcode for your environment)
    const validPostcode = '215133626211A220';

    // When a GET request is made with a valid string postcode
    const response = await apiContext.get(`${BASE_URL}${ENDPOINT}/${validPostcode}`);

    // Then the response status should be 200 OK
    expect(response.status(), 'Expected HTTP 200 OK').toBe(200);

    // And the response should contain map data entries with the postcode as a string
    const body = await response.json();
    expect(Array.isArray(body), 'Response body should be a JSON array').toBeTruthy();
    expect(body.length, 'Response array should contain at least one item').toBeGreaterThan(0);
    for (const entry of body) {
      expect(entry).toHaveProperty('postCode');
      expect(typeof entry.postCode, 'postCode field should be a string').toBe('string');
      expect(entry.postCode).toBe(validPostcode);
    }

    await apiContext.dispose();
  });

  test('GET with integer postcode returns error indicating invalid postcode format', async () => {
    // Create API request context
    const apiContext = await request.newContext({ ignoreHTTPSErrors: true });

    // Define an invalid postcode as an integer
    const invalidPostcode = 123456;

    // When a GET request is made with integer as postcode
    const response = await apiContext.get(`${BASE_URL}${ENDPOINT}/${invalidPostcode}`);

    // Then the API should respond with an error indicating invalid postcode format
    expect(response.status(), 'Expected HTTP status 400 or greater for invalid postcode').toBeGreaterThanOrEqual(400);

    // Try to parse the response body for error details
    let errorBody: any = null;
    try {
      errorBody = await response.json();
    } catch {
      // Ignore parsing error; response might not be JSON
    }

    // Validate error message presence in known fields
    const errorMsg = errorBody?.error || errorBody?.message || errorBody?.detail || '';
    expect(errorMsg.length > 0, 'Response should contain an error message indicating invalid postcode format').toBe(true);

    await apiContext.dispose();
  });
});
