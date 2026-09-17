import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyCatalog, validateCatalog } from '../src/model.ts';
import { planImport } from '../src/imports.ts';
import { preview } from '../src/preview.ts';
import { exportContent } from '../src/workspace.ts';

const path = new URL('../data/migrations/android-archive-and-rules.json', import.meta.url);
const raw = readFileSync(path, 'utf8');
const catalog = validateCatalog(JSON.parse(raw));
const counts = [89, 92, 91, 94, 94, 98, 99, 100, 101, 102, 102, 102, 103, 103, 105, 106, 108, 109, 110, 110, 109, 108, 109, 110, 113, 113, 113, 113, 114, 113, 113];

test('migrated Android catalog preserves the complete 31-year archive', () => {
  assert.equal(createHash('sha256').update(raw).digest('hex'), '591b6a2f299f73102e957c11319d9957908cd2e31feb3139345bbd2a7ed09654');
  assert.equal(catalog.schemaVersion, 2);
  assert.equal(catalog.eventCalendars.length, 31);
  assert.equal(catalog.eventCalendars.flatMap(calendar => calendar.events).length, 3246);
  assert.deepEqual(catalog.eventCalendars.map(calendar => calendar.events.length), counts);
  assert.equal(new Set(catalog.eventCalendars.flatMap(calendar => calendar.events.map(event => event.id))).size, 3246);
  const importPlan = planImport(emptyCatalog(), raw, 'json');
  assert.equal(importPlan.description, 'Full catalog replacement');
  assert.equal(importPlan.data.eventCalendars.length, 31);
  for (const calendar of catalog.eventCalendars) {
    const rows = preview(catalog, calendar.year).rows;
    assert.equal(rows.length, calendar.events.length, String(calendar.year));
    assert.deepEqual(new Set(rows.map(row => row.id)), new Set(calendar.events.map(event => event.id)), String(calendar.year));
  }
  assert.doesNotThrow(() => exportContent(catalog));
});

test('migrated Android rules calculate uncovered years and retain known corrections', () => {
  assert.equal(catalog.events.length, 100);
  assert.equal(catalog.eventCalendars.flatMap(calendar => calendar.events).filter(event => event.eventId).length, 2897);
  assert.deepEqual(catalog.overrides.map(item => [item.eventId, item.year]), Array.from({ length: 15 }, (_, index) => ['king_sihamoni_birthday', 2005 + index]));
  assert.equal(catalog.holidayCalendars.flatMap(calendar => calendar.holidays).length, 44);
  const future = preview(catalog, 2031);
  assert.deepEqual(future.issues, []);
  assert.ok(future.rows.length > 90);
  assert.ok(future.rows.every(row => !row.en.includes('{anniversary}') && !row.km.includes('{anniversary}')));
  assert.match(future.rows.find(row => row.eventId === 'victory_over_genocide')!.km, /៥២/);
  const without2010Archive = structuredClone(catalog);
  without2010Archive.eventCalendars = without2010Archive.eventCalendars.filter(calendar => calendar.year !== 2010);
  assert.deepEqual(preview(without2010Archive, 2010).rows.filter(row => row.eventId === 'king_sihamoni_birthday').map(row => row.date), ['2010-05-13', '2010-05-14', '2010-05-15']);
});
