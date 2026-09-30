import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession } from './support/mock-backend';
import { openDisclosure, waitForShellStyles } from './support/styles';

interface FieldReport {
  text: string;
  control: string;
  wrapped: boolean;
  textBottom: number;
  controlTop: number;
}

/**
 * Reads every labelled control on the page and reports whether the label text
 * sits on its own line above the control.
 *
 * The probe measures the text element rather than the <label>: the label wraps
 * the control, so its box always spans both lines.
 */
/** Reads every control on the page, wrapped or not. */
async function inspectFields(page: Page): Promise<{ fields: FieldReport[]; unwrapped: string[] }> {
  return page.evaluate(() => {
    const fields: FieldReport[] = [];
    const unwrapped: string[] = [];
    const controls = Array.from(document.querySelectorAll('input:not([type=checkbox]), select'));

    for (const control of controls) {
      const id = control.id || control.tagName.toLowerCase();
      const label = control.closest('label');

      if (!label) {
        // A sibling <label for> leaves the control outside the label, which is
        // the pattern this suite exists to prevent.
        unwrapped.push(id);
        continue;
      }

      const text = label.querySelector('.fieldset-legend');
      fields.push({
        text: (text?.textContent ?? '').trim(),
        control: id,
        wrapped: label.contains(control),
        textBottom: text ? Math.round(text.getBoundingClientRect().bottom) : -1,
        controlTop: Math.round(control.getBoundingClientRect().top),
      });
    }
    return { fields, unwrapped };
  });
}

function expectStacked(report: { fields: FieldReport[]; unwrapped: string[] }, context: string) {
  expect(report.unwrapped, `${context}: controls outside a label`).toEqual([]);
  expect(report.fields.length, `${context}: no labelled controls`).toBeGreaterThan(0);
  for (const field of report.fields) {
    expect(field.text, `${context} ${field.control}: empty legend`).not.toBe('');
    expect(field.wrapped, `${context} ${field.control}: control is not inside its label`).toBe(true);
    expect(field.textBottom, `${context} ${field.control}: label text shares a line with the control`).toBeLessThanOrEqual(field.controlTop);
  }
  return report.fields.length;
}

const authPages = ['/en/login', '/en/register', '/en/forgot-password', '/en/reset-password?token=t'];

test('the auth forms stack every label above its control', async ({ page }) => {
  let checked = 0;
  for (const path of authPages) {
    await page.goto(path);
    await expect(page.locator('.fieldset-legend').first()).toBeVisible();
    checked += expectStacked(await inspectFields(page), path);
  }
  expect(checked).toBeGreaterThanOrEqual(9);
});

test('the app forms stack every label above its control', async ({ page }) => {
  await mockBackend(page, { session: boss, groups: [{ id: 'group-1', name: 'engineering', created_at: '2026-04-05T06:07:08Z', memberIds: [] }] });
  await seedSession(page);

  let checked = 0;
  for (const path of ['/en/settings', '/en/users', '/en/groups', '/en/agents', '/en/providers']) {
    await page.goto(path);
    await waitForShellStyles(page);

    // The dialog fields only exist in the DOM once the dialog is open.
    if (path === '/en/users') {
      await page.locator('#users-page-create-btn').click();
      await expect(page.locator('#user-form-username')).toBeVisible();
    }
    if (path === '/en/groups') {
      await page.locator('#groups-page-create-btn').click();
      await expect(page.locator('#group-name')).toBeVisible();
    }
    if (path === '/en/agents') {
      await page.locator('#agents-page-create-btn').click();
      await expect(page.locator('#agent-name')).toBeVisible();
      // Ticking entries is what brings their parameter fieldsets into the DOM.
      await page.locator('#agent-tools-Gitea').setChecked(true);
      await page.locator('#agent-prompts-CharacterPrompt').setChecked(true);
    }
    if (path === '/en/providers') {
      await page.locator('#providers-page-create-btn').click();
      await expect(page.locator('#provider-model_name')).toBeVisible();
      // The optional fields are behind a disclosure; open it so the probe sees
      // every control rather than measuring hidden boxes.
      await openDisclosure(page, 'provider-advanced');
    }
    // Measuring before the stylesheet lands would compare unstyled boxes.
    await expect(page.locator('.fieldset-legend').first()).toBeVisible();
    checked += expectStacked(await inspectFields(page), path);
  }
  expect(checked).toBeGreaterThanOrEqual(13);
});

test('clicking a label focuses the control it wraps', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/settings');

  await page.locator('label.fieldset:has(#settings-display-name) .fieldset-legend').click();
  await expect(page.locator('#settings-display-name')).toBeFocused();

  await page.locator('label.fieldset:has(#settings-language) .fieldset-legend').click();
  await expect(page.locator('#settings-language')).toBeFocused();

  await page.goto('/en/users');
  await page.locator('label.fieldset:has(#users-search) .fieldset-legend').click();
  await expect(page.locator('#users-search')).toBeFocused();
});
