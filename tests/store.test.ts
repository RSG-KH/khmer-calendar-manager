import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Store, ConflictError } from '../server/store.ts';
import { createApp } from '../server/app.ts';
import { catalog } from './fixtures.ts';

test('saving is revision-checked, backed up, and identical saves are idempotent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'calendar-store-test-'));
  const store = new Store(dir); await store.initialize();
  const first = await store.read(), original = await readFile(store.file, 'utf8');
  const saved = await store.save(catalog(), first.etag, 'Initial test records');
  assert.equal(saved.workspace.revision, 1); assert.equal(saved.workspace.history.length, 1);
  const backups = await readdir(join(dir, '.backups'));
  assert.equal(backups.length, 1); assert.equal(await readFile(join(dir, '.backups', backups[0]), 'utf8'), original);
  assert.equal((await store.save(catalog(), saved.etag, 'Repeated save')).etag, saved.etag);
  await assert.rejects(store.save(catalog(), first.etag, 'Stale tab'), ConflictError);
  assert.equal((await store.read()).etag, saved.etag);
});
test('concurrent saves cannot silently overwrite each other', async () => {
  const store = new Store(await mkdtemp(join(tmpdir(), 'calendar-concurrency-test-'))); await store.initialize();
  const first = await store.read(), left = catalog(), right = catalog(); right.dataVersion = '0.2.0';
  const results = await Promise.allSettled([store.save(left, first.etag, 'First tab'), store.save(right, first.etag, 'Second tab')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal((await store.read()).workspace.revision, 1);
});
test('external file edits and invalid workspaces are preserved', async () => {
  const store = new Store(await mkdtemp(join(tmpdir(), 'calendar-external-test-'))); await store.initialize();
  const first = await store.read();
  const external = { ...first.workspace, data: catalog() }; await writeFile(store.file, JSON.stringify(external));
  await assert.rejects(store.save(catalog(), first.etag, 'Old tab'), ConflictError);
  await writeFile(store.file, '{bad json');
  await assert.rejects(store.initialize());
  assert.equal(await readFile(store.file, 'utf8'), '{bad json');
  await writeFile(store.file, JSON.stringify({ ...external, history: [null] }));
  await assert.rejects(store.read(), /history entry/);
});
test('an exported version cannot be reused for different content', async () => {
  const store = new Store(await mkdtemp(join(tmpdir(), 'calendar-export-test-'))); await store.initialize();
  let current = await store.save(catalog(), (await store.read()).etag, 'Initial');
  const first = await store.export(current.etag);
  assert.deepEqual(await store.export(current.etag), first);
  const data = catalog(); data.events[0].names.en = 'Corrected test name';
  current = await store.save(data, current.etag, 'Correction');
  await assert.rejects(store.export(current.etag), /Increase the data version/);
  data.dataVersion = '0.1.1'; current = await store.save(data, current.etag, 'New release version');
  assert.notEqual((await store.export(current.etag)).manifest.sha256, first.manifest.sha256);
});
test('HTTP rejects foreign-origin writes and validates save revisions', async () => {
  const app = await createApp({ root: resolve('.'), dataDirectory: await mkdtemp(join(tmpdir(), 'calendar-http-test-')) });
  const badPorts = new Set([1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 139, 143, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 556, 563, 587, 601, 636, 993, 995, 2049, 3659, 4045, 6000, 6665, 6666, 6667, 6668, 6669, 6697]);
  while (true) {
    await new Promise<void>(ok => app.server.listen(0, '127.0.0.1', ok));
    const address = app.server.address(); assert.ok(address && typeof address !== 'string');
    if (!badPorts.has(address.port)) break;
    await new Promise<void>(ok => app.server.close(() => ok()));
  }
  const address = app.server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    const snapshot = await (await fetch(`${url}/api/workspace`)).json();
    const input = { data: catalog(), expected: snapshot.etag, note: 'HTTP save' };
    const headers = { 'content-type': 'application/json', 'x-manager-request': '1' };
    assert.equal((await fetch(`${url}/api/save`, { method: 'POST', headers: { ...headers, origin: 'https://example.org' }, body: JSON.stringify(input) })).status, 403);
    assert.equal((await fetch(`${url}/api/save`, { method: 'POST', headers, body: JSON.stringify(input) })).status, 200);
    assert.equal((await fetch(`${url}/api/save`, { method: 'POST', headers, body: JSON.stringify(input) })).status, 409);
    assert.equal((await fetch(`${url}/api/save`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })).status, 403);
  } finally { await app.close(); }
});
