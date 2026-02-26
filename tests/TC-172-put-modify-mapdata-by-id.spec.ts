import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';

const MAPDATAS_CREATE_ENDPOINT = process.env.MAPDATAS_CREATE_ENDPOINT; // optional seeding endpoint
const PUT_TEMPLATE = process.env.PUT_MAPDATA_BY_ID_ENDPOINT_TEMPLATE || 'PLACEHOLDER_PUT_BY_ID_TEMPLATE'; // TODO: set real route
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

function randomId(): string {
  const anyCrypto = (globalThis as any).crypto as { randomUUID?: () => string } | undefined;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();

  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

test('TC-172: Modify an existing map data object successfully', async () => {
  // Scenario: Successfully modify an existing map data object

  // Given I have an existing map data object with a valid ID
  if (isPlaceholderRoute(PUT_TEMPLATE) || isPlaceholderRoute(GET_TEMPLATE)) {
    test.skip(
      true,
      'PUT/GET route templates are not configured. Set PUT_MAPDATA_BY_ID_ENDPOINT_TEMPLATE and GET_MAPDATA_BY_ID_ENDPOINT_TEMPLATE to real in-repo API routes (avoid hardcoded guesses).',
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

  let idToUpdate = (process.env.TC172_ID || '').trim();
  let existing: any | null = null;

  if (!idToUpdate) {
    if (!MAPDATAS_CREATE_ENDPOINT) {
      await apiContext.dispose();
      test.skip(true, 'Precondition not met: set TC172_ID to an existing id or provide MAPDATAS_CREATE_ENDPOINT to seed.');
      return;
    }

    const seedBody = {
      id: randomId(),
      plotNo: 'TC-172-SEED',
      longitude: 10.11,
      latitude: 20.21,
      street: 'Seed Street',
      town: 'Seed Town',
      postCode: `TC172-${Date.now()}`,
      village: 'Seed Village',
    };

    const seedResp = await apiContext.post(MAPDATAS_CREATE_ENDPOINT, { data: seedBody }).catch(() => null);
    if (!seedResp) {
      await apiContext.dispose();
      test.skip(true, 'Unable to seed precondition (no response from create endpoint).');
      return;
    }

    if (![200, 201, 202].includes(seedResp.status())) {
      const body = await seedResp.text();
      await apiContext.dispose();
      test.skip(true, `Unable to seed precondition. Expected 200/201/202 but got ${seedResp.status()} Body=${body}`);
      return;
    }

    try {
      const created = (await seedResp.json()) as any;
      idToUpdate = created?.id || seedBody.id;
      existing = created || seedBody;
    } catch {
      idToUpdate = seedBody.id;
      existing = seedBody;
    }
  } else {
    const getExistingResp = await apiContext.get(resolveTemplate(GET_TEMPLATE, idToUpdate)).catch(() => null);
    if (getExistingResp && getExistingResp.ok()) {
      try {
        existing = await getExistingResp.json();
      } catch {
        existing = null;
      }
    }
  }

  // When I send a PUT request to the API endpoint with updated map data
  const updateBody = {
    ...(existing && typeof existing === 'object' ? existing : {}),
    id: idToUpdate,
    street: `Updated Street ${Date.now()}`,
    town: `Updated Town ${Date.now()}`,
  };

  const putPath = resolveTemplate(PUT_TEMPLATE, idToUpdate);
  const putResp = await apiContext.put(putPath, { data: updateBody });

  const putText = (await putResp.text()).trim();

  // Then the API should respond with HTTP status 202 Accepted
  expect(
    putResp.status(),
    `Expected HTTP 202 Accepted, got ${putResp.status()} body=${putText}`,
  ).toBe(202);

  // And the response should contain the updated map data object details
  let putBody: any = null;
  if (putText) {
    try {
      putBody = JSON.parse(putText);
    } catch {
      putBody = putText;
    }
  }

  if (putBody && typeof putBody === 'object') {
    expect(putBody).toMatchObject({
      id: idToUpdate,
      street: updateBody.street,
      town: updateBody.town,
    });
  }

  // And the updated fields should reflect the changes I sent
  const getPath = resolveTemplate(GET_TEMPLATE, idToUpdate);
  const getResp = await apiContext.get(getPath);
  expect(getResp.ok(), `Expected GET-after-update to succeed, got ${getResp.status()} body=${(await getResp.text()).trim()}`).toBeTruthy();

  const getBody = await getResp.json();
  const updatedObj = Array.isArray(getBody) ? getBody[0] : getBody;

  expect(updatedObj).toMatchObject({
    id: idToUpdate,
    street: updateBody.street,
    town: updateBody.town,
  });

  await apiContext.dispose();
});
