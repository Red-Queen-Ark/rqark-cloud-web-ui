import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockApiKey, type MockBackend, type MockWrite } from './support/mock-backend';
import { waitForShellStyles } from './support/styles';

const live: MockApiKey = {
  id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  name: 'laptop',
  key_prefix: 'rqark-la7k2m',
  is_active: true,
  expires_at: '2026-12-31T00:00:00Z',
  last_used_at: null,
  revoked_at: null,
  revoked_message: null,
  created_at: '2026-04-05T06:07:08Z',
};

/** A key whose expiry has passed: it stays listed, marked as expired. */
const lapsed: MockApiKey = {
  id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
  name: 'daily driver',
  key_prefix: 'rqark-dr3x9q',
  is_active: false,
  expires_at: '2026-05-01T00:00:00Z',
  last_used_at: '2026-05-01T00:00:01Z',
  revoked_at: '2026-05-01T00:00:02Z',
  revoked_message: 'expired',
  created_at: '2026-04-05T06:07:08Z',
};

/** A key its owner deleted: it is not part of the list at all. */
const deleted: MockApiKey = {
  id: 'cccccccc-3333-4333-8333-cccccccccccc',
  name: 'old phone',
  key_prefix: 'rqark-ph5q1z',
  is_active: false,
  expires_at: null,
  last_used_at: null,
  revoked_at: '2026-05-02T00:00:00Z',
  revoked_message: 'user_deleted',
  created_at: '2026-04-05T06:07:08Z',
};

// `YYYY-MM-DD HH:MM:SS`: date *and* time, zero padded, seconds included.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** The instant a rendered stamp points at, without hardcoding a timezone. */
async function instantOf(page: Page, stamp: string): Promise<number> {
  return new Date(stamp.replace(' ', 'T')).getTime();
}

/** `datetime-local` wants `YYYY-MM-DDTHH:MM` local time, which is what it shows. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function inDays(days: number): string {
  return toLocalInput(new Date(Date.now() + days * 24 * 3600 * 1000).toISOString());
}

/**
 * The last write the page sent with that method. Reads land in `writes` too, and
 * the page reloads the list after every mutation, so the last entry is never the
 * one under test.
 */
function lastWrite(backend: MockBackend, method: string): MockWrite | undefined {
  return backend.writes.filter((write) => write.method === method).at(-1);
}

test('lists the keys, marking expired ones and hiding deleted ones', async ({ page }) => {
  await mockBackend(page, { session: boss, apiKeys: [live, lapsed, deleted] });
  await seedSession(page);

  await page.goto('/en/api-keys');
  await waitForShellStyles(page);

  // The page is reachable from the shell.
  await expect(page.getByRole('list').getByRole('link', { name: 'API keys' })).toBeVisible();

  // The live key, with its tracking id and the prefix it was created with.
  const liveRow = page.getByRole('row').filter({ hasText: 'laptop' });
  await expect(liveRow.getByRole('cell', { name: 'laptop', exact: true })).toBeVisible();
  await expect(liveRow.getByRole('cell').nth(1)).toHaveText(live.id);
  await expect(liveRow.getByRole('cell').nth(2)).toContainText('rqark-la7k2m');
  const created = liveRow.getByRole('cell', { name: TIMESTAMP });
  await expect(created).toBeVisible();
  expect(await instantOf(page, await created.innerText())).toBe(new Date('2026-04-05T06:07:08Z').getTime());
  await expect(liveRow.getByRole('cell').nth(4)).toHaveText('—');

  // An expired key stays in the list and says so.
  const expiredRow = page.getByRole('row').filter({ hasText: 'daily driver' });
  await expect(expiredRow).toBeVisible();
  await expect(expiredRow.getByText('Expired')).toBeVisible();

  // A deleted key is gone, and the timestamps keep the shared shape.
  await expect(page.getByText('old phone')).toHaveCount(0);
  const lastUsed = expiredRow.getByRole('cell', { name: TIMESTAMP }).nth(1);
  expect(await instantOf(page, await lastUsed.innerText())).toBe(new Date('2026-05-01T00:00:01Z').getTime());
});

test('creates a key and shows it once', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, apiKeys: [live] });
  await seedSession(page);

  await page.goto('/en/api-keys');
  await waitForShellStyles(page);

  await page.locator('#api-keys-page-create-btn').click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();
  // A create asks for the name and the expiry, and nothing else.
  await expect(page.locator('#api-key-form-expires-at ~ span')).toHaveText('Leave it empty and the key never expires.');

  await page.locator('#api-key-form-name').fill('CI runner');
  await page.locator('#api-key-form-expires-at').fill(inDays(30));
  await expect(page.locator('#api-key-form-expires-at ~ span')).toHaveText('The key stops working at that moment, and shows as expired here.');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();

  // The write carries the name and an RFC3339 expiry.
  const write = lastWrite(backend, 'POST');
  expect(write?.body).toMatchObject({ name: 'CI runner' });
  expect(String((write?.body as { expires_at?: string }).expires_at)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

  // The whole key is shown once, and the dialog says so.
  await expect(page.locator('[data-testid="form-modal-box"]')).toContainText('This is the only time the whole key is shown.');
  const shown = page.locator('#api-key-created-value');
  await expect(shown).toHaveValue(/^rqark-/);
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  // Closing it leaves the new key in the list, still without the secret.
  await expect(page.getByRole('cell', { name: 'CI runner' })).toBeVisible();
});

test('the copy button hands the key over', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  await mockBackend(page, { session: boss });
  await seedSession(page);

  await page.goto('/en/api-keys');
  await waitForShellStyles(page);

  await page.locator('#api-keys-page-create-first-btn').click();
  await page.locator('#api-key-form-name').fill('CI runner');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();

  const shown = await page.locator('#api-key-created-value').inputValue();
  await page.locator('#api-key-created-copy-btn').click();

  await expect(page.getByText('Key copied')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown);
});

test('the create form refuses a blank name and an expiry in the past', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss });
  await seedSession(page);

  await page.goto('/en/api-keys');
  await waitForShellStyles(page);
  await page.locator('#api-keys-page-create-btn').click();

  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.getByText('Please enter a name')).toBeVisible();
  await expect(page.locator('[data-testid="form-modal"]')).toBeVisible();

  await page.locator('#api-key-form-name').fill('CI runner');
  await page.locator('#api-key-form-expires-at').fill('2020-01-01T00:00');
  await expect(page.locator('#api-key-form-expires-at ~ span')).toHaveText('The expiry has to be in the future');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.getByText('The expiry has to be in the future').last()).toBeVisible();

  // Neither attempt reached the backend.
  expect(backend.writes.filter((write) => write.method === 'POST')).toHaveLength(0);

  // An empty expiry is allowed and means the key never expires.
  await page.locator('#api-key-form-expires-at').fill('');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  // A create opens the dialog that shows the key once; closing it leaves the
  // list, not the form.
  await expect(page.locator('#api-key-created-value')).toBeVisible();
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  expect(lastWrite(backend, 'POST')?.body).toEqual({ name: 'CI runner' });
});

test('edits a key: it is prefilled, and the switch is what turns it off', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, apiKeys: [live] });
  await seedSession(page);

  await page.goto('/en/api-keys');
  await waitForShellStyles(page);

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#api-key-form-name')).toHaveValue('laptop');
  await expect(page.locator('#api-key-form-expires-at')).toHaveValue(toLocalInput(live.expires_at as string));
  await expect(page.locator('[data-testid="form-modal"] input[type="checkbox"]')).toBeChecked();

  // The switch is what stops the key working, and it can be turned back on.
  await page.locator('[data-testid="form-modal"] input[type="checkbox"]').uncheck();
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  expect(lastWrite(backend, 'PATCH')).toEqual({ method: 'PATCH', path: `/api-keys/${live.id}`, body: { is_active: false } });
  await expect(page.getByRole('row').filter({ hasText: 'laptop' }).getByText('Off')).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.locator('[data-testid="form-modal"] input[type="checkbox"]').check();
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  expect(lastWrite(backend, 'PATCH')).toEqual({ method: 'PATCH', path: `/api-keys/${live.id}`, body: { is_active: true } });
  await expect(page.getByRole('row').filter({ hasText: 'laptop' }).getByText('Off')).toHaveCount(0);
});

test('an expired key is renewed by its expiry date, not by its switch', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, apiKeys: [lapsed] });
  await seedSession(page);

  await page.goto('/en/api-keys');
  await waitForShellStyles(page);

  await page.getByRole('button', { name: 'Edit' }).click();
  // The service refuses to switch a lapsed key back on, so the form does not
  // offer it: the expiry date is the only way back.
  await expect(page.locator('[data-testid="form-modal"] input[type="checkbox"]')).toBeDisabled();
  await expect(page.locator('[data-testid="form-modal"]')).toContainText('Setting a new expiry date renews it and turns it back on.');

  await page.locator('#api-key-form-expires-at').fill(inDays(7));
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  const write = lastWrite(backend, 'PATCH');
  expect(write?.method).toBe('PATCH');
  expect(write?.path).toBe(`/api-keys/${lapsed.id}`);
  expect(Object.keys(write?.body as object)).toEqual(['expires_at']);

  // The key is usable again and the row no longer says it expired.
  await expect(page.getByRole('row').filter({ hasText: 'daily driver' }).getByText('Expired')).toHaveCount(0);
});

test('deletes a key behind a confirmation', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, apiKeys: [live] });
  await seedSession(page);

  await page.goto('/en/api-keys');
  await waitForShellStyles(page);

  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('[data-testid="form-modal"]')).toContainText('Delete laptop?');
  await page.locator('[data-testid="form-modal"] .btn-error').click();

  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  expect(lastWrite(backend, 'DELETE')).toMatchObject({ method: 'DELETE', path: `/api-keys/${live.id}` });
  await expect(page.getByText('No API keys found.')).toBeVisible();
  await expect(page.locator('#api-keys-page-create-first-btn')).toBeVisible();
});
