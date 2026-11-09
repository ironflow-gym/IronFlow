import type { Page } from '@playwright/test';
export async function expandTodaySection(page: Page, label: string) {
  const region = page.getByRole('region', { name: label, exact: true });
  const toggle = region.locator(':scope > div > button[aria-expanded]');
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}
