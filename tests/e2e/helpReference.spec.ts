import { test, expect, type Page } from '@playwright/test';
async function openHelp(page: Page, mobile: boolean) {
  await page.goto('/');
  await page.getByRole('button', { name: /Skip for now/ }).click();
  if (mobile) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Help & Reference', exact: true }).click();
  return page.getByRole('dialog', { name: 'Help and Reference', exact: true });
}
for (const width of [320, 1440]) {
  test(`help topics are readable and navigable at ${width}px without changing saved records`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const help = await openHelp(page, width < 1024);
    const before = await page.evaluate(async () => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); return storage.getEverything(); });
    const categoryNames = ['Getting Started', 'Training', 'Analytics', 'Biometrics', 'Nutrition', 'Backup and data', 'Settings and AI'];
    let topicCount = 0;
    for (const category of categoryNames) {
      await help.getByRole('button', { name: category, exact: true }).click();
      // Each category retains its topic list; on mobile Back returns to it.
      const topics = await help.locator('nav').nth(1).getByRole('button').allTextContents();
      for (const title of topics) {
        await help.getByRole('button', { name: title.trim(), exact: true }).click();
        await expect(help.getByRole('heading', { level: 3, name: title.trim(), exact: true })).toBeVisible();
        const overflow = await help.evaluate(el => [...el.querySelectorAll<HTMLElement>('div')].filter(node => node.getClientRects().length && node.scrollWidth > node.clientWidth + 2 && getComputedStyle(node).overflowX !== 'auto').map(node => node.className));
        expect(overflow, title).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const panel = help.locator('div.overflow-y-auto').last();
        await panel.evaluate(node => { node.scrollTop = 10000; });
        if (width < 1024) await help.getByRole('button', { name: 'Back to help topics', exact: true }).click();
        topicCount++;
      }
      if (width < 1024) await help.getByRole('button', { name: 'Back to help categories', exact: true }).click();
    }
    expect(topicCount).toBeGreaterThanOrEqual(50);
    await help.getByRole('button', { name: 'Training', exact: true }).click();
    await help.getByRole('button', { name: 'Correcting AI-generated block workouts', exact: true }).click();
    await expect(help).toContainText('only to generation within the block builder');
    await page.keyboard.press('Escape'); await expect(help).not.toBeVisible();
    const after = await page.evaluate(async () => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); return storage.getEverything(); });
    expect(after).toEqual(before); expect(errors).toEqual([]);
  });
}
