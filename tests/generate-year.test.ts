import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmYear, generateYear } from '../src/generate-year.ts';
import { emptyCatalog, publicationIssues, validateCatalog } from '../src/model.ts';
import { preview } from '../src/preview.ts';
import { exportContent, validateWorkspace } from '../src/workspace.ts';
import { source } from './fixtures.ts';

test('2026 draft matches published LRC dates but remains unconfirmed', () => {
  // Independent yearly anchor: https://lrc.gov.kh/en/annual-holiday-calendar-2026/
  const data = generateYear(emptyCatalog(), 2026), calendar = data.holidayCalendars[0];
  const expected: Record<string, string[]> = {
    'new-year': ['01-01'], victory: ['01-07'], women: ['03-08'],
    'khmer-new-year': ['04-14', '04-15', '04-16'], labour: ['05-01'], visak: ['05-01'],
    ploughing: ['05-05'], 'king-birthday': ['05-14'], 'queen-birthday': ['06-18'],
    constitution: ['09-24'], pchum: ['10-10', '10-11', '10-12'], 'king-father': ['10-15'],
    coronation: ['10-29'], independence: ['11-09'], water: ['11-23', '11-24', '11-25'], peace: ['12-29'],
  };
  assert.deepEqual(Object.fromEntries(calendar.holidays.map(h => [h.id, h.dates])), Object.fromEntries(Object.entries(expected).map(([id, dates]) => [id, dates.map(d => `2026-${d}`)])));
  assert.ok(calendar.holidays.every(h => h.status === 'draft' && !h.sourceIds.length));
  assert.equal(data.sources.length, 0);
  assert.ok(preview(data, 2026).rows.every(r => r.kind === 'draft' && r.basis === 'Awaiting review'));
  assert.throws(() => exportContent(data), /before exporting/);
  assert.throws(() => generateYear(data, 2026), /already has a list/);
});

test('new years recalculate moving holidays and drafts survive save validation', () => {
  const original = emptyCatalog(), a = generateYear(original, 2026), b = generateYear(a, 2027);
  assert.equal(original.holidayCalendars.length, 0);
  const date = (y: number, id: string) => b.holidayCalendars.find(c => c.year === y)!.holidays.find(h => h.id === id)!.dates[0].slice(5);
  assert.notEqual(date(2026, 'pchum'), date(2027, 'pchum'));
  assert.equal(date(2026, 'labour'), date(2027, 'labour'));
  assert.deepEqual(validateWorkspace({ revision: 0, history: [], data: b }).data, b);
  assert.throws(() => generateYear(emptyCatalog(), 2025), /2026 onward/);
  assert.throws(() => generateYear(emptyCatalog(), 2201), /2200/);
});

test('review retains developer corrections, additions and removals; only government evidence can confirm', () => {
  const draft = generateYear(emptyCatalog(), 2027), calendar = draft.holidayCalendars[0];
  calendar.holidays.find(h => h.id === 'khmer-new-year')!.dates = ['2027-04-15'];
  calendar.holidays = calendar.holidays.filter(h => h.id !== 'water');
  calendar.holidays.push({ id: 'test-extra', names: { en: 'Synthetic extra holiday', km: 'សាកល្បង' }, dates: ['2027-07-01'], status: 'draft', sourceIds: [] });
  assert.throws(() => confirmYear(draft, 2027, source.id, 'complete'), /government publication/);
  draft.sources.push({ ...source, kind: 'calendar' });
  assert.throws(() => confirmYear(draft, 2027, source.id, 'complete'), /government publication/);
  draft.sources[0].kind = 'government';
  const confirmed = confirmYear(draft, 2027, source.id, 'complete');
  assert.ok(draft.holidayCalendars[0].holidays.every(h => h.status === 'draft'));
  assert.deepEqual(publicationIssues(confirmed), []);
  const exported = JSON.parse(exportContent(confirmed).content).holidayCalendars[0];
  assert.equal(exported.coverage, 'complete');
  assert.ok(exported.holidays.every((h: any) => h.status === 'active' && h.sourceIds.includes(source.id)));
  assert.deepEqual(exported.holidays.find((h: any) => h.id === 'khmer-new-year').dates, ['2027-04-15']);
  assert.ok(exported.holidays.some((h: any) => h.id === 'test-extra'));
  assert.ok(!exported.holidays.some((h: any) => h.id === 'water'));
  confirmed.holidayCalendars[0].holidays[0].sourceIds = [];
  assert.throws(() => validateCatalog(confirmed), /at least one source/);
});

test('confirming drafts preserves previously reviewed and cancelled records', () => {
  const data = generateYear(emptyCatalog(), 2027);
  data.sources.push(source, { ...source, id: 'test-amendment' });
  const c = data.holidayCalendars[0]; c.sourceIds = [source.id];
  c.holidays[0].status = 'cancelled'; c.holidays[0].sourceIds = [source.id]; c.holidays[0].note = 'Synthetic cancellation';
  c.holidays[1].status = 'active'; c.holidays[1].sourceIds = [source.id];
  const reviewed = confirmYear(data, 2027, 'test-amendment', 'partial').holidayCalendars[0];
  assert.deepEqual(reviewed.holidays.slice(0, 2), c.holidays.slice(0, 2));
  assert.equal(reviewed.coverage, 'partial');
  assert.deepEqual(reviewed.sourceIds, [source.id, 'test-amendment']);
});
