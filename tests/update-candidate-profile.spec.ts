import { test, expect, Page } from '@playwright/test';

// Configuration placeholders (replace the PLACEHOLDER values with real values)
const BASE_URL = process.env.BASE_URL || 'PLACEHOLDER_BASE_URL'; // TODO: set to application base URL, e.g. https://app.example.com
const CANDIDATE_SEARCH_PATH = process.env.CANDIDATE_SEARCH_PATH || 'PLACEHOLDER_CANDIDATE_SEARCH_PATH'; // TODO: path where candidate search is available

// Selectors (PLACEHOLDER tokens must remain when unknown; replace before running the test)
const SELECTORS = {
  emailSearchInput: 'PLACEHOLDER_EMAIL_SEARCH_INPUT', // TODO: e.g. 'input[data-test="candidate-email"]' or '#search-email'
  emailSearchButton: 'PLACEHOLDER_EMAIL_SEARCH_BUTTON', // TODO: e.g. 'button[data-test="search"]'
  candidateRowByEmail: 'PLACEHOLDER_CANDIDATE_ROW_SELECTOR_TEMPLATE', // TODO: a template string that includes %EMAIL% or a selector function
  candidateOpenButton: 'PLACEHOLDER_CANDIDATE_OPEN_BUTTON', // TODO: selector to open the candidate profile from results
  editProfileButton: 'PLACEHOLDER_EDIT_PROFILE_BUTTON', // TODO: selector for Edit button on profile
  skillInput: 'PLACEHOLDER_SKILL_INPUT', // TODO: selector for Skill input field
  experienceInput: 'PLACEHOLDER_EXPERIENCE_INPUT', // TODO: selector for Experience input field
  saveButton: 'PLACEHOLDER_SAVE_BUTTON', // TODO: selector for Save/Submit button
  successMessage: 'PLACEHOLDER_SUCCESS_MESSAGE', // TODO: selector for success toast/message
};

// Credentials placeholders (replace if using UI login flow)
const CREDENTIALS = {
  username: process.env.TEST_USERNAME || 'PLACEHOLDER_USERNAME', // TODO
  password: process.env.TEST_PASSWORD || 'PLACEHOLDER_PASSWORD', // TODO
  loginPath: process.env.LOGIN_PATH || 'PLACEHOLDER_LOGIN_PATH', // TODO
  usernameField: 'PLACEHOLDER_USERNAME_SELECTOR', // TODO
  passwordField: 'PLACEHOLDER_PASSWORD_SELECTOR', // TODO
  submitButton: 'PLACEHOLDER_LOGIN_BUTTON_SELECTOR', // TODO
};

// If any placeholder tokens remain, skip the test and list them so maintainers know what to replace.
const placeholdersFound: string[] = [];
if (String(BASE_URL).includes('PLACEHOLDER')) placeholdersFound.push('BASE_URL');
if (String(CANDIDATE_SEARCH_PATH).includes('PLACEHOLDER')) placeholdersFound.push('CANDIDATE_SEARCH_PATH');
for (const [key, value] of Object.entries(SELECTORS)) {
  if (String(value).includes('PLACEHOLDER')) placeholdersFound.push(`SELECTORS.${key}`);
}
for (const [key, value] of Object.entries(CREDENTIALS)) {
  if (String(value).includes('PLACEHOLDER')) placeholdersFound.push(`CREDENTIALS.${key}`);
}
if (placeholdersFound.length) test.skip(true, `Test contains PLACEHOLDER tokens that must be replaced before running: ${placeholdersFound.join(', ')}`);

async function loginIfNeeded(page: Page) {
  if (!CREDENTIALS.loginPath || CREDENTIALS.loginPath.includes('PLACEHOLDER')) return;
  await page.goto(`${BASE_URL}${CREDENTIALS.loginPath}`);
  const loginFormPresent = await page.locator(CREDENTIALS.usernameField).count();
  if (loginFormPresent) {
    if (!CREDENTIALS.username.includes('PLACEHOLDER')) await page.fill(CREDENTIALS.usernameField, CREDENTIALS.username);
    if (!CREDENTIALS.password.includes('PLACEHOLDER')) await page.fill(CREDENTIALS.passwordField, CREDENTIALS.password);
    if (!CREDENTIALS.submitButton.includes('PLACEHOLDER')) await page.click(CREDENTIALS.submitButton);
    await page.waitForLoadState('networkidle');
  }
}

test('Update existing candidate profile successfully', async ({ page }) => {
  // Step 1: Ensure user is logged in
  await loginIfNeeded(page);

  // Step 2: Navigate to candidate search page
  await page.goto(`${BASE_URL}${CANDIDATE_SEARCH_PATH}`);

  // Step 3: Search for candidate by email 'ravi.ranjan@gmail.com'
  await page.fill(SELECTORS.emailSearchInput, 'ravi.ranjan@gmail.com');
  await page.click(SELECTORS.emailSearchButton);

  // Step 4: Verify candidate profile is displayed in results and open it
  const candidateRowSelector = SELECTORS.candidateRowByEmail.includes('%EMAIL%')
    ? SELECTORS.candidateRowByEmail.replace('%EMAIL%', 'ravi.ranjan@gmail.com')
    : SELECTORS.candidateRowByEmail;
  await page.waitForSelector(candidateRowSelector, { timeout: 10_000 });
  await page.click(candidateRowSelector);

  // Step 5: Update Skill field to 'Business Analyst'
  await page.fill(SELECTORS.skillInput, 'Business Analyst');

  // Step 6: Update Experience field to '12'
  await page.fill(SELECTORS.experienceInput, '12');

  // Step 7: Submit the updated candidate profile form
  await page.click(SELECTORS.saveButton);

  // Step 8: Assert candidate profile is updated successfully
  if (!String(SELECTORS.successMessage).includes('PLACEHOLDER')) {
    await page.waitForSelector(SELECTORS.successMessage, { timeout: 10_000 });
    const successText = await page.textContent(SELECTORS.successMessage);
    expect(successText).toBeTruthy();
  } else {
    await page.waitForLoadState('networkidle');
    const skillValue = await page.inputValue(SELECTORS.skillInput);
    const experienceValue = await page.inputValue(SELECTORS.experienceInput);
    expect(skillValue).toBe('Business Analyst');
    expect(experienceValue).toBe('12');
  }
});
