import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

async function ready(page, path = '/') {
  await page.goto(path);
  await expect(page.locator('#demo-status')).toContainText('Fixture checks passed');
}

test('root, docs and GitHub project prefixes load without runtime or asset errors', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const failures = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  for (const path of ['/', '/docs/', '/LSTARENGY/', '/LSTARENGY/docs/']) {
    await ready(page, path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Better projections');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const resources = await page.evaluate(() =>
      performance.getEntriesByType('resource').map((r) => r.name),
    );
    expect(resources.every((url) => url.startsWith(new URL(page.url()).origin))).toBe(true);
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('capability search, category/evidence filters, reset and expansion are functional', async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator('.feature:visible')).toHaveCount(8);
  await page.locator('#show-features').click();
  await expect(page.locator('.feature:visible')).toHaveCount(36);
  await page.locator('#feature-search').fill('Stack Finder');
  await expect(page.locator('.feature:visible')).toHaveCount(1);
  await expect(page.locator('.feature:visible')).toContainText('F11');
  await page.locator('#reset-filters').click();
  await page.locator('#category-filter').selectOption('Optimizer');
  await page.locator('#evidence-filter').selectOption('Unverified');
  await expect(page.locator('.feature:visible')).toHaveCount(1);
  await expect(page.locator('.feature:visible')).toContainText('F35');
  await page.locator('#feature-search').fill('<script>not a real feature</script>');
  await expect(page.locator('#feature-empty')).toBeVisible();
  await expect(page.locator('.feature:visible')).toHaveCount(0);
  await page.locator('#reset-filters').click();
  await expect(page.locator('.feature:visible')).toHaveCount(8);
});

test('claim citation opens the exact source excerpt; deep-linking reveals a hidden feature', async ({
  page,
}) => {
  await ready(page);
  await page.locator('#feature-F01 summary').click();
  await page.locator('#feature-F01 a[href="#evidence-S04-median"]').click();
  await expect(page.locator('#source-S04')).toHaveAttribute('open', '');
  await expect(page.locator('#evidence-S04-median')).toBeVisible();
  await expect(page.locator('#evidence-S04-median')).toContainText('expected median');
  await page.goto('/#feature-F35');
  await expect(page.locator('#feature-F35')).toBeVisible();
  await expect(page.locator('#feature-F35 details')).toHaveAttribute('open', '');
});

test('all automatic scenarios work; stale output and downloads are blocked', async ({ page }) => {
  await ready(page);
  await page.locator('#scenario-select').selectOption('stale');
  await expect(page.locator('#demo-status')).toContainText('Output blocked');
  await expect(page.locator('#demo-output')).toBeHidden();
  await expect(page.locator('#export-lineups')).toBeDisabled();
  await expect(page.locator('#export-projections')).toBeDisabled();
  await page.locator('#scenario-select').selectOption('late');
  await expect(page.locator('#demo-status')).toContainText('original slots frozen');
  await expect(page.locator('#demo-output')).toBeVisible();
  await expect(page.locator('.locked-label')).toHaveCount(3);
  await expect(page.locator('.out-row')).toHaveCount(1);
  await page.locator('#scenario-select').selectOption('stack');
  await expect(page.locator('#demo-status')).toContainText('3 complete lineups');
  await page.getByRole('button', { name: 'Lineup 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lineup 2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-lineups').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('synthetic-stack-lineups.csv');
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('"synthetic"');
  expect(csv).toContain('"research-nfl-shaped-v1"');
  expect(csv.trim().split('\r\n')).toHaveLength(4);
});

test('projection filters, sorting and full inventory download work', async ({ page }) => {
  await ready(page);
  await page.locator('#position-filter').selectOption('QB');
  await expect(page.locator('#projection-rows tr')).toHaveCount(4);
  await page.locator('#projection-sort').selectOption('salary');
  const salaries = await page.locator('#projection-rows tr td:nth-child(3)').allTextContents();
  const numbers = salaries.map((s) => Number(s.replaceAll(',', '')));
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  const response = await page.request.get('/docs/data/catalogue.json');
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.features).toHaveLength(36);
  expect(data.sources).toHaveLength(30);
});

test('WCAG A/AA checks on initial and expanded research states', async ({ page }) => {
  await ready(page);
  const axe = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    ).toEqual([]);
  };
  await axe();
  await page.locator('#show-features').click();
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
  await axe();
});

test('keyboard access, no horizontal overflow and screenshots', async ({ page }, info) => {
  await ready(page);
  if (info.project.name === 'desktop') {
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
  }
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: innerWidth,
      })),
    ).toEqual({ scroll: width, width });
  }
  await page.setViewportSize(info.project.use.viewport);
  await page.goto('/');
  await expect(page.locator('#demo-status')).toContainText('Fixture checks passed');
  await mkdir('artifacts/screenshots', { recursive: true });
  await page.screenshot({ path: `artifacts/screenshots/${info.project.name}-overview.png` });
  await page.locator('#lab').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/screenshots/${info.project.name}-lab.png` });
});

test('without JavaScript, evidence and default prototype still render', async ({
  browser,
  baseURL,
}, info) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: info.project.use.viewport,
  });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.locator('.feature:visible')).toHaveCount(36);
  await expect(page.locator('#projection-rows tr')).toHaveCount(24);
  await page.locator('#source-S04 summary').click();
  await expect(page.locator('#evidence-S04-median')).toBeVisible();
  await expect(page.locator('#lab-controls')).toBeHidden();
  await context.close();
});

test('preview allows proxy host, does not expose private files, rejects writes', async ({
  request,
}) => {
  expect((await request.get('/', { headers: { Host: '4173-sandbox.e2b.app' } })).status()).toBe(
    200,
  );
  for (const path of [
    '/.git/config',
    '/research/catalogue.json',
    '/package.json',
    '/docs/%2e%2e/.git/config',
  ])
    expect((await request.get(path)).status()).toBe(404);
  expect((await request.post('/docs/index.html', { data: 'no' })).status()).toBe(405);
});

test('worker loading failure blocks forecasts and exports without breaking research', async ({
  page,
}) => {
  await page.route('**/worker.mjs', (route) => route.abort('failed'));
  await page.goto('/');
  await expect(page.locator('#demo-status')).toContainText('Output blocked:');
  await expect(page.locator('#demo-output')).toBeHidden();
  await expect(page.locator('#export-lineups')).toBeDisabled();
  await page.locator('#feature-search').fill('ownership');
  await expect(page.locator('#feature-count')).not.toContainText('0 matching');
});

test('an unresponsive worker hits the deadline rather than hanging forever', async ({ page }) => {
  await page.clock.install();
  await page.route('**/worker.mjs', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: '// Intentionally never responds.',
    }),
  );
  await page.goto('/');
  await expect(page.locator('#demo-status')).toContainText('Checking fixture');
  await page.clock.fastForward(10001);
  await expect(page.locator('#demo-status')).toContainText('ten-second deadline');
  await expect(page.locator('#demo-output')).toBeHidden();
  await expect(page.locator('#export-projections')).toBeDisabled();
});

test('malformed worker output fails closed with a readable error', async ({ page }) => {
  await page.route('**/worker.mjs', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: 'self.onmessage = ({data}) => self.postMessage({requestId: data.requestId, run: null});',
    }),
  );
  await page.goto('/');
  await expect(page.locator('#demo-status')).toContainText('invalid result');
  await expect(page.locator('#demo-output')).toBeHidden();
  await expect(page.locator('#export-lineups')).toBeDisabled();
});
