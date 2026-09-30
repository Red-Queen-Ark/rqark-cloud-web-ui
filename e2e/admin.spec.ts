import { expect, test } from '@playwright/test';
import { boss, mockBackend, plain, seedSession, type MockSession } from './support/mock-backend';
import { waitForShellStyles } from './support/styles';

test('a plain account does not see the admin entries', async ({ page }) => {
  await mockBackend(page, { session: plain });
  await seedSession(page);
  await page.goto('/en');

  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Groups' })).toHaveCount(0);
});

test('a plain account is kept out of an admin page by URL', async ({ page }) => {
  await mockBackend(page, { session: plain });
  await seedSession(page);
  await page.goto('/en/groups');

  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByText('You do not have permission to perform this action.')).toBeVisible();
});

test('a superuser creates a group and adds a member to it', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/groups');

  await page.locator('#groups-page-create-btn').click();
  await page.fill('#group-name', 'engineering');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('cell', { name: 'engineering' })).toBeVisible();

  await page.getByRole('button', { name: 'Members' }).click();
  await page.fill('#member-search', 'newcomer');

  const groupId = backend.groups[0].id;
  await page.getByRole('button', { name: /newcomer/ }).click();

  await expect(page.locator('.modal-box li', { hasText: 'newcomer' })).toBeVisible();
  expect(backend.groups[0].memberIds).toEqual(['33333333-3333-4333-8333-333333333333']);
  expect(backend.requests).toContain(`PUT /groups/${groupId}/users/33333333-3333-4333-8333-333333333333`);
});

test('a superuser renames and deletes a group', async ({ page }) => {
  const backend = await mockBackend(page, {
    session: boss,
    groups: [{ id: 'group-1', name: 'engineering', created_at: '2026-04-05T06:07:08Z', memberIds: [] }],
  });
  await seedSession(page);
  await page.goto('/en/groups');

  await expect(page.getByRole('cell', { name: 'engineering' })).toBeVisible();

  await page.getByRole('button', { name: 'Rename' }).click();
  await page.fill('#group-name', 'platform');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('cell', { name: 'platform' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete' }).click();
  await page.locator('.modal-box').getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('No groups found.')).toBeVisible();
  expect(backend.groups).toHaveLength(0);
});

const sampleAgents = [
  { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-04-05T06:07:08Z' },
  { id: 'agent-2', name: 'writer', description: '', created_at: '2026-04-05T06:07:08Z' },
];

const sampleProviders = [
  { id: 'provider-1', name: 'deepseek', created_at: '2026-04-05T06:07:08Z' },
  { id: 'provider-2', name: 'openai', created_at: '2026-04-05T06:07:08Z' },
  { id: 'provider-3', name: 'anthropic', created_at: '2026-04-05T06:07:08Z' },
];

const sampleSessions: MockSession[] = [
  { id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', title: 'Ship the dashboard', created_at: '2026-04-05T06:07:08Z' },
  { id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', title: 'Write the docs', created_at: '2026-04-06T06:07:08Z' },
];

test('the dashboard counts the agents, providers and sessions the account holds', async ({ page }) => {
  await mockBackend(page, { session: boss, agents: sampleAgents, providers: sampleProviders, sessions: sampleSessions });
  await seedSession(page);
  await page.goto('/en');

  await expect(page.getByText('Welcome back, Boss!')).toBeVisible();
  const values = page.locator('.stat-value');
  await expect(values).toHaveCount(3);
  await expect(values.nth(0)).toHaveText('2');
  await expect(values.nth(1)).toHaveText('3');
  await expect(values.nth(2)).toHaveText('2');
});

test('a plain account sees the session counter only', async ({ page }) => {
  await mockBackend(page, { session: plain, sessions: sampleSessions });
  await seedSession(page);
  await page.goto('/en');

  // Sessions belong to the caller, so the counter is theirs to see; the admin
  // counters stay superuser-only.
  const titles = page.locator('.stat-title');
  await expect(titles).toHaveCount(1);
  await expect(titles).toHaveText('Sessions');
  await expect(page.locator('.stat-value')).toHaveText('2');
});

test('the session counter reads zero when the account holds no session', async ({ page }) => {
  await mockBackend(page, { session: plain });
  await seedSession(page);
  await page.goto('/en');

  await expect(page.locator('.stat-value')).toHaveText('0');
});

test('the dashboard stacks its counters one per row', async ({ page }) => {
  await mockBackend(page, { session: boss, agents: sampleAgents, providers: sampleProviders, sessions: sampleSessions });
  await seedSession(page);
  await page.goto('/en');

  const cards = page.locator('.stat');
  await expect(cards).toHaveCount(3);
  const [first, second, third] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox(), cards.nth(2).boundingBox()]);
  if (!first || !second || !third) {
    throw new Error('the dashboard counters are not rendered');
  }
  expect(second.y).toBeGreaterThan(first.y);
  expect(third.y).toBeGreaterThan(second.y);
  for (const box of [second, third]) {
    expect(Math.abs(box.x - first.x)).toBeLessThan(1);
    expect(Math.abs(box.width - first.width)).toBeLessThan(1);
  }
});

test('every dashboard counter uses the primary colour, not a lighter token', async ({ page }) => {
  await mockBackend(page, { session: boss, agents: sampleAgents, providers: sampleProviders, sessions: sampleSessions });
  await seedSession(page);
  await page.goto('/en');
  await waitForShellStyles(page);

  // Primary is resolved through a probe so the assertion tracks whatever the
  // active theme defines instead of a hardcoded hex.
  const { primary, rendered } = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();

    return {
      primary: resolved,
      rendered: [...document.querySelectorAll('.stat .stat-figure, .stat .stat-value')].map((el) => getComputedStyle(el).color),
    };
  });

  // One figure and one value per counter: agents, providers, sessions.
  expect(rendered).toEqual(Array.from({ length: 6 }, () => primary));
});
