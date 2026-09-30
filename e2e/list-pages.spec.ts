import { expect, test, type Page } from '@playwright/test';
import type { MockAgent, MockApiKey, MockGroup, MockProvider, MockSession, MockUser } from './support/mock-backend';
import { boss, mockBackend, seedSession } from './support/mock-backend';
import { waitForShellStyles } from './support/styles';
import { expectRowActionsReachable } from './support/table';

interface ListPageLayout {
  toolbarClasses: string;
  actionsClasses: string;
  panelClasses: string;
  tableClasses: string;
  columnsAlignRight: number;
  createButtonRight: number;
  panelRight: number;
  tableTopGap: number;
  pagination: string | null;
}

/** Reads the shape of a list page: the shared regions and how they line up. */
async function readLayout(page: Page): Promise<ListPageLayout> {
  return page.evaluate(() => {
    const cls = (el: Element | null) => (el ? Array.from(el.classList).sort().join(' ') : '');
    const toolbar = document.querySelector('[data-testid="data-toolbar"]');
    const actions = document.querySelector('[data-testid="data-toolbar-actions"]');
    const panel = document.querySelector('[data-testid="data-list-panel"]');
    const table = panel?.querySelector('table');
    const headerCells = Array.from(table?.querySelectorAll('thead th') ?? []);
    const createButton = actions?.querySelector('button');
    const pagination = panel?.querySelector('.join');
    const panelBox = panel?.getBoundingClientRect();

    return {
      toolbarClasses: cls(toolbar),
      actionsClasses: cls(actions),
      panelClasses: cls(panel),
      tableClasses: cls(table),
      columnsAlignRight: headerCells.filter((cell) => cell.classList.contains('text-right')).length,
      createButtonRight: createButton ? Math.round(createButton.getBoundingClientRect().right) : -1,
      panelRight: panelBox ? Math.round(panelBox.right) : -1,
      tableTopGap: table && toolbar ? Math.round(table.getBoundingClientRect().top - toolbar.getBoundingClientRect().bottom) : -1,
      pagination: pagination ? cls(pagination.querySelector('button')) : null,
    };
  });
}

test('the users and groups pages share one layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockBackend(page, {
    session: boss,
    // Enough rows on both pages to render the pagination footer.
    groups: Array.from({ length: 25 }, (_, index) => ({
      id: `group-${index}`,
      name: `group${index}`,
      created_at: '2026-04-05T06:07:08Z',
      memberIds: [],
    })),
    users: Array.from({ length: 25 }, (_, index) => ({
      id: `user-${index}`,
      username: `user${index}`,
      email: `user${index}@example.com`,
      display_name: `User ${index}`,
      is_active: true,
      is_staff: false,
      is_superuser: false,
      created_at: '2026-04-05T06:07:08Z',
    })),
  });
  await seedSession(page);

  await page.goto('/en/users');
  await waitForShellStyles(page);
  await expect(page.getByRole('cell', { name: 'user0@example.com' })).toBeVisible();
  const users = await readLayout(page);

  await page.goto('/en/groups');
  await waitForShellStyles(page);
  await expect(page.getByRole('cell', { name: 'group0' })).toBeVisible();
  const groups = await readLayout(page);

  // Same shared regions, in the same order, with the same classes.
  expect(users.toolbarClasses).toBe(groups.toolbarClasses);
  expect(users.actionsClasses).toBe(groups.actionsClasses);
  expect(users.panelClasses).toBe(groups.panelClasses);
  expect(users.tableClasses).toBe(groups.tableClasses);

  // The primary action lines up with the panel edge on both pages.
  expect(users.createButtonRight).toBe(users.panelRight);
  expect(groups.createButtonRight).toBe(groups.panelRight);

  // Same gap between the toolbar and the list surface.
  expect(users.tableTopGap).toBe(groups.tableTopGap);

  // Same pagination footer on both pages.
  expect(users.pagination).not.toBeNull();
  expect(users.pagination).toBe(groups.pagination);
});

test('the dialogs on both pages share one shell', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockBackend(page, {
    session: boss,
    groups: [{ id: 'group-1', name: 'engineering', created_at: '2026-04-05T06:07:08Z', memberIds: [] }],
  });
  await seedSession(page);

  const readDialog = () =>
    page.evaluate(() => {
      const box = document.querySelector('[data-testid="form-modal-box"]');
      if (!box) {
        return null;
      }
      const cls = (el: Element | null) => (el ? Array.from(el.classList).sort().join(' ') : '');
      const fields = box.querySelector('.space-y-3');
      const actions = box.querySelector('.modal-action');
      return {
        boxClasses: cls(box),
        fieldsClasses: cls(fields),
        fieldCount: fields?.children.length ?? 0,
        actionsClasses: cls(actions),
        actionButtons: Array.from(actions?.querySelectorAll('button') ?? []).map((button) => cls(button)),
      };
    });

  await page.goto('/en/users');
  await waitForShellStyles(page);
  await page.locator('#users-page-create-btn').click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();
  const usersDialog = await readDialog();

  await page.locator('[data-testid="form-modal-box"] .btn-ghost').click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toHaveCount(0);

  await page.goto('/en/groups');
  await waitForShellStyles(page);
  await page.locator('#groups-page-create-btn').click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();
  const groupsDialog = await readDialog();

  expect(usersDialog).not.toBeNull();
  expect(groupsDialog).not.toBeNull();
  expect(usersDialog?.boxClasses).toBe(groupsDialog?.boxClasses);
  expect(usersDialog?.fieldsClasses).toBe(groupsDialog?.fieldsClasses);
  expect(usersDialog?.actionsClasses).toBe(groupsDialog?.actionsClasses);
  expect(usersDialog?.actionButtons).toEqual(groupsDialog?.actionButtons);
  expect(usersDialog?.fieldCount).toBe(5);
  expect(groupsDialog?.fieldCount).toBe(1);
});

/**
 * Rows wide enough that every list page's table outgrows its panel, so the
 * actions column would trail the last column and scroll out of reach.
 *
 * The values are single unbroken tokens on purpose: only the agents and
 * providers tables set `whitespace-nowrap`, so anywhere else a hyphenated or
 * spaced value would wrap and the row would stay narrower than the panel. The
 * dates are the one timestamp shape the mock backend and the UI agree on.
 */
const wideAgents: MockAgent[] = [
  {
    id: 'agent-1',
    name: 'customer-support-triage-and-escalation-agent',
    description: 'Routes inbound tickets to the right specialist queue.',
    created_at: '2026-04-05T06:07:08Z',
    updated_at: '2026-04-06T07:08:09Z',
    tools: [{ name: 'ReadFile' }, { name: 'WebSearch' }],
    prompts: [{ name: 'RolePrompt' }],
  },
];

const wideUsers: MockUser[] = [
  {
    id: 'user-1',
    username: 'alexandramontgomerysmith',
    email: 'alexandramontgomerysmith@examplecorporationinternational.com',
    display_name: 'Alexandra Montgomery-Smith',
    is_active: true,
    is_staff: true,
    is_superuser: true,
    created_at: '2026-04-05T06:07:08Z',
  },
];

const wideGroups: MockGroup[] = [
  {
    id: 'group-1',
    name: 'platformobservabilityandreliabilityengineeringandincidentresponse',
    created_at: '2026-04-05T06:07:08Z',
    memberIds: [],
  },
];

const wideProviders: MockProvider[] = [
  {
    id: 'provider-1',
    name: 'openai-eu-west',
    model_name: 'gpt-4o-mini-2024-07-18-preview',
    api_base: 'https://gateway.internal.example-corporation.com/openai/v1',
    priority: 0,
    created_at: '2026-04-05T06:07:08Z',
    updated_at: '2026-04-06T07:08:09Z',
  },
];

const wideApiKeys: MockApiKey[] = [
  {
    id: '4d1f6a3c9b274e588c0a1f2e3d4c5b6a',
    name: 'cideploypipelineproductioncanaryrollout',
    key_prefix: 'rqark8f2c914d1f6a3c9b274e58',
    is_active: true,
    expires_at: null,
    last_used_at: '2026-04-06T07:08:09Z',
    revoked_at: null,
    revoked_message: null,
    created_at: '2026-04-05T06:07:08Z',
  },
];

const wideSessions: MockSession[] = [
  {
    id: 'session-1',
    title: 'refactorsessionlistingpagewithpinnedrowactionsandplanitemcounts',
    created_at: '2026-04-05T06:07:08Z',
    updated_at: '2026-04-06T07:08:09Z',
    plan_items: [{ id: 'p1', content: 'Plan the work', status: 'pending' }],
  },
];

const listPages = [
  { label: 'agents', path: '/en/agents' },
  { label: 'sessions', path: '/en/sessions' },
  { label: 'users', path: '/en/users' },
  { label: 'groups', path: '/en/groups' },
  { label: 'providers', path: '/en/providers' },
  { label: 'API keys', path: '/en/api-keys' },
];

/**
 * `lg` is where the sidebar stops being an overlay and becomes a permanent
 * 18rem column, so the panel suddenly loses that width; 420 is where the
 * responsive columns drop out. Both are places the row outgrows the panel.
 */
const narrowWidths = [1024, 420];

for (const { label, path } of listPages) {
  test(`the ${label} table keeps its row actions on screen when a row is wider than the panel`, async ({ page }) => {
    for (const width of narrowWidths) {
      await page.setViewportSize({ width, height: 800 });
      await mockBackend(page, {
        session: boss,
        agents: wideAgents,
        users: wideUsers,
        groups: wideGroups,
        providers: wideProviders,
        apiKeys: wideApiKeys,
        sessions: wideSessions,
      });
      await seedSession(page);

      await page.goto(path);
      await waitForShellStyles(page);
      await expect(page.locator('tbody tr').first()).toBeVisible();

      await expectRowActionsReachable(page, `${label} at ${width}px`);
    }
  });
}
