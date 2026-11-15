import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockSop } from '../support/mock-backend';
import { openRowActions } from '../support/row-actions';

const sops: MockSop[] = [
  { slug: 'trip-itinerary', title: 'Trip itinerary', content: '# Trip itinerary\n\nPlan the trip day by day.', created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-02T00:00:00Z' },
  { slug: 'weekly-review', title: 'Weekly review', content: '# Weekly review\n\nGo through the week.', created_at: '2026-04-03T00:00:00Z', updated_at: '2026-04-04T00:00:00Z' },
];

async function openSops(page: Parameters<typeof seedSession>[0], seeded: MockSop[] = sops) {
  const backend = await mockBackend(page, { session: boss, sops: seeded });
  await seedSession(page);
  await page.goto('/en/manage/sops');
  return backend;
}

test('the sop page lists every sop by slug', async ({ page }) => {
  await openSops(page);

  await expect(page.getByTestId('sop-row-trip-itinerary')).toBeVisible();
  await expect(page.getByTestId('sop-row-weekly-review')).toBeVisible();
  await expect(page.getByTestId('sop-slug-trip-itinerary')).toHaveText('trip-itinerary');
});

test('creating a sop posts the slug and the body', async ({ page }) => {
  const backend = await openSops(page, []);

  await page.locator('#sops-empty-create').click();
  await page.getByTestId('sop-slug-input').fill('trip-itinerary');
  await page.getByTestId('sop-content-input').fill('# Trip itinerary\n\nPlan it.');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByTestId('sop-row-trip-itinerary')).toBeVisible();
  const writes = backend.writes.filter((write) => write.method === 'POST' && write.path === '/sops');
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({ slug: 'trip-itinerary', content: '# Trip itinerary\n\nPlan it.' });
});

test('the character counter follows the body and blocks an over-long one', async ({ page }) => {
  const backend = await openSops(page, []);

  await page.locator('#sops-empty-create').click();
  await page.getByTestId('sop-slug-input').fill('too-long');
  await page.getByTestId('sop-content-input').fill('字'.repeat(2001));

  await expect(page.getByTestId('sop-char-count')).toContainText('2001 / 2000');
  await page.getByRole('button', { name: 'Save' }).click();

  expect(backend.writes.filter((write) => write.method === 'POST' && write.path === '/sops')).toHaveLength(0);
});

test('editing a sop patches only its body', async ({ page }) => {
  const backend = await openSops(page);

  const menu = await openRowActions(page, page.getByTestId('sop-row-trip-itinerary'));
  await menu.getByTestId('sop-edit-trip-itinerary').click();
  await page.getByTestId('sop-content-input').fill('# Trip itinerary\n\nDay 1: Osaka.');
  await page.getByRole('button', { name: 'Save' }).click();

  const writes = backend.writes.filter((write) => write.method === 'PATCH' && write.path === '/sops/trip-itinerary');
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({ content: '# Trip itinerary\n\nDay 1: Osaka.' });
});

test('deleting a sop removes it from the list', async ({ page }) => {
  await openSops(page);

  const menu = await openRowActions(page, page.getByTestId('sop-row-weekly-review'));
  await menu.getByTestId('sop-delete-weekly-review').click();
  await page.getByRole('button', { name: 'Delete' }).last().click();

  await expect(page.getByTestId('sop-row-weekly-review')).toHaveCount(0);
  await expect(page.getByTestId('sop-row-trip-itinerary')).toBeVisible();
});
