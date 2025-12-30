import { test, expect, request as playwrightRequest } from '@playwright/test';
import { execSync } from 'child_process';

const BASE_URL = process.env.BASE_URL || 'https://localhost:7203';
const ENDPOINT = process.env.ENDPOINT || '/api/MapDatas';

const HEALTH_ENDPOINT = process.env.HEALTH_ENDPOINT || 'PLACEHOLDER_HEALTH_ENDPOINT'; // TODO: set to health endpoint path if available (e.g. '/health')
const CRASH_ENDPOINT = process.env.CRASH_ENDPOINT || 'PLACEHOLDER_CRASH_ENDPOINT'; // TODO: endpoint to trigger a crash for testing (e.g. '/api/TestHelpers/Crash')
const SERVICE_CONTROL_CMD = process.env.SERVICE_CONTROL_CMD || 'PLACEHOLDER_SERVICE_CONTROL_CMD'; // TODO: command to control/restart the service (e.g. 'docker restart myservice')

const RECOVERY_TIMEOUT_MS = Number(process.env.RECOVERY_TIMEOUT_MS || '60000');
const RECOVERY_POLL_INTERVAL_MS = Number(process.env.RECOVERY_POLL_INTERVAL_MS || '2000');

const BEARER = process.env.API_BEARER_TOKEN;
const API_KEY = process.env.API_KEY;
const NO_AUTH = String(process.env.NO_AUTH || '').toLowerCase() === '1' || String(process.env.NO_AUTH || '').toLowerCase() === 'true';

// Skip the test when no real control surface is provided. We consider PLACEHOLDER_* values as not provided.
const hasRealCrashControl = (CRASH_ENDPOINT && !String(CRASH_ENDPOINT).startsWith('PLACEHOLDER')) || (SERVICE_CONTROL_CMD && !String(SERVICE_CONTROL_CMD).startsWith('PLACEHOLDER'));
if (!hasRealCrashControl) {
  test.skip(true, 'No CRASH_ENDPOINT or SERVICE_CONTROL_CMD provided (placeholders detected); skipping recovery test. Replace PLACEHOLDER values or set env vars to run this test.');
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function waitFor(predicate: () => Promise<boolean>, timeoutMs: number, intervalMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await predicate()) return;
    } catch (e) {
      // ignore and retry
    }
    await sleep(intervalMs);
  }
  throw new Error('Timeout waiting for condition');
}

test('Verify API recovers and responds correctly after a crash caused by GET request', async () => {
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

  // Given the API previously crashed on a GET request
  if (CRASH_ENDPOINT && !String(CRASH_ENDPOINT).startsWith('PLACEHOLDER')) {
    // Best-effort: trigger crash via provided endpoint
    await apiContext.post(CRASH_ENDPOINT).catch(() => {});
  } else if (SERVICE_CONTROL_CMD && !String(SERVICE_CONTROL_CMD).startsWith('PLACEHOLDER')) {
    // If a service control command is provided, attempt to execute it to simulate crash/restart
    try {
      execSync(SERVICE_CONTROL_CMD, { stdio: 'inherit' });
    } catch (err) {
      // continue even if command fails; test will detect service availability
    }
  }

  // Wait for service to be unavailable (best-effort)
  try {
    if (HEALTH_ENDPOINT && !String(HEALTH_ENDPOINT).startsWith('PLACEHOLDER')) {
      await waitFor(async () => {
        const resp = await apiContext.get(HEALTH_ENDPOINT).catch(() => null);
        if (!resp) return true;
        return resp.status() !== 200;
      }, 10_000, 500);
    } else {
      await waitFor(async () => {
        const resp = await apiContext.get(ENDPOINT).catch(() => null);
        if (!resp) return true;
        return resp.status() >= 500 || resp.status() === 0;
      }, 10_000, 500);
    }
  } catch (e) {
    // ignore timeouts for the unavailability detection and proceed to recovery attempts
  }

  // When a client sends a valid GET request to the API endpoint again
  if (SERVICE_CONTROL_CMD && !String(SERVICE_CONTROL_CMD).startsWith('PLACEHOLDER')) {
    try {
      // Attempt to (re)start the service using the provided command
      execSync(SERVICE_CONTROL_CMD, { stdio: 'inherit' });
    } catch (err) {
      // proceed regardless of restart command result
    }
  }

  // Wait for recovery
  await waitFor(async () => {
    const healthUrl = (!String(HEALTH_ENDPOINT).startsWith('PLACEHOLDER') ? HEALTH_ENDPOINT : ENDPOINT) as string;
    const resp = await apiContext.get(healthUrl).catch(() => null);
    return resp !== null && resp.status() === 200;
  }, RECOVERY_TIMEOUT_MS, RECOVERY_POLL_INTERVAL_MS);

  // Then the server should respond with a 200 OK status code
  const response = await apiContext.get(ENDPOINT);
  expect(response.status(), `Expected HTTP 200 OK from ${ENDPOINT} after recovery`).toBe(200);

  // And the response should contain the expected data
  const text = (await response.text()).trim();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { }

  if (Array.isArray(parsed)) {
    expect(parsed.length, 'Expected response array to contain at least one item').toBeGreaterThan(0);
  } else if (parsed && typeof parsed === 'object') {
    expect(Object.keys(parsed).length, 'Expected response object to contain properties').toBeGreaterThan(0);
  } else {
    expect(String(parsed).length, 'Expected non-empty response body').toBeGreaterThan(0);
  }

  // And the API should not crash (verify a subsequent request succeeds)
  const secondResp = await apiContext.get(ENDPOINT);
  expect(secondResp.status(), 'Expected a subsequent GET to return 200 OK, indicating stability').toBe(200);

  await apiContext.dispose();
});
