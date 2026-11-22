import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession } from './support/mock-backend';
import { mockWorkspaceApi } from './support/mock-workspace';

async function openWorkspace(page: import('@playwright/test').Page, path = '') {
  await mockBackend(page, { session: boss });
  await mockWorkspaceApi(page);
  await seedSession(page);
  await page.goto(path ? `/en/workspace?path=${encodeURIComponent(path)}` : '/en/workspace');
}

test('lists the sandbox root and hides dotfiles until asked', async ({ page }) => {
  await openWorkspace(page);

  await expect(page.getByTestId('workspace-row-notes.md')).toBeVisible();
  await expect(page.getByTestId('workspace-row-docs')).toBeVisible();
  await expect(page.getByTestId('workspace-row-.env')).toHaveCount(0);

  await page.getByTestId('workspace-toggle-hidden').click();

  await expect(page.getByTestId('workspace-row-.env')).toBeVisible();
  await expect(page.getByTestId('workspace-row-.env')).toContainText('Sensitive');
});

test('navigates into a folder and back through the breadcrumb', async ({ page }) => {
  await openWorkspace(page);

  await page.getByTestId('workspace-row-docs').getByRole('button', { name: 'docs' }).click();

  await expect(page.getByTestId('workspace-row-plan.txt')).toBeVisible();
  await expect(page).toHaveURL(/path=docs/);
  await expect(page.getByTestId('workspace-breadcrumb-docs')).toBeVisible();

  await page.getByTestId('workspace-breadcrumb-root').click();

  await expect(page.getByTestId('workspace-row-notes.md')).toBeVisible();
  await expect(page).not.toHaveURL(/path=/);
});

test('search narrows the current folder', async ({ page }) => {
  await openWorkspace(page);

  await page.getByTestId('workspace-search').fill('note');

  await expect(page.getByTestId('workspace-row-notes.md')).toBeVisible();
  await expect(page.getByTestId('workspace-row-docs')).toHaveCount(0);
});

test('creates a folder in the current directory', async ({ page }) => {
  await openWorkspace(page);

  await page.getByTestId('workspace-new-folder').click();
  await page.getByTestId('workspace-item-name').fill('reports');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Create' }).click();

  await expect(page.getByTestId('workspace-row-reports')).toBeVisible();
});

test('renames an entry', async ({ page }) => {
  await openWorkspace(page);
  const row = page.getByTestId('workspace-row-notes.md');

  await row.getByTestId('workspace-entry-menu-button').click();
  await row.getByTestId('workspace-entry-rename').click();
  await page.getByTestId('workspace-item-name').fill('docs/renamed.md');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Rename or move' }).click();

  await expect(page.getByTestId('workspace-row-notes.md')).toHaveCount(0);
});

test('deletes an entry after confirming', async ({ page }) => {
  await openWorkspace(page);
  const row = page.getByTestId('workspace-row-notes.md');

  await row.getByTestId('workspace-entry-menu-button').click();
  await row.getByTestId('workspace-entry-delete').click();
  await page.getByTestId('form-modal').getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByTestId('workspace-row-notes.md')).toHaveCount(0);
  await expect(page.getByTestId('workspace-row-docs')).toBeVisible();
});

test('previews markdown and saves an edit', async ({ page }) => {
  await openWorkspace(page);

  await page.getByTestId('workspace-row-notes.md').getByRole('button', { name: 'notes.md' }).click();

  await expect(page.getByTestId('workspace-preview-name')).toHaveText('notes.md');
  await expect(page.getByTestId('workspace-preview').locator('.markdown-body')).toContainText('Notes');

  await page.getByTestId('workspace-preview-edit').click();
  await page.getByTestId('workspace-preview-editor').fill('# Edited\n');
  await page.getByTestId('workspace-preview-save').click();

  await expect(page.getByTestId('workspace-preview').locator('.markdown-body')).toContainText('Edited');
});

test('saves the same file twice without a precondition failure', async ({ page }) => {
  await openWorkspace(page);

  await page.getByTestId('workspace-row-notes.md').getByRole('button', { name: 'notes.md' }).click();
  await page.getByTestId('workspace-preview-edit').click();
  await page.getByTestId('workspace-preview-editor').fill('# First\n');
  await page.getByTestId('workspace-preview-save').click();
  await expect(page.getByTestId('workspace-preview').locator('.markdown-body')).toContainText('First');

  await page.getByTestId('workspace-preview-edit').click();
  await page.getByTestId('workspace-preview-editor').fill('# Second\n');
  await page.getByTestId('workspace-preview-save').click();

  await expect(page.getByTestId('workspace-preview').locator('.markdown-body')).toContainText('Second');
});

test('does not preview a sensitive file', async ({ page }) => {
  await openWorkspace(page);
  await page.getByTestId('workspace-toggle-hidden').click();

  await page.getByTestId('workspace-row-.env').getByRole('button', { name: '.env' }).click();

  await expect(page.getByTestId('workspace-preview-sensitive')).toBeVisible();
  await expect(page.getByTestId('workspace-preview-text')).toHaveCount(0);
});

test('uploads through the toolbar', async ({ page }) => {
  await openWorkspace(page);

  await page.getByTestId('workspace-upload-input').setInputFiles({ name: 'uploaded.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });

  await expect(page.getByTestId('workspace-row-uploaded.txt')).toBeVisible();
});

test('switches to the grid view', async ({ page }) => {
  await openWorkspace(page);

  await page.getByTestId('workspace-toggle-view').click();

  await expect(page.getByTestId('workspace-list')).toHaveAttribute('data-view', 'grid');
  await expect(page.getByTestId('workspace-entry-notes.md')).toBeVisible();
});

test('downloads a file through the row menu', async ({ page }) => {
  await openWorkspace(page);
  const row = page.getByTestId('workspace-row-notes.md');

  const download = page.waitForEvent('download');
  await row.getByTestId('workspace-entry-menu-button').click();
  await row.getByTestId('workspace-entry-download').click();

  expect((await download).suggestedFilename()).toBe('notes.md');
});
