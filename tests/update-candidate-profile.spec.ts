import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'PLACEHOLDER_BASE_URL'; // TODO: set to application base URL, e.g. https://app.example.com

const SELECTORS = {
  emailSearchInput: 'PLACEHOLDER_EMAIL_SEARCH_INPUT', // TODO: e.g. 'input[data-test="candidate-email"]'
  emailSearchButton: 'PLACEHOLDER_EMAIL_SEARCH_BUTTON', // TODO
  candidateRowByEmail: 'PLACEHOLDER_CANDIDATE_ROW_SELECTOR_TEMPLATE', // TODO: template with %EMAIL% or selector
  skillInput: 'PLACEHOLDER_SKILL_INPUT', // TODO
  experienceInput: 'PLACEHOLDER_EXPERIENCE_INPUT', // TODO
  saveButton: 'PLACEHOLDER_SAVE_BUTTON', // TODO
  successMessage: 'PLACEHOLDER_SUCCESS_MESSAGE', // TODO
};

const CREDENTIALS = {
  username: process.env.TEST_USERNAME || 'PLACEHOLDER_USERNAME', // TODO
  password: process.env.TEST_PASSWORD || 'PLACEHOLDER_PASSWORD', // TODO
  loginPath: process.env.LOGIN_PATH || 'PLACEHOLDER_LOGIN_PATH', // TODO
  usernameField: 'PLACEHOLDER_USERNAME_SELECTOR', // TODO
  passwordField: 'PLACEHOLDER_PASSWORD_SELECTOR', // TODO
  submitButton: 'PLACEHOLDER_LOGIN_BUTTON_SELECTOR', // TODO
};

// Skip if any placeholders remain so maintainers know to provide real values.
const placeholderKeys: string[] = [];
for (const [k, v] of Object.entries(SELECTORS)) if (String(v).startsWith('PLACEHOLDER')) placeholderKeys.push(`SELECTORS.${k}`);
for (const [k, v] of Object.entries(CREDENTIALS)) if (String(v).startsWith('PLACEHOLDER')) placeholderKeys.push(`CREDENTIALS.${k}`);
if (String(BASE_URL).startsWith('PLACEHOLDER')) placeholderKeys.push('BASE_URL');
if (placeholderKeys.length > 0) {
  test.skip(true, `Missing runtime configuration for: ${placeholderKeys.join(', ')} (replace PLACEHOLDER_* values or set environment variables)`);
}

test('Update candidate profile fields and verify success', async ({ page }) => {
  // Step 1: Navigate to the application
  await page.goto(BASE_URL);

  // Step 2: Login if login path is provided
  if (!String(CREDENTIALS.loginPath).startsWith('PLACEHOLDER')) {
    await page.goto(CREDENTIALS.loginPath);
    await page.fill(CREDENTIALS.usernameField, CREDENTIALS.username);
    await page.fill(CREDENTIALS.passwordField, CREDENTIALS.password);
    await page.click(CREDENTIALS.submitButton);
  }

  // Step 3: Search for candidate by email
  const targetEmail = 'ravi.ranjan@gmail.com'; // TODO: replace or parameterize if needed
  await page.fill(SELECTORS.emailSearchInput, targetEmail);
  await page.click(SELECTORS.emailSearchButton);

  // Step 4: Open candidate profile from search results
  const candidateRowSelector = SELECTORS.candidateRowByEmail.includes('%EMAIL%')
    ? SELECTORS.candidateRowByEmail.replace('%EMAIL%', targetEmail)
    : SELECTORS.candidateRowByEmail;
  await page.waitForSelector(candidateRowSelector, { timeout: 10_000 });
  await page.click(candidateRowSelector);

  // Step 5: Update skill and experience fields
  await page.fill(SELECTORS.skillInput, 'Business Analyst');
  await page.fill(SELECTORS.experienceInput, '12');

  // Step 6: Save changes
  await page.click(SELECTORS.saveButton);

  // Step 7: Verify success message appears
  if (!String(SELECTORS.successMessage).startsWith('PLACEHOLDER')) {
    await page.waitForSelector(SELECTORS.successMessage, { timeout: 10_000 });
    const msg = await page.textContent(SELECTORS.successMessage);
    expect(msg && msg.length, 'Expected success message to be non-empty').toBeGreaterThan(0);
  }
});