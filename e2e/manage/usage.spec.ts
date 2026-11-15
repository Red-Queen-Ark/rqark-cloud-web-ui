import { expect, test } from '@playwright/test';
import { boss, mockBackend, plain, seedSession, type MockApiKey, type MockUsageLog } from '../support/mock-backend';
import { waitForShellStyles } from '../support/styles';

const laptopKey: MockApiKey = {
  id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  name: 'laptop',
  key_prefix: 'rqark-la7k2m',
  is_active: true,
  expires_at: null,
  last_used_at: null,
  revoked_at: null,
  revoked_message: null,
  created_at: '2026-04-05T06:07:08Z',
};

function localNoon(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

const bossRows: MockUsageLog[] = [
  { created_at: localNoon(1), prompt_tokens: 1000, completion_tokens: 200, api_key_name: 'laptop', user_id: boss.id },
  { created_at: localNoon(1), prompt_tokens: 500, completion_tokens: 100, api_key_name: 'phone', user_id: boss.id },
  { created_at: localNoon(2), prompt_tokens: 300, completion_tokens: 50, api_key_name: 'laptop', user_id: boss.id },
];

test('sums the tokens and requests of the selected range', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockBackend(page, { session: boss, apiKeys: [laptopKey], usage: bossRows });
  await seedSession(page);

  await page.goto('/en/manage/usage');
  await waitForShellStyles(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Usage');
  await expect(page.getByTestId('usage-total-tokens')).toHaveText('2,150');
  await expect(page.getByTestId('usage-requests')).toHaveText('3');
  await expect(page.getByTestId('usage-prompt-tokens')).toHaveText('1,800');
  await expect(page.getByTestId('usage-completion-tokens')).toHaveText('350');
  await expect(page.getByTestId('usage-chart')).toBeVisible();

  const painted = await page.getByTestId('usage-chart').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) {
      return 0;
    }
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let filled = 0;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 0) {
        filled += 1;
      }
    }
    return filled;
  });
  expect(painted).toBeGreaterThan(1000);
});

test('the API key filter narrows the totals', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockBackend(page, { session: boss, apiKeys: [laptopKey], usage: bossRows });
  await seedSession(page);

  await page.goto('/en/manage/usage');
  await waitForShellStyles(page);

  await page.getByTestId('usage-api-key').selectOption('laptop');

  await expect(page.getByTestId('usage-total-tokens')).toHaveText('1,550');
  await expect(page.getByTestId('usage-requests')).toHaveText('2');

  await page.getByTestId('usage-clear').click();

  await expect(page.getByTestId('usage-total-tokens')).toHaveText('2,150');
  await expect(page.getByTestId('usage-api-key')).toHaveValue('');
});

test('the user filter is only offered to a superuser and defaults to the caller', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockBackend(page, { session: boss, apiKeys: [laptopKey], usage: bossRows });
  await seedSession(page);

  await page.goto('/en/manage/usage');
  await waitForShellStyles(page);

  await expect(page.getByTestId('usage-user')).toHaveValue(boss.id);
  await expect(page.getByTestId('usage-user').locator('option', { hasText: 'Plain User' })).toHaveCount(1);
});

test('a plain account gets no user filter and sees only its own rows', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockBackend(page, {
    session: plain,
    usage: [...bossRows, { created_at: localNoon(1), prompt_tokens: 40, completion_tokens: 2, user_id: plain.id }],
  });
  await seedSession(page);

  await page.goto('/en/manage/usage');
  await waitForShellStyles(page);

  await expect(page.getByTestId('usage-user')).toHaveCount(0);
  await expect(page.getByTestId('usage-total-tokens')).toHaveText('42');
  await expect(page.getByTestId('usage-requests')).toHaveText('1');
});

test('a custom range with the start after the end is refused rather than queried', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const backend = await mockBackend(page, { session: boss, apiKeys: [laptopKey], usage: bossRows });
  await seedSession(page);

  await page.goto('/en/manage/usage');
  await waitForShellStyles(page);

  await page.getByTestId('usage-range').selectOption('custom');
  await page.getByTestId('usage-from').fill('2026-11-10');
  await page.getByTestId('usage-to').fill('2026-11-01');

  await expect(page.getByTestId('usage-range-error')).toBeVisible();
  expect(backend.writes.filter((write) => write.path === '/usage' && (write.body?.from as string | undefined)?.startsWith('2026-11-10'))).toHaveLength(0);
});

test('an empty range says so instead of drawing an empty chart', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockBackend(page, { session: boss });
  await seedSession(page);

  await page.goto('/en/manage/usage');
  await waitForShellStyles(page);

  await expect(page.getByTestId('usage-empty')).toBeVisible();
  await expect(page.getByTestId('usage-chart')).toHaveCount(0);
});
