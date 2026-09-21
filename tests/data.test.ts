import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonical, changes, ENGINE_VERSION, normalize, publicationIssues, validateCatalog, type Catalog, type NewYearArrival } from '../src/model.ts';
import { dateRange, parseCsv, planImport } from '../src/imports.ts';
import { preview } from '../src/preview.ts';
import { buildExport } from '../server/store.ts';
import { catalog, holidayImport, source } from './fixtures.ts';

test('engine preview includes second Asadh without implying an official holiday', () => {
  const result = preview(catalog(), 2026);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.rows.map(r => [r.date, r.basis, r.kind]), [['2026-07-30', 'Calculated', 'traditional']]);
});
test('historical original dates stay separate from explicit annual commemorations', () => {
  const data = catalog();
  data.events.push({ id: 'test-history', kind: 'historical', names: { en: 'Test historical event', km: 'សាកល្បង' }, sourceIds: [source.id], originalDate: '1993-09-24', dates: ['1993-09-24'] });
  assert.equal(preview(validateCatalog(data), 2026).rows.some(r => r.id === 'test-history'), false);
  const event = data.events[1]; delete event.dates;
  event.rule = { id: event.id, type: 'solar', month: 9, day: 24, fromYear: 1993 };
  assert.equal(preview(validateCatalog(data), 2026).rows.find(r => r.id === event.id)?.date, '2026-09-24');
  assert.equal(event.originalDate, '1993-09-24');
  event.rule.fromYear = 1900;
  assert.throws(() => validateCatalog(data), /cannot precede/);
  event.rule.fromYear = 1993; event.rule.month = 1; event.rule.day = 1;
  assert.equal(preview(validateCatalog(data), 1993).rows.some(r => r.id === event.id), false);
  data.overrides.push({ eventId: event.id, year: 1993, dates: ['1993-01-01'], sourceId: source.id, reason: 'Invalid test correction' });
  assert.throws(() => validateCatalog(data), /cannot precede/);
});
test('partial imports preserve omitted records; complete imports expose removals', () => {
  const first = planImport(catalog(), holidayImport(), 'json');
  assert.equal(first.data.holidayCalendars[0].holidays.length, 1);
  const another = { id: 'another', names: { en: 'Another test', km: 'សាកល្បង' }, dates: ['2026-01-01'], status: 'active' };
  const partial = planImport(first.data, holidayImport([another]), 'json');
  assert.equal(partial.data.holidayCalendars[0].holidays.length, 2);
  assert.equal(partial.destructive, false);
  const complete = planImport(partial.data, holidayImport([another], 'complete'), 'json');
  assert.equal(complete.data.holidayCalendars[0].holidays.length, 1);
  assert.ok(complete.changes.some(c => c.id === '2026/test-holiday' && c.action === 'removed'));
  assert.equal(complete.destructive, true);
  assert.deepEqual(planImport(complete.data, holidayImport([another], 'complete'), 'json').changes, []);
});
test('changed stable IDs are conflicts; a cancelled designation retains its record', () => {
  const first = planImport(catalog(), holidayImport(), 'json').data;
  const incoming = JSON.parse(holidayImport()); incoming.holidays[0].dates = ['2026-07-31'];
  assert.ok(planImport(first, JSON.stringify(incoming), 'json').conflicts.some(c => c.id === '2026/test-holiday'));
  incoming.holidays[0].status = 'cancelled'; incoming.holidays[0].note = 'Test cancellation';
  const result = planImport(first, JSON.stringify(incoming), 'json');
  assert.equal(preview(result.data, 2026).rows.find(r => r.kind === 'official')?.basis, 'Cancelled holiday');
  incoming.holidays[0].note = '';
  assert.throws(() => planImport(first, JSON.stringify(incoming), 'json'), /cancellation needs/);
});
test('CSV handles quoted commas, multiline text, escaped quotes and leap-day ranges', () => {
  const csv = '\uFEFFid,en,km,start,end,status,eventId,note\r\na,"Day, one",សាកល្បង,2024-02-28,2024-03-01,active,,"Line one\nLine ""two"""\r\n';
  const rows = parseCsv(csv);
  assert.equal(rows[0].en, 'Day, one'); assert.equal(rows[0].note, 'Line one\nLine "two"');
  const plan = planImport(catalog(), csv, 'csv', { source, year: 2024, coverage: 'partial' });
  assert.deepEqual(plan.data.holidayCalendars[0].holidays[0].dates, ['2024-02-28', '2024-02-29', '2024-03-01']);
  assert.throws(() => parseCsv('id,en,km,start\na,"bad,,2026-01-01'), /unclosed/);
  assert.throws(() => parseCsv('id,en,km,start,typo\na,x,y,2026-01-01,z'), /unknown column/);
  assert.throws(() => dateRange('2026-02-29'), /real Gregorian date/);
  assert.throws(() => dateRange('2026-12-31', '2027-01-01'), /within one year/);
});
test('invalid records and broken references are rejected before mutation', () => {
  const checks: ((d: any) => void)[] = [
    d => { d.events[0].rule.secondAsadh = true; },
    d => { delete d.events[0].rule.waxing; },
    d => { d.events[0].rule.day = 1.5; },
    d => { d.events[0].sourceIds = ['missing']; },
    d => { d.events.push(structuredClone(d.events[0])); },
    d => { d.sources[0].url = 'file:///private/file.pdf'; },
  ];
  for (const mutate of checks) { const data = catalog(); mutate(data); assert.throws(() => validateCatalog(data)); }
  const incoming = JSON.parse(holidayImport()); incoming.source.kind = 'calendar';
  assert.throws(() => planImport(catalog(), JSON.stringify(incoming), 'json'), /government source/);
  incoming.source.kind = 'government'; incoming.holidays[0].dates = ['2025-01-01'];
  assert.throws(() => planImport(catalog(), JSON.stringify(incoming), 'json'), /all dates must be in 2026/);
});
test('corrections and cancellations retain source provenance and anchor semantics', () => {
  const data = catalog();
  data.overrides.push({ eventId: 'test-lent', year: 2026, dates: ['2026-07-31'], sourceId: source.id, reason: 'Test correction' });
  assert.deepEqual(preview(validateCatalog(data), 2026).rows.map(r => [r.date, r.basis]), [['2026-07-31', 'Corrected']]);
  data.overrides[0].dates = [];
  assert.equal(preview(validateCatalog(data), 2026).rows.length, 0);
  data.overrides[0].year = 2012; data.overrides[0].dates = ['2026-07-29'];
  assert.equal(preview(validateCatalog(data), 2026).rows.filter(r => r.basis === 'Corrected').length, 1);
});
test('offsets crossing two years appear in the target year without swallowed errors', () => {
  const data = catalog(); data.events[0].rule = { id: 'test-lent', type: 'solar', month: 12, day: 31, offset: 366, duration: 366, fromYear: 2024, throughYear: 2024 };
  assert.ok(preview(validateCatalog(data), 2026).rows.some(r => r.date === '2026-12-31'));
  data.events[0].rule = { id: 'test-lent', type: 'solar', month: 1, day: 1, offset: -1 };
  assert.ok(preview(data, 1800).issues.length > 0);
});
test('exports are deterministic; incomplete translations remain editable drafts', () => {
  const data = planImport(catalog(), holidayImport(), 'json').data;
  const first = buildExport(data), reordered = structuredClone(data);
  reordered.sources.reverse(); reordered.events.reverse();
  assert.equal(buildExport(reordered).content, first.content);
  assert.equal(JSON.parse(first.content).dataVersion, data.dataVersion);
  assert.equal(first.manifest.engineVersion, ENGINE_VERSION);
  assert.equal(first.manifest.sha256.length, 64);
  assert.deepEqual(changes(data, reordered), []);
  data.events[0].names.km = '';
  assert.doesNotThrow(() => validateCatalog(data));
  assert.ok(publicationIssues(data).length); assert.throws(() => buildExport(data), /Complete both names/);
  assert.equal(canonical({ z: undefined, a: 1 }), '{"a":1}');
});
test('schema-v1 catalogs upgrade without losing existing records', () => {
  const legacy: any = catalog(); legacy.schemaVersion = 1; delete legacy.eventCalendars; delete legacy.newYearArrivals;
  const upgraded = validateCatalog(legacy);
  assert.equal(upgraded.schemaVersion, 2);
  assert.deepEqual(upgraded.eventCalendars, []);
  assert.equal(upgraded.events.length, legacy.events.length);
});
test('New Year arrival records enforce schema v3 and the engine festival start', () => {
  const base = catalog();
  const arrival: NewYearArrival = { year: 2026, localDate: '2026-04-14', localTime: '10:48', minuteOfDay: 648, second: null,
    precision: 'minute', role: 'traditional_arrival', grade: 'A', status: 'evidenced', sourceIds: [source.id],
    zoneStated: false, interpretedZone: 'Asia/Phnom_Penh', retrieved: '2026-09-18' };
  assert.equal(validateCatalog({ ...base, newYearArrivals: [arrival] }).newYearArrivals?.length, 1);
  const stripped: any = structuredClone(base); delete stripped.newYearArrivals;
  assert.throws(() => validateCatalog(stripped), /requires the arrival section/);
  const v2: any = structuredClone(base); v2.schemaVersion = 2; delete v2.newYearArrivals;
  assert.equal(validateCatalog(v2).schemaVersion, 2);
  assert.throws(() => validateCatalog({ ...v2, newYearArrivals: [arrival] }), /requires schemaVersion 3/);
  const checks: ((a: any) => void)[] = [
    a => { a.localDate = '2026-04-13'; },                     // not the engine festival start
    a => { a.localTime = '10:49'; },                          // clock no longer matches minuteOfDay
    a => { a.minuteOfDay = 649; },                            // out of sync with the clock
    a => { a.second = 30; },                                  // second value at minute precision
    a => { a.sourceIds = ['missing']; },                      // unknown source
    a => { a.zoneStated = 'no'; },                            // not a boolean
    a => { a.retrieved = '18/09/2026'; },                     // not an ISO date
    a => { delete a.grade; },                                 // evidenced records carry a grade
    a => { a.claims = [{ localDate: '2026-04-14', localTime: '10:48', precision: 'minute', sourceIds: [source.id] }]; },
  ];
  for (const mutate of checks) { const a = structuredClone(arrival); mutate(a); assert.throws(() => validateCatalog({ ...base, newYearArrivals: [a] })); }
  const disputed: NewYearArrival = { year: 2024, status: 'disputed', sourceIds: [source.id], zoneStated: false,
    interpretedZone: 'Asia/Phnom_Penh', retrieved: '2026-09-18',
    disputeReason: '22:24 versus 22:17:24; no official almanac acquired',
    claims: [
      { localDate: '2024-04-13', localTime: '22:24', precision: 'minute', sourceIds: [source.id] },
      { localDate: '2024-04-13', localTime: '22:17:24', precision: 'second', sourceIds: [source.id] },
      { localDate: '2024-04-13', localTime: '22:17', precision: 'minute', role: 'ceremony', sourceIds: [source.id] },
    ] };
  assert.equal(validateCatalog({ ...base, newYearArrivals: [disputed] }).newYearArrivals?.[0].claims?.length, 3);
  for (const mutate of [
    (d: any) => { delete d.disputeReason; },
    (d: any) => { d.claims = []; },
    (d: any) => { d.localTime = '22:24'; },
    (d: any) => { d.claims[1].localTime = '22:17'; },
    (d: any) => { d.claims[0].localDate = '2023-04-13'; },
  ] as ((d: any) => void)[]) { const d = structuredClone(disputed); mutate(d); assert.throws(() => validateCatalog({ ...base, newYearArrivals: [d] })); }
  const twin = { year: 2026, status: 'disputed', sourceIds: [source.id], zoneStated: false,
    interpretedZone: 'Asia/Phnom_Penh', retrieved: '2026-09-18', disputeReason: 'duplicate year',
    claims: [{ localDate: '2026-04-14', localTime: '10:48', precision: 'minute', sourceIds: [source.id] }] };
  assert.throws(() => validateCatalog({ ...base, newYearArrivals: [structuredClone(arrival), twin] }), /duplicate/);
  const data = { ...base, newYearArrivals: [structuredClone(arrival), structuredClone(disputed)] };
  assert.deepEqual(normalize(validateCatalog(data)).newYearArrivals?.map(r => r.year), [2024, 2026]); // normalized by year
  assert.ok(changes(base, data).some(c => c.section === 'New Year arrival' && c.action === 'added'));
});

test('workspace catalog contains 12 verified official holiday years (2016–2027)', async () => {
  const { readFile } = await import('node:fs/promises');
  const ws = JSON.parse(await readFile(new URL('../data/workspace.json', import.meta.url), 'utf8'));
  const catalog = validateCatalog(ws.data);
  assert.equal(publicationIssues(catalog).length, 0);
  assert.equal(catalog.holidayCalendars.length, 12);
  const years = catalog.holidayCalendars.map(c => c.year);
  assert.deepEqual(years, [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]);
  assert.ok(catalog.holidayCalendars.every(c => c.coverage === 'complete'));
  const totalHolidays = catalog.holidayCalendars.flatMap(c => c.holidays);
  assert.equal(totalHolidays.length, 283);
  assert.equal(catalog.dataVersion, '0.4.1');
  const subdecreeSources = catalog.sources.filter(s => s.id.startsWith('subdecree-'));
  assert.equal(subdecreeSources.length, 12);
  for (const s of subdecreeSources) {
    assert.ok(s.reference?.startsWith('📜 Anukret No. '), `reference starts with 📜 on ${s.id}`);
    assert.ok(s.notes?.startsWith('📜 អនុក្រឹត្យលេខ '), `notes starts with 📜 on ${s.id}`);
    const year = Number(s.id.split('-').pop());
    if (year <= 2024) {
      assert.ok(s.reference?.includes('signed by Prime Minister Hun Sen'), `English signatory for ${year}`);
      assert.ok(s.notes?.includes('ចុះហត្ថលេខាដោយ សម្តេចអគ្គមហាសេនាបតីតេជោ ហ៊ុន សែន នាយករដ្ឋមន្ត្រី'), `Khmer signatory for ${year}`);
    } else {
      assert.ok(s.reference?.includes('signed by Prime Minister Hun Manet'), `English signatory for ${year}`);
      assert.ok(s.notes?.includes('ចុះហត្ថលេខាដោយ សម្តេចមហាបវរធិបតី ហ៊ុន ម៉ាណែត នាយករដ្ឋមន្ត្រី'), `Khmer signatory for ${year}`);
    }
  }
});

test('workspace carries the arrival-time evidence dataset with TVK broadcast archive', async () => {
  const { readFile } = await import('node:fs/promises');
  const { engine } = await import('../src/model.ts');
  const ws = JSON.parse(await readFile(new URL('../data/workspace.json', import.meta.url), 'utf8'));
  const catalog = validateCatalog(ws.data);
  assert.equal(catalog.schemaVersion, 3);
  assert.equal(catalog.dataVersion, '0.4.1');
  const arrivals = catalog.newYearArrivals!;
  assert.equal(arrivals.length, 19);
  assert.deepEqual(arrivals.map(r => r.year),
    [1997, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  assert.ok(arrivals.every(r => r.status === 'evidenced'));
  // Evidence records never override the engine's validated festival dates.
  for (const record of arrivals) {
    assert.equal(record.localDate, engine.newYear(record.year).start.iso, String(record.year));
    assert.equal(record.localDate.slice(0, 4), String(record.year));
    assert.equal(record.grade, 'A');
  }
  const byYear = new Map(arrivals.map(r => [r.year, r]));
  assert.equal(byYear.get(2012)!.localTime, '19:11');       // upstream's Apr 14 is never reintroduced
  assert.equal(byYear.get(2015)!.localTime, '14:01');       // TVK Khmer text confirms 14:01 (not 14:02)
  assert.equal(byYear.get(2017)!.localTime, '03:12');       // TVK Khmer text confirms 03:12
  assert.equal(byYear.get(2020)!.localTime, '20:48');       // TVK Facebook announcement resolves 2020 on 13 April
  assert.equal(byYear.get(2021)!.localTime, '04:00');
  assert.equal(byYear.get(2023)!.localTime, '16:00');
  assert.equal(byYear.get(2024)!.localTime, '22:17:24');    // TVK official broadcast resolves 2024 with second precision
  assert.equal(byYear.get(2024)!.precision, 'second');
  assert.equal(byYear.get(2024)!.second, 24);
  assert.equal(byYear.get(2025)!.minuteOfDay, 288);          // AKP + TVK grade A
  assert.equal(byYear.get(2026)!.minuteOfDay, 648);
  for (const year of [2025, 2026]) {
    const record = byYear.get(year)!;
    assert.ok(record.sourceIds.some(id => id.startsWith('arrival-s2')));
    assert.ok(record.sourceIds.some(id => id.startsWith('arrival-tvk-')));
  }
  // No event or holiday title embeds a clock time anywhere in the catalog.
  const titled = [...catalog.events.map(e => e.names), ...catalog.holidayCalendars.flatMap(c => c.holidays.map(h => h.names))];
  assert.ok(!titled.some(names => /\d{1,2}:\d{2}/.test(names.en) || /\d{1,2}:\d{2}/.test(names.km) || /[០-៩]{2}:[០-៩]{2}/.test(names.km)));
  const day1Names = catalog.holidayCalendars.flatMap(c => c.holidays.filter(h => h.eventId === 'khmer_new_year_1').map(h => h.names.en));
  assert.equal(day1Names.length, 12);                              // every confirmed year 2016–2027
  assert.equal(new Set(day1Names).size, 1);                        // one canonical day-1 name, no clocks
  assert.equal(day1Names[0], 'Khmer New Year – Moha Sankranta');
});
