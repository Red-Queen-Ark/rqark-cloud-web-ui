import { expect, type Locator, type Page } from '@playwright/test';
import { openRowActions } from './row-actions';

/** The horizontal scroll container a list page wraps its table in. */
function scrollerOf(page: Page): Locator {
  return page.locator('[data-testid="data-list-panel"] .overflow-x-auto');
}

/** The last column of the first row, where every list page keeps its actions. */
function actionsOf(page: Page): Locator {
  return page.locator('tbody tr').first().locator('td').last();
}

/** The right edge of a locator's box, or `NaN` when it is not rendered. */
async function rightEdge(target: Locator): Promise<number> {
  const box = await target.boundingBox();
  return box ? box.x + box.width : Number.NaN;
}

/** Whether `target` sits inside the visible slice of `scroller`. */
async function isWithin(target: Locator, scroller: Locator): Promise<boolean> {
  const [inner, outer] = await Promise.all([target.boundingBox(), scroller.boundingBox()]);
  if (!inner || !outer) {
    return false;
  }
  return inner.x >= outer.x && inner.x + inner.width <= outer.x + outer.width;
}

/**
 * Asserts that a list page keeps its row actions reachable.
 *
 * The table never wraps, so a row wider than the panel used to push the actions
 * column past the panel's right edge, where the sideways scroll hid it: the
 * buttons were still "visible" to a hit test, just off screen.
 *
 * Every row now opens its actions from one button in that same pinned cell, and
 * the menu it opens is teleported out of the table. Both have to be reachable:
 * the button inside the panel, the menu inside the window.
 */
export async function expectRowActionsReachable(page: Page, context = ''): Promise<void> {
  const where = context ? ` (${context})` : '';
  const scroller = scrollerOf(page);

  // Every assertion below is in pixels, and the timestamp columns are sized by
  // the font, so the webfont has to have swapped in before anything is measured.
  await page.evaluate(() => document.fonts.ready);

  // The premise: this row does not fit. Without it the rest would pass on a
  // table that never overflows, and stop guarding anything.
  expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth), `the table should be wider than the panel${where}`).toBe(true);

  const actions = actionsOf(page);
  // Pinned flush with the panel edge rather than trailing the last column.
  expect(await rightEdge(actions), `the actions column should sit flush with the panel${where}`).toBeCloseTo(await rightEdge(scroller), 0);

  const buttons = actions.getByRole('button');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);

  const onScreen = async () => {
    const results: boolean[] = [];
    for (let index = 0; index < count; index += 1) {
      results.push(await isWithin(buttons.nth(index), scroller));
    }
    return results;
  };

  const before = await onScreen();
  expect(before, `every row action should be on screen${where}`).toEqual(new Array<boolean>(count).fill(true));

  // The column is pinned, so scrolling the rest of the row underneath it does
  // not carry the buttons away.
  await scroller.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });

  expect(await onScreen()).toEqual(before);

  // The menu hangs off that pinned button outside the table, so the panel's
  // clipping cannot hide it either: opened from the first row it has to fall
  // wholly inside the window, not over its edge.
  const menu = await openRowActions(page, page.locator('tbody tr').first());
  const menuBox = await menu.boundingBox();
  const viewport = page.viewportSize();
  if (!menuBox || !viewport) {
    throw new Error(`the row actions menu is not rendered${where}`);
  }

  const inside = (start: number, size: number, limit: number) => start >= 0 && start + size <= limit;
  expect(inside(menuBox.x, menuBox.width, viewport.width), `the row actions menu should fit the window horizontally${where}`).toBe(true);
  expect(inside(menuBox.y, menuBox.height, viewport.height), `the row actions menu should fit the window vertically${where}`).toBe(true);

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
}
