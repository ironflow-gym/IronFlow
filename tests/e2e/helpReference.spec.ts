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
        const article = help.getByRole('heading', { level: 3, name: title.trim(), exact: true }).locator('..');
        expect(await article.locator('ol > li').count(), title).toBeGreaterThanOrEqual(3);
        await expect(article.locator('details[open]')).toHaveCount(0);
        // Full reference stays reachable and readable, including formulas/ranges.
        for (const summary of await article.locator('details > summary').all()) await summary.click();
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

for (const width of [320, 1440]) {
  test(`sample help articles show readable steps, real examples and visible restore consequences at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const help = await openHelp(page, width < 1024);
    const examples = [
      ['Getting Started', 'Start your first workout'],
      ['Training', 'Choosing your next weight'],
      ['Backup and data', 'Restore a backup'],
    ];
    for (const [category, title] of examples) {
      await help.getByRole('button', { name: category, exact: true }).click();
      await help.getByRole('button', { name: title, exact: true }).click();
      const article = help.getByRole('heading', { name: title, level: 3, exact: true }).locator('..');
      expect(await article.locator('ol > li').count()).toBeGreaterThanOrEqual(3);
      const picture = article.getByRole('img'); await picture.scrollIntoViewIfNeeded();
      await expect.poll(() => picture.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      await expect(picture).toHaveAttribute('alt', /showing A/);
      await expect(article.locator('figcaption')).toContainText('fictional records');
      if (title === 'Restore a backup') {
        await expect(article.getByRole('complementary', { name: 'Before restoring' })).toContainText('replaces your current records');
        await expect(article).toContainText('Drive backups stay paused');
        await article.getByText('Can I undo a restore?', { exact: true }).click();
        await expect(article).toContainText('replaces changes made since the restore');
      } else {
        await article.locator('details summary').first().click();
        await expect(article.locator('details[open]')).toHaveCount(1);
      }
      expect(await article.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      if (width < 1024) {
        await help.getByRole('button', { name: 'Back to help topics', exact: true }).click();
        await help.getByRole('button', { name: 'Back to help categories', exact: true }).click();
      }
    }
  });
}

for (const width of [320, 1440]) {
  test(`help search finds reference details and returns to the right category at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const help = await openHelp(page, width < 1024);
    const search = help.getByRole('searchbox', { name: 'Search help topics' });
    await search.fill('22.56');
    await expect(help.getByRole('status')).toContainText('matching topics');
    await help.getByRole('button', { name: 'Equipment, units and plate loading Training', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(help.getByRole('heading', { name: 'Equipment, units and plate loading', exact: true })).toBeVisible();
    await expect(help.getByRole('complementary', { name: 'Keep in mind' })).toContainText('30.06');
    if (width < 1024) {
      await help.getByRole('button', { name: 'Back to help topics' }).click();
      await expect(help.getByRole('button', { name: 'Choosing your next weight', exact: true })).toBeVisible();
    }
    await search.fill('undo restore');
    await help.getByRole('button', { name: 'Restore a backup Backup and data', exact: true }).click();
    await expect(help.getByRole('complementary', { name: 'Before restoring' })).toContainText('replaces your current records');
    await search.fill('no-such-help-topic');
    await expect(help.getByRole('status')).toContainText('No matching topics');
    if (width < 1024) {
      await help.getByRole('button', { name: 'Back to help', exact: true }).click();
      await expect(search).toHaveValue('');
    } else await search.fill('');
    await expect(help.getByRole('button', { name: 'Training', exact: true, includeHidden: true })).toBeAttached();
    await page.keyboard.press('Escape');
    await expect(help).not.toBeVisible();
  });
}

for (const width of [320, 1440]) {
  test(`priority help workflows have annotated screenshots with readable captions at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    const help = await openHelp(page, width < 1024);
    const topics: [string, string, number][] = [
      ['Training', 'Logging and finishing a session', 3],
      ['Training', 'Working, warmup and deload sets', 3],
      ['Training', 'Goal-based training blocks', 2],
      ['Training', 'Training calendar and day markers', 1],
      ['Training', 'Equipment, units and plate loading', 2],
      ['Nutrition', 'Repeat food and saved meals', 3],
      ['Nutrition', 'Barcode scanning and portion basis', 2],
      ['Backup and data', 'IronSync — Google Drive backup', 2],
    ];
    for (const [category, title, count] of topics) {
      await help.getByRole('button', { name: category, exact: true }).click();
      await help.getByRole('button', { name: title, exact: true }).click();
      const article = help.getByRole('heading', { level: 3, name: title, exact: true }).locator('..');
      const examples = article.getByRole('region', { name: 'Annotated examples', exact: true });
      await expect(examples).toContainText('fictional records');
      await expect(examples.getByRole('img')).toHaveCount(count);
      expect(await article.getByRole('complementary', { name: 'Keep in mind' }).evaluate(el => !!(el.compareDocumentPosition(el.parentElement!.querySelector('section[aria-label="Annotated examples"]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
      for (const picture of await examples.getByRole('img').all()) {
        await picture.scrollIntoViewIfNeeded();
        await expect.poll(() => picture.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
        await expect(picture).toHaveAttribute('alt', /showing A/);
        expect(await picture.evaluate((el: HTMLImageElement) => el.naturalWidth === Number(el.getAttribute('width')) && el.naturalHeight === Number(el.getAttribute('height')))).toBe(true);
        await expect(picture.locator('..').locator('figcaption')).toContainText('A —');
      }
      expect(await article.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      if (width < 1024) {
        await help.getByRole('button', { name: 'Back to help topics', exact: true }).click();
        await help.getByRole('button', { name: 'Back to help categories', exact: true }).click();
      }
    }
  });
}
