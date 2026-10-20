import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Opens a row's actions menu and returns it.
 *
 * The menu is teleported to the body so that the table's pinned column and its
 * scroll container cannot clip it, which means it is not found from the row.
 * Only one menu is open at a time, so a page-level lookup is unambiguous.
 */
export async function openRowActions(page: Page, row: Locator): Promise<Locator> {
  await row.getByTestId('row-actions-button').click();
  const menu = page.getByTestId('row-actions-menu');
  await expect(menu).toBeVisible();
  return menu;
}

/**
 * Asserts the actions a row offers, in the order its menu lists them.
 *
 * A row with a single action has no menu: one click is worth more than two, so
 * the action is a plain button and this reads it from the row instead.
 */
export async function expectRowActions(page: Page, row: Locator, labels: string[]): Promise<void> {
  if (labels.length === 1 && (await row.getByTestId('row-actions-button').count()) === 0) {
    await expect(row.getByRole('button')).toHaveText(labels);
    return;
  }

  const menu = await openRowActions(page, row);
  await expect(menu.locator('li > *')).toHaveText(labels);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
}
