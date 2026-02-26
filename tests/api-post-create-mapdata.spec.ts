import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = '/api/MapDatas';

const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';

function randomId(): string {
  const anyCrypto = (globalThis as any).crypto as { randomUUID?: () => string } | undefined;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();

  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

test('TC-166: Successfully create a new map data object with valid input data', async () => {
  // Given the API endpoint for creating map data is available
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

  const apiContext = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: headers,
  });

  // When a POST request is sent with valid map data fields including id, plotNo, longitude, latitude, street, town, postCode, and village
  const newMapData = {
    id: randomId(),
    plotNo: '123A',
    longitude: 12.34567,
    latitude: 54.321,
    street: 'Maple Street',
    town: 'Springfield',
    postCode: '98765',
    village: 'North Village',
  };

  const response = await apiContext.post(ENDPOINT, {
    data: newMapData,
  });

  // Then the API should respond with HTTP status 201 Created
  expect(response.status(), 'Expected HTTP 201 Created').toBe(201);

  // And the response body should contain the created map data object with the same fields
  const responseBody = await response.json();
  expect(responseBody).toMatchObject(newMapData);

  // Clean up
  await apiContext.dispose();
});
