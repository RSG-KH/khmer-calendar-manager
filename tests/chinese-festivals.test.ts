import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCatalog } from '../src/model.ts';
import { preview } from '../src/preview.ts';

test('Chinese traditional festivals calculate via dynamic lunisolar rules with legacy archive parity', () => {
  const raw = JSON.parse(readFileSync(new URL('../data/workspace.json', import.meta.url), 'utf8'));
  const catalog = validateCatalog(raw.data);

  const festivalIds = [
    'chinese_new_year_days', 'chinese_new_year_eve', 'chinese_kitchen_god_festival',
    'chinese_spirit_parade', 'chinese_zongzi_festival', 'chinese_ghost_festival',
    'chinese_mid_autumn_festival', 'chinese_qingming_festival', 'chinese_winter_solstice'
  ];

  for (const id of festivalIds) {
    const event = catalog.events.find(e => e.id === id);
    assert.ok(event, `Expected event ${id} to exist`);
    assert.equal(event.dates, undefined, `Event ${id} should use dynamic recurrence instead of static dates`);
    assert.equal(event.rule?.type, 'chinese_festival', `Event ${id} should have rule type chinese_festival`);
    assert.equal(event.rule?.monthPolicy, 'cn-reference-utc8', `Event ${id} should use cn-reference-utc8 profile`);
  }

  // 3 documented legacy archive anomalies preserved via explicit overrides
  const overrides = catalog.overrides.filter(o => festivalIds.includes(o.eventId));
  assert.equal(overrides.length, 3);
  assert.ok(overrides.some(o => o.eventId === 'chinese_qingming_festival' && o.year === 2009 && o.dates[0] === '2009-04-05'));
  assert.ok(overrides.some(o => o.eventId === 'chinese_zongzi_festival' && o.year === 2013 && o.dates[0] === '2013-06-13'));
  assert.ok(overrides.some(o => o.eventId === 'chinese_qingming_festival' && o.year === 2029 && o.dates[0] === '2029-04-05'));

  // Test dynamic calculations beyond the 2000-2030 archive range
  const preview2035 = preview(catalog, 2035);
  assert.deepEqual(preview2035.issues, []);
  // CNY 2035 (Year of the Rabbit): Lunar 01/01 is 2035-02-08
  const cny2035 = preview2035.rows.filter(r => r.id === 'chinese_new_year_days');
  assert.deepEqual(cny2035.map(r => r.date), ['2035-02-08', '2035-02-09', '2035-02-10']);

  // Mid-Autumn 2035: Lunar 08/15 is 2035-09-16
  const midAutumn2035 = preview2035.rows.find(r => r.id === 'chinese_mid_autumn_festival');
  assert.equal(midAutumn2035?.date, '2035-09-16');
});
