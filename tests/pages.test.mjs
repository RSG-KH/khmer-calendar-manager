import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { servePages } from './static-server.mjs';
import { catalog } from './fixtures.ts';
import { buildExport } from '../server/store.ts';

async function importDraft(page, data) {
  await page.getByRole('navigation').getByRole('button', { name: 'Import data' }).click();
  await page.getByLabel('Import content', { exact: true }).fill(JSON.stringify(data));
  await page.getByRole('button', { name: 'Review import', exact: true }).click();
  const review = page.getByRole('checkbox', { name: /I reviewed the replacements/ });
  if (await review.count()) await review.check();
  await page.getByRole('button', { name: 'Apply import to draft', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: /^Review & export/ }).click();
  await page.getByLabel('Change note', { exact: true }).fill('Synthetic Pages verification');
}
async function downloadJson(page, name) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name, exact: true }).click()]);
  return JSON.parse(await readFile(await file.path(), 'utf8'));
}
async function chooseBackup(page, data) {
  await page.getByLabel('Open workspace backup', { exact: true }).setInputFiles({ name: 'workspace.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
}

test('Pages preserves browser saves, concurrent edits, backup history and immutable exports', { timeout: 90000 }, async () => {
  const app = await servePages();
  const browser = await chromium.launch(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN, headless: true } : { channel: 'chrome', headless: true });
  const context = await browser.newContext(), left = await context.newPage(), right = await context.newPage();
  const errors = [];
  for (const page of [left, right]) {
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(String(error)));
  }
  try {
    await Promise.all([left.goto(app.url), right.goto(app.url)]);
    await Promise.all([left, right].map(page => page.getByText('Saved · revision 0', { exact: true }).waitFor()));
    assert.equal(await left.locator('.brand-mark').evaluate(image => image.complete && image.naturalWidth === 512), true);
    const record = await (await context.request.get(app.url + 'engine-release.json')).json();
    const installed = JSON.parse(await readFile('node_modules/khmer-calendar-engine/package.json', 'utf8'));
    assert.equal(record.version, installed.version);
    await Promise.all([importDraft(left, catalog()), importDraft(right, catalog())]);
    await Promise.all([left, right].map(page => page.getByRole('button', { name: 'Save reviewed changes', exact: true }).click()));
    await Promise.race([left, right].map(page => page.getByText('Saved · revision 1', { exact: true }).waitFor()));
    const winner = await left.getByText('Saved · revision 1', { exact: true }).count() ? left : right;
    const stale = winner === left ? right : left;
    await stale.getByRole('alert').filter({ hasText: 'changed in another tab' }).waitFor();
    await stale.getByRole('button', { name: 'Discard draft', exact: true }).click();
    await stale.getByRole('button', { name: 'Reload saved workspace', exact: true }).click();
    await stale.getByText('Saved · revision 1', { exact: true }).waitFor();

    await winner.getByRole('button', { name: 'Prepare export', exact: true }).click();
    const manifest = await downloadJson(winner, 'Download manifest');
    assert.deepEqual(manifest, buildExport(catalog()).manifest, 'Browser and local server export identical content and manifests');
    const backup = await downloadJson(winner, 'Download workspace');
    assert.equal(backup.workspace.revision, 1);
    assert.deepEqual(backup.exports, [manifest]);

    const changed = catalog(); changed.events[0].names.en = 'Changed synthetic name';
    await importDraft(winner, changed);
    await winner.getByRole('button', { name: 'Save reviewed changes', exact: true }).click();
    await winner.getByText('Saved · revision 2', { exact: true }).waitFor();
    await winner.getByRole('button', { name: 'Prepare export', exact: true }).click();
    await winner.getByRole('alert').filter({ hasText: 'already exported' }).waitFor();

    await chooseBackup(winner, { ...backup, workspace: { ...backup.workspace, revision: -1 } });
    await winner.getByRole('alert').filter({ hasText: 'Invalid workspace' }).waitFor();
    assert.equal(await winner.getByText('Saved · revision 2', { exact: true }).count(), 1);
    await chooseBackup(winner, backup);
    await winner.getByRole('heading', { name: 'Review workspace restoration' }).waitFor();
    assert.equal(await winner.getByRole('button', { name: 'Restore workspace', exact: true }).isDisabled(), true);
    await winner.getByRole('checkbox', { name: /I reviewed this backup/ }).check();
    await winner.getByRole('button', { name: 'Restore workspace', exact: true }).click();
    await winner.getByText('Saved · revision 1', { exact: true }).waitFor();
    await winner.getByLabel('Previous saved revision', { exact: true }).selectOption({ label: 'Revision 2 · Synthetic Pages verification' });
    assert.equal((await downloadJson(winner, 'Download previous revision')).workspace.data.events[0].names.en, changed.events[0].names.en);
    await winner.reload();
    await winner.getByText('Saved · revision 1', { exact: true }).waitFor();

    const fresh = await browser.newContext(), restored = await fresh.newPage();
    await restored.goto(app.url);
    await restored.getByText('Saved · revision 0', { exact: true }).waitFor();
    await restored.getByRole('navigation').getByRole('button', { name: /^Review & export/ }).click();
    await chooseBackup(restored, backup);
    await restored.getByRole('checkbox', { name: /I reviewed this backup/ }).check();
    await restored.getByRole('button', { name: 'Restore workspace', exact: true }).click();
    await restored.getByText('Saved · revision 1', { exact: true }).waitFor();
    await restored.getByRole('button', { name: 'Prepare export', exact: true }).click();
    assert.deepEqual(await downloadJson(restored, 'Download manifest'), manifest);

    const conflicting = structuredClone(backup); conflicting.exports[0].sha256 = '0'.repeat(64);
    await chooseBackup(restored, conflicting);
    await restored.getByRole('checkbox', { name: /I reviewed this backup/ }).check();
    await restored.getByRole('button', { name: 'Restore workspace', exact: true }).click();
    await restored.getByRole('alert').filter({ hasText: 'conflicts with previously exported version' }).waitFor();
    assert.deepEqual((await downloadJson(restored, 'Download workspace')).exports, [manifest]);
    await mkdir('build/verification', { recursive: true });
    await restored.screenshot({ path: 'build/verification/pages-workspace.png', fullPage: true });
    await restored.setViewportSize({ width: 390, height: 844 });
    assert.equal(await restored.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await restored.screenshot({ path: 'build/verification/pages-workspace-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    await fresh.close();
  } finally { await browser.close(); await app.close(); }
});

test('Pages reports unavailable browser storage without claiming a save', { timeout: 30000 }, async () => {
  const app = await servePages();
  const browser = await chromium.launch(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN, headless: true } : { channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { throw new Error('Browser storage is unavailable'); } }));
    await page.goto(app.url);
    await page.getByRole('alert').filter({ hasText: 'Browser storage is unavailable' }).waitFor();
    await page.getByRole('heading', { name: 'Workspace unavailable' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Download draft', exact: true }).isDisabled(), true);
  } finally { await browser.close(); await app.close(); }
});
