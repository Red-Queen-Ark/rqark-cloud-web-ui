import { expect, test, type Page } from '@playwright/test';

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
