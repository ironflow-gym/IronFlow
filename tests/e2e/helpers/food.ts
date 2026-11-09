import type { Page } from '@playwright/test';
import { expandTodaySection } from './today';
export const expandFoodSection = expandTodaySection;
export async function openFoodOptions(page: Page, name: string) {
  const today = page.getByRole('region', { name: 'Today’s food', exact: true });
  if (await today.count()) await expandFoodSection(page, 'Today’s food');
  const row = page.getByRole('article', { name, exact: true }).first();
  const menu = row.locator('details');
  if (!(await menu.getAttribute('open') !== null)) await menu.locator('summary').click();
}
