import type { Locator, Page } from '@playwright/test';
/** Exercise the same focused numeric editor used for ordinary load entry. */
export async function enterWeight(page: Page, weightButton: Locator, value: number) {
  await weightButton.click();
  const editor = page.getByRole('dialog', { name: 'Adjust weight', exact: true });
  for (const digit of String(value)) await editor.getByRole('button', { name: digit, exact: true }).click();
  await editor.getByRole('button', { name: 'Apply value', exact: true }).click();
}
