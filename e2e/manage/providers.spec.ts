import { expect, test, type Page } from '@playwright/test';
import { WRITE_TIMESTAMP, boss, mockBackend, plain, seedSession } from '../support/mock-backend';
import { expectRowActions, openRowActions } from '../support/row-actions';
import { openDisclosure, waitForShellStyles } from '../support/styles';

// `YYYY-MM-DD HH:MM:SS`, the one timestamp shape the UI renders.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** The instant a rendered `YYYY-MM-DD HH:MM:SS` string points at. */
async function instantOf(stamp: string): Promise<number> {
  return new Date(stamp.replace(' ', 'T')).getTime();
}

const primary = {
  id: 'provider-1',
  name: 'primary',
  model_name: 'deepseek-v4-pro',
  api_base: 'https://api.deepseek.com/v1',
  api_key: 'sk-rqark-0000',
  priority: 1,
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-06T07:08:09Z',
};

/** Reveals the fields that are not required, which start collapsed. */
function openAdvanced(page: Page): Promise<void> {
  return openDisclosure(page, 'provider-advanced');
}

test('lists, creates, edits and deletes providers', async ({ page }) => {
  await mockBackend(page, { session: boss, providers: [primary] });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);

  // The page is reachable from the shell, and the seeded provider is listed.
  await expect(page.getByRole('link', { name: 'Providers' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'primary' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'deepseek-v4-pro' })).toBeVisible();

  // Create, including a numeric generation parameter.
  await page.locator('#providers-page-create-btn').click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();
  await openAdvanced(page);
  await page.locator('#provider-name').fill('secondary');
  await page.locator('#provider-model_name').fill('gpt-5');
  await page.locator('#provider-api_base').fill('https://api.openai.com/v1');
  await page.locator('#provider-api_key').fill('sk-secondary');
  await page.locator('#provider-priority').fill('3');
  await page.locator('#provider-temperature').fill('0.7');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'secondary' })).toBeVisible();

  // Edit: the dialog is prefilled, numbers included, and the change persists.
  const row = page.getByRole('row').filter({ hasText: 'secondary' });
  const menu = await openRowActions(page, row);
  await menu.getByRole('button', { name: 'Edit' }).click();
  await openAdvanced(page);
  await expect(page.locator('#provider-name')).toHaveValue('secondary');
  await expect(page.locator('#provider-model_name')).toHaveValue('gpt-5');
  await expect(page.locator('#provider-priority')).toHaveValue('3');
  await expect(page.locator('#provider-temperature')).toHaveValue('0.7');
  // A provider that never picked a reasoning effort reads back as the form's
  // default, `high`, which the next save then writes.
  await expect(page.locator('#provider-reasoning_effort')).toHaveValue('high');
  await page.locator('#provider-name').fill('secondary-pro');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'secondary-pro' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'secondary', exact: true })).toHaveCount(0);

  // Delete: the confirmation removes the provider.
  const renamed = page.getByRole('row').filter({ hasText: 'secondary-pro' });
  const renamedMenu = await openRowActions(page, renamed);
  await renamedMenu.getByRole('button', { name: 'Delete' }).click();
  await page.locator('[data-testid="form-modal"] .btn-error').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'secondary-pro' })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'primary' })).toBeVisible();
});

test('an empty provider list invites the first provider', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);

  await expect(page.getByText('No providers found.')).toBeVisible();
  await expect(page.locator('#providers-page-create-first-btn')).toBeVisible();
});

/** The dialog's legend for a field, so its asterisk can be inspected. */
function legend(page: Page, field: string) {
  return page.locator(`label.fieldset:has(#provider-${field}) .fieldset-legend`);
}

test('the optional fields wait behind an advanced-options disclosure', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);
  await page.locator('#providers-page-create-btn').click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();

  const advanced = page.locator('#provider-advanced');
  await expect(advanced).toBeVisible();
  await expect(advanced.locator('summary')).toHaveText('Advanced options');

  // Only the required fields, plus the optional `name`, are on screen when the
  // dialog opens.
  await expect(page.locator('#provider-name')).toBeVisible();
  await expect(page.locator('#provider-model_name')).toBeVisible();
  await expect(page.locator('#provider-temperature')).toBeHidden();
  await expect(page.locator('#provider-thinking')).toBeHidden();

  // Opening it reveals the rest, and they take part in the save.
  await openAdvanced(page);
  await expect(page.locator('#provider-temperature')).toBeVisible();
  await expect(page.locator('#provider-thinking')).toBeVisible();
});

test('the required fields are starred and enforced before the request', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, providers: [primary] });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);
  await page.locator('#providers-page-create-btn').click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();

  // The four fields the API needs carry a red asterisk.
  for (const field of ['model_name', 'api_base', 'api_key', 'priority']) {
    await expect(legend(page, field).locator('span')).toHaveText('*');
    await expect(legend(page, field).locator('span')).toHaveClass(/text-error/);
  }

  // `name` is not one of them: data-cloud stores '' and rqark-core falls back
  // to model_name. It is optional but stays up front, because it is what labels
  // the provider in the list.
  await expect(legend(page, 'name').locator('span')).toHaveCount(0);
  await expect(page.locator('#provider-name')).toBeVisible();

  // The asterisks speak for themselves; no legend line spelling them out.
  await expect(page.locator('[data-testid="form-modal"]')).not.toContainText('Fields marked');

  // Submitting a blank form is refused locally, with no request sent.
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.getByRole('alert')).toContainText('Model is required');
  expect(backend.writes.filter((write) => write.method === 'POST')).toHaveLength(0);

  // Filling only the starred fields is enough, and the list labels the row with
  // model_name because no name was given.
  await page.locator('#provider-model_name').fill('kimi-k3');
  await page.locator('#provider-api_base').fill('https://api.moonshot.cn/v1');
  await page.locator('#provider-api_key').fill('sk-rqark-0001');
  await page.locator('#provider-priority').fill('2');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  // The Name column falls back to model_name, so the row is still labelled.
  const createdRow = page.getByRole('row').filter({ hasText: 'kimi-k3' });
  await expect(createdRow.getByRole('cell').first()).toHaveText('kimi-k3');

  const created = backend.writes.find((write) => write.method === 'POST' && write.path === '/providers');
  expect(created?.body).not.toHaveProperty('name');
  // The select has no empty option: untouched it holds its default, `high`, and
  // that is what gets written.
  expect(created?.body).toMatchObject({ model_name: 'kimi-k3', priority: 2, reasoning_effort: 'high' });
});

test('thinking is a switch, not a text box', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);
  await page.locator('#providers-page-create-btn').click();
  await openAdvanced(page);

  // A text input cannot express the two values the API accepts.
  const thinking = page.locator('#provider-thinking');
  await expect(thinking).toHaveAttribute('type', 'checkbox');
  await expect(thinking).not.toBeChecked();

  await page.locator('#provider-model_name').fill('kimi-k3');
  await page.locator('#provider-api_base').fill('https://api.moonshot.cn/v1');
  await page.locator('#provider-api_key').fill('sk-rqark-0001');
  await page.locator('#provider-priority').fill('1');
  await thinking.check();
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  expect(backend.writes.find((write) => write.method === 'POST' && write.path === '/providers')?.body).toMatchObject({ thinking: 'enabled' });
});

test('reasoning effort is limited to the values the API validates', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, providers: [{ ...primary, reasoning_effort: 'low' }] });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);
  const primaryMenu = await openRowActions(page, page.getByRole('row').filter({ hasText: 'primary' }));
  await primaryMenu.getByRole('button', { name: 'Edit' }).click();
  await openAdvanced(page);

  // A free text box would let the caller send anything, and anything other than
  // low/high/max is a 400. No empty option either: the choices are exactly the
  // values the API validates.
  const effort = page.locator('#provider-reasoning_effort');
  await expect(effort).toBeVisible();
  expect(await effort.evaluate((el) => el.tagName)).toBe('SELECT');
  // The value the provider carries wins over the form's `high` default.
  await expect(effort).toHaveValue('low');
  // textContent, not innerText: the collapse animates its height in, and
  // innerText reads back empty while that transition is still running.
  expect(await effort.locator('option').allTextContents()).toEqual(['low', 'high', 'max']);
  await expect(effort.locator('option[value=""]')).toHaveCount(0);

  await effort.selectOption('max');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  expect(backend.writes.find((write) => write.method === 'PUT' && write.path === '/providers/provider-1')?.body).toMatchObject({ reasoning_effort: 'max' });
});

test('the priority arrows reorder the list by rewriting priority', async ({ page }) => {
  const backend = await mockBackend(page, {
    session: boss,
    providers: [
      { ...primary, id: 'provider-1', name: 'first', priority: 1 },
      { ...primary, id: 'provider-2', name: 'second', priority: 2 },
      { ...primary, id: 'provider-3', name: 'third', priority: 3 },
    ],
  });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);

  const names = page.locator('tbody tr td:first-child');
  await expect(names).toHaveText(['first', 'second', 'third']);

  // The ends of the list have nowhere to move.
  await expect(page.getByRole('row').filter({ hasText: 'first' }).getByRole('button', { name: 'Move up' })).toBeDisabled();
  await expect(page.getByRole('row').filter({ hasText: 'third' }).getByRole('button', { name: 'Move down' })).toBeDisabled();

  // `third` trades places with `second`; only their two priorities are written.
  await page.getByRole('row').filter({ hasText: 'third' }).getByRole('button', { name: 'Move up' }).click();
  await expect(names).toHaveText(['first', 'third', 'second']);

  expect(backend.writes).toContainEqual({ method: 'PUT', path: '/providers/provider-3', body: { priority: 2 } });
  expect(backend.writes).toContainEqual({ method: 'PUT', path: '/providers/provider-2', body: { priority: 3 } });

  // The two moved rows carry the write's instant in Updated; the untouched one
  // keeps the one it was seeded with.
  const updated = (name: string) => page.getByRole('row').filter({ hasText: name }).getByRole('cell').nth(5).innerText();
  expect(await instantOf(await updated('third'))).toBe(new Date(WRITE_TIMESTAMP).getTime());
  expect(await instantOf(await updated('second'))).toBe(new Date(WRITE_TIMESTAMP).getTime());
  expect(await instantOf(await updated('first'))).toBe(new Date('2026-04-06T07:08:09Z').getTime());

  // The new order lives in the data, so it survives a reload.
  await page.reload();
  await waitForShellStyles(page);
  await expect(names).toHaveText(['first', 'third', 'second']);
});

test('the provider table keeps every column on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockBackend(page, { session: boss, providers: [primary] });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);

  // No column is dropped at this width the way `hidden sm:table-cell` used to.
  for (const header of ['Name', 'Model', 'API base', 'Priority', 'Created', 'Updated', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
  }

  const row = page.getByRole('row').filter({ hasText: 'primary' });
  await expect(row.getByRole('cell')).toHaveCount(7);
  // The long API base is shown in full rather than truncated behind an ellipsis.
  await expect(row.getByRole('cell').nth(2)).toHaveText('https://api.deepseek.com/v1');
  await expect(row.getByRole('cell').nth(3)).toHaveText('1');
  await expect(row.getByRole('cell').nth(4)).toHaveText(TIMESTAMP);
  await expect(row.getByRole('cell').nth(5)).toHaveText(TIMESTAMP);

  const scrolls = await page.locator('[data-testid="data-list-panel"] .overflow-x-auto').evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(scrolls).toBe(true);
});

test('a superuser can share a provider with everyone', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, providers: [primary] });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);

  // Nothing is shared yet, so no row carries the badge.
  await expect(page.getByRole('row').filter({ hasText: 'primary' }).getByText('Public')).toHaveCount(0);

  // The share flag is on screen for a superuser, ahead of the disclosure.
  await page.locator('#providers-page-create-btn').click();
  await expect(page.locator('#provider-is_public')).toBeVisible();
  await page.locator('#provider-name').fill('shared');
  await page.locator('#provider-model_name').fill('kimi-k3');
  await page.locator('#provider-api_base').fill('https://api.moonshot.cn/v1');
  await page.locator('#provider-api_key').fill('sk-rqark-0001');
  await page.locator('#provider-priority').fill('2');
  await page.locator('#provider-is_public').check();
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  // The flag reaches the API, which is what makes the provider usable by all.
  expect(backend.writes.find((write) => write.method === 'POST' && write.path === '/providers')?.body).toMatchObject({ is_public: true });
  await expect(page.getByRole('row').filter({ hasText: 'shared' }).getByText('Public')).toBeVisible();
});

test('a shared provider keeps its fields with its owner but stays orderable', async ({ page }) => {
  await mockBackend(page, {
    session: plain,
    providers: [
      { ...primary, id: 'provider-1', name: 'mine', owned: true, priority: 1 },
      { ...primary, id: 'provider-2', name: 'shared', owned: false, is_public: true, priority: 2 },
    ],
  });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);

  // An ordinary user is never offered the share flag: the API answers 403.
  await page.locator('#providers-page-create-btn').click();
  await expect(page.locator('#provider-is_public')).toHaveCount(0);
  await page.locator('[data-testid="form-modal"] .btn-ghost').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  // The fields of a shared provider belong to its owner: the row offers no edit
  // and no delete, and says nothing else about it. Ordering is the viewer's own.
  const shared = page.getByRole('row').filter({ hasText: 'shared' });
  await expect(shared.getByText('Public')).toBeVisible();
  await expect(shared.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(shared.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  // With no edit and no delete there is no menu to open either.
  await expect(shared.getByTestId('row-actions-button')).toHaveCount(0);
  // The owner's priority is not the viewer's: un-ordered, the shared row is
  // served as the unset -99 and leads the list, so only Move down applies.
  await expect(shared.getByRole('button', { name: 'Move down' })).toBeEnabled();
  await expect(page.locator('tbody tr td:first-child')).toHaveText([/shared/, 'mine']);

  // The owner's row keeps its two writes together behind the menu, beside the
  // plain arrows every row keeps for ordering.
  const mine = page.getByRole('row').filter({ hasText: 'mine' });
  await expectRowActions(page, mine, ['Edit', 'Delete']);
});

test('a shared provider takes a typed order through the caller own override', async ({ page }) => {
  const backend = await mockBackend(page, {
    session: plain,
    providers: [
      { ...primary, id: 'provider-1', name: 'mine', owned: true, priority: 1 },
      { ...primary, id: 'provider-2', name: 'shared', owned: false, is_public: true, priority: 2 },
    ],
  });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);

  const names = page.locator('tbody tr td:first-child');
  // Un-ordered, so the shared row is served as the unset -99 and leads the list.
  await expect(names).toHaveText([/shared/, 'mine']);

  // Its fields belong to its owner, so the row offers the number rather than the
  // edit dialog, seeded with the value it applies right now.
  const shared = page.getByRole('row').filter({ hasText: 'shared' });
  await expect(shared.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await shared.getByRole('button', { name: 'Set order' }).click();
  const order = page.locator('#provider-priority');
  await expect(order).toHaveValue('-99');
  await order.fill('7');
  await page.locator('[data-testid="form-modal"]').getByRole('button', { name: 'Save' }).click();

  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  await expect(names).toHaveText(['mine', /shared/]);
  expect(backend.writes).toContainEqual({ method: 'PUT', path: '/providers/provider-2/priority', body: { priority: 7 } });

  // Only the caller's ordering was written: the shared provider's own fields,
  // and the owner's row, were never touched.
  expect(backend.writes.filter((write) => write.path === '/providers/provider-2')).toHaveLength(0);
  expect(backend.writes.filter((write) => write.path === '/providers/provider-1')).toHaveLength(0);
});

test('the order dialog refuses a blank number instead of writing a zero', async ({ page }) => {
  const backend = await mockBackend(page, {
    session: plain,
    providers: [
      { ...primary, id: 'provider-1', name: 'mine', owned: true, priority: 1 },
      { ...primary, id: 'provider-2', name: 'shared', owned: false, is_public: true, priority: 2 },
    ],
  });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);

  await page.getByRole('row').filter({ hasText: 'shared' }).getByRole('button', { name: 'Set order' }).click();
  await page.locator('#provider-priority').fill('');
  await page.locator('[data-testid="form-modal"]').getByRole('button', { name: 'Save' }).click();

  // The dialog stays open and nothing is written: '' is not a priority, and it
  // must not turn into the 0 that `Number('')` would give.
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(1);
  expect(backend.writes.filter((write) => write.path.startsWith('/providers') && write.method !== 'GET')).toHaveLength(0);
});

test('reordering a shared provider writes only the caller own override', async ({ page }) => {
  const backend = await mockBackend(page, {
    session: plain,
    providers: [
      { ...primary, id: 'provider-1', name: 'mine', owned: true, priority: 1 },
      { ...primary, id: 'provider-2', name: 'shared', owned: false, is_public: true, priority: 2 },
    ],
  });
  await seedSession(page);

  await page.goto('/en/manage/providers');
  await waitForShellStyles(page);

  const names = page.locator('tbody tr td:first-child');
  // The shared row's name cell also carries its `Public` badge.
  await expect(names).toHaveText([/shared/, 'mine']);

  // Moving the shared row down trades the two effective priorities: the shared
  // row takes an override of its own, the caller's own row takes the unset -99
  // the shared row was served with. Only the caller's list is written either way.
  await page.getByRole('row').filter({ hasText: 'shared' }).getByRole('button', { name: 'Move down' }).click();
  await expect(names).toHaveText(['mine', /shared/]);

  expect(backend.writes).toContainEqual({ method: 'PUT', path: '/providers/provider-2/priority', body: { priority: 1 } });
  expect(backend.writes).toContainEqual({ method: 'PUT', path: '/providers/provider-1', body: { priority: -99 } });

  // Only the caller's ordering was ever written: the shared provider's own
  // fields were never touched.
  expect(backend.writes.filter((write) => write.path === '/providers/provider-2')).toHaveLength(0);
});
