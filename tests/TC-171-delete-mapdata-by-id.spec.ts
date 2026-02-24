import { test, expect, request as playwrightRequest } from '@playwright/test';

// TC-171: Successfully delete an existing map data object
// Repo note: No DELETE route contract is confirmed in-repo (no controller/OpenAPI evidence).
// To avoid hardcoding potentially incorrect non-repo routes, this test requires explicit configuration.
//
// Required env vars (set to real routes for your API):
// - DELETE_MAPDATA_BY_ID_ENDPOINT_TEMPLATE  e.g. '/api/MapDatas/{id}'
// - GET_MAPDATA_BY_ID_ENDPOINT_TEMPLATE     e.g. '/api/MapDatas/{id}' (or other read route used to verify deletion)
// - TC171_ID                                existing id to delete (must exist), or provide MAPDATAS_CREATE_ENDPOINT to seed
//
// Optional env vars:
// - MAPDATAS_CREATE_ENDPOINT                e.g. '/api/MapDatas' (used to seed the precondition if TC171_ID not provided)
// - BASE_URL                                defaults to 'https://localhost:7203'

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';

const MAPDATAS_CREATE_ENDPOINT = process.env.MAPDATAS_CREATE_ENDPOINT; // optional seeding endpoint
const DELETE_TEMPLATE = process.env.DELETE_MAPDATA_BY_ID_ENDPOINT_TEMPLATE || 'PLACEHOLDER_DELETE_BY_ID_TEMPLATE'; // TODO: set real route
const GET_TEMPLATE = process.env.GET_MAPDATA_BY_ID_ENDPOINT_TEMPLATE || 'PLACEHOLDER_GET_BY_ID_TEMPLATE'; // TODO: set real route

const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';

function resolveTemplate(template: string, id: string): string {
  return template.replace('{id}', encodeURIComponent(id));
}

function isPlaceholderRoute(v: string | undefined): boolean {
  return !v || v.includes('PLACEHOLDER');
}

test('TC-171: Successfully delete an existing map data object', async () => {
  // Enforce compliance: no hardcoded non-repo routes.
  if (isPlaceholderRoute(DELETE_TEMPLATE) || isPlaceholderRoute(GET_TEMPLATE)) {
    test.skip(
      true,
      'DELETE/GET route templates are not configured. Set DELETE_MAPDATA_BY_ID_ENDPOINT_TEMPLATE and GET_MAPDATA_BY_ID_ENDPOINT_TEMPLATE to real in-repo API routes (avoid hardcoded guesses).',
    );
  }

  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  };

  if (!NO_AUTH && BEARER) headers['authorization'] = `Bearer ${BEARER}`;
  if (API_KEY) headers['x-api-key'] = API_KEY;

  const apiContext = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: headers,
  });

  // Given an existing map data object with ID
  // Prefer explicit env-provided id; otherwise best-effort seed via MAPDATAS_CREATE_ENDPOINT.
  let idToDelete = (process.env.TC171_ID || '').trim();

  if (!idToDelete) {
    if (!MAPDATAS_CREATE_ENDPOINT) {
      await apiContext.dispose();
      test.skip(true, 'Precondition not met: set TC171_ID to an existing id or provide MAPDATAS_CREATE_ENDPOINT to seed.');
      return;
    }

    // TODO: Align seed body to actual API contract if it differs.
    const seedBody = {
      id: `00000000-0000-0000-0000-${Date.now().toString().padStart(12, '0')}`.slice(0, 36),
      plotNo: 'TC-171',
      longitude: 12.34,
      latitude: 56.78,
      street: 'Delete Street',
      town: 'Delete Town',
      postCode: `TC171-${Date.now()}`,
      village: 'Delete Village',
    };

    const seedResp = await apiContext.post(MAPDATAS_CREATE_ENDPOINT, { data: seedBody }).catch(() => null);
    if (!seedResp) {
      await apiContext.dispose();
      test.skip(true, 'Unable to seed precondition (no response from create endpoint).');
      return;
    }

    if (seedResp.status() !== 200)  // the generated code has 201 but it should be 200 .
      {
      const body = await seedResp.text();
      await apiContext.dispose();
      test.skip(true, `Unable to seed precondition. Expected 201 Created but got ${seedResp.status()} Body=${body}`);
      return;
    }

    // If API echoes created object with id, prefer that; else fall back to seeded id.
    try {
      const created = (await seedResp.json()) as { id?: string };
      idToDelete = created?.id || seedBody.id;
    } catch {
      idToDelete = seedBody.id;
    }
  }

  // When I send a DELETE request to the API endpoint "/.../{id}"
  const deletePath = resolveTemplate(DELETE_TEMPLATE, idToDelete);
  const deleteResp = await apiContext.delete(deletePath);

  // Then the API responds with HTTP status 204 No Content
  expect(
    deleteResp.status(),
    `Expected HTTP 200 No Content, got ${deleteResp.status()} body=${(await deleteResp.text()).trim()}`,
  ).toBe(200);

  // And the map data object is no longer retrievable from the system
  // Contract required: definitively verify non-retrievability (commonly 404/410 for GET-by-id).
  const getPath = resolveTemplate(GET_TEMPLATE, idToDelete);
  const getResp = await apiContext.get(getPath);

  expect(
    [404, 410].includes(getResp.status()),
    `Expected GET-after-delete to be non-retrievable (404/410), got ${getResp.status()} body=${(await getResp.text()).trim()}`,
  ).toBeTruthy();

  await apiContext.dispose();
});
