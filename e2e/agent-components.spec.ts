import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockWrite } from './support/mock-backend';
import { waitForShellStyles } from './support/styles';

/** Opens the create dialog on the agents page. */
async function openAgentForm(page: Page): Promise<void> {
  await page.locator('#agents-page-create-btn').click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();
}

/** Ticks or unticks a catalogue entry by its checkbox id. */
async function setComponent(page: Page, id: string, checked: boolean): Promise<void> {
  await page.locator(`#${id}`).setChecked(checked);
}

/** The body of the first request that wrote to the agents collection. */
function agentWrite(writes: MockWrite[], method: 'POST' | 'PUT'): unknown {
  return writes.find((write) => write.method === method && write.path.startsWith('/agents'))?.body;
}

test('the form puts name, tools and prompts across one row with the description under the name', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/agents');
  await waitForShellStyles(page);
  await openAgentForm(page);

  const boxes = await page.evaluate(() => {
    const box = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) {
        return null;
      }
      const { top, bottom, left, right } = el.getBoundingClientRect();
      return { top: Math.round(top), bottom: Math.round(bottom), left: Math.round(left), right: Math.round(right) };
    };
    return {
      name: box('label.fieldset:has(#agent-name)'),
      description: box('label.fieldset:has(#agent-description)'),
      tools: box('#agent-tools'),
      prompts: box('#agent-prompts'),
    };
  });

  expect(boxes.name).not.toBeNull();
  expect(boxes.description).not.toBeNull();
  expect(boxes.tools).not.toBeNull();
  expect(boxes.prompts).not.toBeNull();
  if (!boxes.name || !boxes.description || !boxes.tools || !boxes.prompts) {
    return;
  }

  // One row: three columns sharing a top edge, in the order name, tools, prompts.
  expect(boxes.tools.top).toBe(boxes.name.top);
  expect(boxes.prompts.top).toBe(boxes.name.top);
  expect(boxes.name.left).toBeLessThan(boxes.tools.left);
  expect(boxes.tools.left).toBeLessThan(boxes.prompts.left);

  // The description sits in the first column, below the name and no wider than it,
  // so it never runs under the tools beside it.
  expect(boxes.description.top).toBeGreaterThanOrEqual(boxes.name.bottom - 1);
  expect(boxes.description.left).toBe(boxes.name.left);
  expect(boxes.description.right).toBe(boxes.name.right);
  expect(boxes.description.right).toBeLessThanOrEqual(boxes.tools.left);
});

test('the description fills the name column, up to a cap', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/agents');
  await waitForShellStyles(page);
  await openAgentForm(page);

  const read = () =>
    page.evaluate(() => {
      const nameEl = document.querySelector('label.fieldset:has(#agent-name)') as HTMLElement;
      const col = nameEl.parentElement as HTMLElement;
      const desc = document.querySelector('label.fieldset:has(#agent-description)') as HTMLElement;
      const textarea = document.querySelector('#agent-description') as HTMLElement;
      return {
        colBottom: Math.round(col.getBoundingClientRect().bottom),
        descBottom: Math.round(desc.getBoundingClientRect().bottom),
        textareaHeight: Math.round(textarea.getBoundingClientRect().height),
      };
    });

  // A short tools list leaves height in the column, and the description takes it,
  // so the column ends with the description rather than with blank space.
  const light = await read();
  expect(light.colBottom - light.descBottom).toBeLessThanOrEqual(2);

  // A long list would stretch a one line description past the dialog, so it stops.
  await setComponent(page, 'agent-tools-SubAgent', true);
  const heavy = await read();
  expect(heavy.textareaHeight).toBeGreaterThan(light.textareaHeight);
  expect(heavy.textareaHeight).toBeLessThanOrEqual(260);
  expect(heavy.descBottom).toBeLessThan(heavy.colBottom - 100);
});

test('the form offers every tool and prompt the engine registers', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/agents');
  await waitForShellStyles(page);
  await openAgentForm(page);

  const tools = page.locator('#agent-tools [data-testid="agent-component-toggle"]');
  const prompts = page.locator('#agent-prompts [data-testid="agent-component-toggle"]');

  // rqark-core registers 13 usable tools (BaseGitTool is abstract) and 9 prompts.
  await expect(tools).toHaveCount(13);
  await expect(prompts).toHaveCount(9);

  // Spot-check the three shapes the catalogue has to get right.
  await expect(page.locator('#agent-tools-SubAgent')).toBeVisible();
  await expect(page.locator('#agent-prompts-DateTimePrompt')).toBeVisible();
  await expect(page.locator('#agent-tools-Gitea')).toBeVisible();
});

test('ticking an entry reveals only the params that entry takes', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/agents');
  await waitForShellStyles(page);
  await openAgentForm(page);

  // A tool with no constructor arguments exposes nothing to fill in.
  await setComponent(page, 'agent-tools-ReadFile', true);
  await expect(page.locator('#agent-tools-ReadFile-token')).toHaveCount(0);

  // The git tools expose exactly token, base_url and username.
  await setComponent(page, 'agent-tools-Gitea', true);
  await expect(page.locator('#agent-tools-Gitea-token')).toHaveAttribute('type', 'password');
  await expect(page.locator('#agent-tools-Gitea-base_url')).toBeVisible();
  await expect(page.locator('#agent-tools-Gitea-username')).toBeVisible();

  // Unticking removes it again.
  await setComponent(page, 'agent-tools-Gitea', false);
  await expect(page.locator('#agent-tools-Gitea-base_url')).toHaveCount(0);
});

test('a prompt param is prefilled with the default the engine would have used', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/agents');
  await waitForShellStyles(page);
  await openAgentForm(page);

  await setComponent(page, 'agent-prompts-RolePrompt', true);
  await expect(page.locator('#agent-prompts-RolePrompt-agent_name')).toHaveValue('Red Queen Ark');
  await expect(page.locator('#agent-prompts-RolePrompt-user_name')).toHaveValue('Sir');

  await setComponent(page, 'agent-prompts-DateTimePrompt', true);
  await expect(page.locator('#agent-prompts-DateTimePrompt-timezone_name')).toHaveValue('Asia/Hong_Kong');
});

test('the payload matches the config format rqark-app reads', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/agents');
  await waitForShellStyles(page);
  await openAgentForm(page);

  await page.locator('#agent-name').fill('Diana');
  await page.locator('#agent-description').fill('Right hand');

  await setComponent(page, 'agent-tools-ReadFile', true);
  await setComponent(page, 'agent-tools-Gitea', true);
  await page.locator('#agent-tools-Gitea-username').fill('diana');
  await setComponent(page, 'agent-prompts-RolePrompt', true);
  await page.locator('#agent-prompts-RolePrompt-agent_name').fill('Diana');

  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  // ReadFile takes no constructor arguments, so it carries no params key at all,
  // and the git tool drops the empty token and base_url rather than writing ''.
  expect(agentWrite(backend.writes, 'POST')).toEqual({
    name: 'Diana',
    description: 'Right hand',
    tools: [{ name: 'ReadFile' }, { name: 'Gitea', params: { username: 'diana' } }],
    prompts: [{ name: 'RolePrompt', params: { agent_name: 'Diana', user_name: 'Sir' } }],
  });
});

test('a subagent nests its own prompts and tools', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/agents');
  await waitForShellStyles(page);
  await openAgentForm(page);

  await page.locator('#agent-name').fill('Diana');
  await setComponent(page, 'agent-tools-SubAgent', true);

  // The nested lists use their own namespaced ids, so the parent's checkboxes
  // and the child's cannot collide.
  await expect(page.locator('#agent-tools-SubAgent-prompts-RolePrompt')).toBeVisible();
  await expect(page.locator('#agent-tools-SubAgent-tools-WebSearch')).toBeVisible();

  await setComponent(page, 'agent-tools-SubAgent-tools-WebSearch', true);
  await setComponent(page, 'agent-tools-SubAgent-prompts-DateTimePrompt', true);

  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  expect(agentWrite(backend.writes, 'POST')).toEqual({
    name: 'Diana',
    description: '',
    tools: [
      {
        name: 'SubAgent',
        params: {
          prompts: [{ name: 'DateTimePrompt', params: { timezone_name: 'Asia/Hong_Kong' } }],
          tools: [{ name: 'WebSearch' }],
        },
      },
    ],
    prompts: [],
  });
});

test('an edit round-trips the tools and prompts already on the agent', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    agents: [
      {
        id: 'agent-1',
        name: 'Diana',
        description: '',
        created_at: '2026-04-05T06:07:08Z',
        tools: [{ name: 'ReadFile' }, { name: 'SubAgent', params: { prompts: [], tools: [{ name: 'Grep' }] } }],
        prompts: [{ name: 'CharacterPrompt', params: { identity: 'Diana', personality: 'Direct' } }],
      },
    ],
  });
  await seedSession(page);
  await page.goto('/en/agents');
  await waitForShellStyles(page);

  await page.getByRole('row').filter({ hasText: 'Diana' }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();

  // The stored selections are ticked, params included, down to the nested level.
  await expect(page.locator('#agent-tools-ReadFile')).toBeChecked();
  await expect(page.locator('#agent-tools-WebSearch')).not.toBeChecked();
  await expect(page.locator('#agent-prompts-CharacterPrompt-identity')).toHaveValue('Diana');
  await expect(page.locator('#agent-tools-SubAgent-tools-Grep')).toBeChecked();
  await expect(page.locator('#agent-tools-SubAgent-tools-ReadFile')).not.toBeChecked();
});

test('an entry this build does not know is kept instead of being dropped', async ({ page }) => {
  const backend = await mockBackend(page, {
    session: boss,
    agents: [
      {
        id: 'agent-1',
        name: 'Diana',
        description: '',
        created_at: '2026-04-05T06:07:08Z',
        tools: [{ name: 'FutureTool', params: { mode: 'fast' } }],
        prompts: [],
      },
    ],
  });
  await seedSession(page);
  await page.goto('/en/agents');
  await waitForShellStyles(page);

  await page.getByRole('row').filter({ hasText: 'Diana' }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();

  await expect(page.locator('#agent-tools-FutureTool')).toBeChecked();
  await expect(page.locator('text=Not in this build')).toBeVisible();

  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  // Saved back untouched, params and all.
  expect(agentWrite(backend.writes, 'PUT')).toEqual({
    name: 'Diana',
    description: '',
    tools: [{ name: 'FutureTool', params: { mode: 'fast' } }],
    prompts: [],
  });
});
