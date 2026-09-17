import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRule, type RuleInput } from 'khmer-calendar-engine';
import { engine, normalize, validateCatalog, type Catalog, type Event, type EventOccurrence, type Source } from '../src/model.ts';
import { exportContent } from '../src/workspace.ts';

const expectedHashes = {
  events: '3770e0290bd2131c35140bb68a0264cc5adfe5b313a137b66d2b726c0eb6fa8c',
  rules: '6396ba90d6d36af1b1c756a156860a053c260351c6e9babdfbb3b771121a18f5',
  translations: '1f8e24a3e53290c4bb3d1024c37fcb0fed2f17d420b11e3fb4ef81c27d4fed77',
};
const args = process.argv.slice(2);
function option(name: string, fallback: string): string {
  const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] ?? (() => { throw new Error(`${name} needs a path`); })();
}
const managerRoot = resolve(import.meta.dirname, '..');
const androidRoot = resolve(option('--android-root', resolve(managerRoot, '..', 'khmer-calendar')));
const output = resolve(option('--output', resolve(managerRoot, 'data', 'migrations', 'android-archive-and-rules.json')));
const check = args.includes('--check');
const paths = {
  events: resolve(androidRoot, 'app/src/main/resources/calendar-events.tsv'),
  rules: resolve(androidRoot, 'tools/recurring-event-rules.json'),
  translations: resolve(androidRoot, 'translations/catalog.json'),
};
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const inputs = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([name, path]) => [name, await readFile(path, 'utf8')]))) as Record<keyof typeof paths, string>;
for (const name of Object.keys(paths) as (keyof typeof paths)[]) {
  const actual = sha256(inputs[name]);
  if (actual !== expectedHashes[name]) throw new Error(`${name} input changed: expected ${expectedHashes[name]}, got ${actual}. Review the source diff before updating the migration.`);
}

type AndroidRule = {
  id: string; titleKey: string; comparisonKey: string; type: RuleInput['type']; month: number; day: number;
  waxing: boolean; offset: number; duration: number; fromYear: number; throughYear: number;
  anniversaryBase: number | null; monthPolicy?: string;
};
type Translation = { id: string; en: string; km: string; occurrences?: { id: string; date: string }[] };
const manifest = JSON.parse(inputs.rules) as { format: number; rules: AndroidRule[] };
const translations = JSON.parse(inputs.translations) as { entries: Translation[] };
if (manifest.format !== 1 || manifest.rules.length !== 100) throw new Error('Expected the reviewed 100-rule Android manifest');
const entries = new Map(translations.entries.map(entry => [entry.id, entry]));

const websiteSource: Source = {
  id: 'khmer-lunar-calendar-capture-2026-09-10',
  title: 'Khmer Lunar Calendar website capture, 2000–2030', publisher: 'Khmer Lunar Calendar', kind: 'calendar',
  url: 'https://khmer-lunar-calendar.com/', reference: 'Captured 10 September 2026',
  notes: `Imported from calendar-events.tsv SHA-256 ${expectedHashes.events}; recurrence rules SHA-256 ${expectedHashes.rules}; translation catalog SHA-256 ${expectedHashes.translations}. The capture records what the website displayed; it is not a government holiday designation.`,
};
const governmentSources = new Map<string, Source>([
  ['https://mef.gov.kh/calendar-holiday-2025/', {
    id: 'mef-holiday-calendar-2025', title: '2025 calendar of public holidays',
    publisher: 'Ministry of Economy and Finance', kind: 'government', url: 'https://mef.gov.kh/calendar-holiday-2025/',
  }],
  ['https://lrc.gov.kh/en/annual-holiday-calendar-2026/', {
    id: 'lrc-annual-holiday-calendar-2026', title: 'Annual holiday calendar 2026',
    publisher: 'Legal Reform Committee', kind: 'government', url: 'https://lrc.gov.kh/en/annual-holiday-calendar-2026/',
  }],
]);

function managerRule(rule: AndroidRule): RuleInput {
  const common = {
    id: rule.id, type: rule.type, offset: rule.type === 'solar_nth_weekday' ? 0 : rule.offset,
    duration: rule.duration, fromYear: rule.fromYear, throughYear: rule.throughYear,
  };
  if (rule.type === 'solar') return { ...common, month: rule.month, day: rule.day } as RuleInput;
  if (rule.type === 'solar_nth_weekday') return { ...common, month: rule.month, day: rule.day, occurrence: rule.offset } as RuleInput;
  if (rule.type === 'khmer_lunar') return { ...common, month: rule.month, day: rule.day, waxing: rule.waxing, monthPolicy: rule.monthPolicy ?? 'exact' } as RuleInput;
  return common as RuleInput;
}
const events: Event[] = manifest.rules.map(rule => {
  const title = entries.get(rule.titleKey);
  if (!title?.en || !title.km) throw new Error(`Missing bilingual title ${rule.titleKey}`);
  return {
    id: rule.id, kind: 'observance', names: { en: title.en, km: title.km }, sourceIds: [websiteSource.id],
    rule: managerRule(rule), ...(rule.anniversaryBase === null ? {} : { anniversaryBase: rule.anniversaryBase }),
  };
});
const eventIds = new Set(events.map(event => event.id));
const occurrenceRule = new Map<string, string>();
for (const rule of manifest.rules) {
  const comparison = entries.get(rule.comparisonKey);
  if (!comparison) throw new Error(`Missing comparison entry ${rule.comparisonKey}`);
  for (const occurrence of comparison.occurrences ?? []) {
    const previous = occurrenceRule.get(occurrence.id);
    if (previous && previous !== rule.id) throw new Error(`Occurrence ${occurrence.id} maps to both ${previous} and ${rule.id}`);
    occurrenceRule.set(occurrence.id, rule.id);
  }
}

const rows = inputs.events.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
  const fields = line.split('\t');
  if (fields.length !== 5) throw new Error('Invalid calendar-events.tsv row');
  const [id, date, km, en, officialSourceUrl] = fields;
  return { id, date, names: { en, km }, officialSourceUrl, eventId: occurrenceRule.get(id) };
});
if (rows.length !== 3246 || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Expected 3,246 unique archived occurrences');
const years = Array.from({ length: 31 }, (_, index) => 2000 + index);
const eventCalendars = years.map(year => ({
  year, coverage: 'complete' as const, sourceIds: [websiteSource.id],
  events: rows.filter(row => Number(row.date.slice(0, 4)) === year).map<EventOccurrence>(row => ({
    id: row.id, date: row.date, kind: 'observance', names: row.names, sourceIds: [websiteSource.id],
    ...(row.eventId ? { eventId: row.eventId } : {}),
  })),
}));
const holidayCalendars = [2025, 2026].map(year => {
  const selected = rows.filter(row => Number(row.date.slice(0, 4)) === year && row.officialSourceUrl);
  if (selected.length !== 22 || new Set(selected.map(row => row.officialSourceUrl)).size !== 1) throw new Error(`Expected 22 sourced holidays in ${year}`);
  const source = governmentSources.get(selected[0].officialSourceUrl);
  if (!source) throw new Error(`Unknown government source ${selected[0].officialSourceUrl}`);
  return {
    year, coverage: 'complete' as const, sourceIds: [source.id], holidays: selected.map(row => ({
      id: row.id, names: row.names, dates: [row.date], status: 'active' as const, sourceIds: [source.id],
      ...(row.eventId && eventIds.has(row.eventId) ? { eventId: row.eventId } : {}),
    })),
  };
});

const overrides: Catalog['overrides'] = [];
for (const event of events) for (const year of years) {
  const expected = rows.filter(row => row.eventId === event.id && Number(row.date.slice(0, 4)) === year).map(row => row.date).sort();
  const actual = engine.evaluateRule(year, createRule(event.rule!)).map(value => value.date.iso).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) overrides.push({
    eventId: event.id, year, dates: expected, sourceId: websiteSource.id,
    reason: 'Preserve the complete dated occurrence list captured for this year.',
  });
}
if (overrides.length !== 15 || overrides.some(item => item.eventId !== 'king_sihamoni_birthday')) throw new Error('Unexpected archive/rule differences');

const catalog = normalize(validateCatalog({
  schemaVersion: 2, dataVersion: '0.2.0',
  sources: [websiteSource, ...governmentSources.values()], events, eventCalendars, holidayCalendars, overrides,
}));
const exported = exportContent(catalog);
const serialized = JSON.stringify(catalog, null, 2) + '\n';
if (check) {
  const existing = await readFile(output, 'utf8');
  if (existing !== serialized) throw new Error(`Generated catalog is stale: ${output}`);
} else {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, serialized, 'utf8');
}
console.log(JSON.stringify({
  output, checked: check, schemaVersion: catalog.schemaVersion, dataVersion: catalog.dataVersion,
  rules: catalog.events.length, recordedYears: catalog.eventCalendars.length,
  recordedOccurrences: catalog.eventCalendars.flatMap(calendar => calendar.events).length,
  linkedOccurrences: catalog.eventCalendars.flatMap(calendar => calendar.events).filter(event => event.eventId).length,
  overrides: catalog.overrides.length, officialHolidays: catalog.holidayCalendars.flatMap(calendar => calendar.holidays).length,
  exportBytes: Buffer.byteLength(exported.content),
}, null, 2));
