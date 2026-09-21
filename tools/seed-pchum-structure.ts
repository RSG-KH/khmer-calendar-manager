// One-off data seed: model Pchum Ben per tradition — the Kan Ben series runs
// 1–15 រោច with 15 រោច (Pchum Ben day) as the single climax. Adds Ben 14
// (14 រោច) as its own day, shrinks pchum_ben_festival from the 3-day block
// (offset −1, duration 3) to the single 15 រោច day (offset 0, duration 1),
// and re-links each official holiday calendar's first Pchum day (14 រោច) to
// ben_14. The government's three-day leave (14 រោច, 15 រោច, travel bonus)
// stays in the holiday layer. dataVersion 0.4.3.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GregorianDate, KhmerCalendarEngine, createRule } from 'khmer-calendar-engine';
import { changes, normalize, validateCatalog, type Catalog } from '../src/model.ts';
import { buildExport } from '../server/store.ts';
import { validateWorkspace } from '../src/workspace.ts';

const engine = new KhmerCalendarEngine();
const directory = fileURLToPath(new URL('../data/', import.meta.url));
const file = join(directory, 'workspace.json');
const raw = readFileSync(file, 'utf8');
const current = validateWorkspace(JSON.parse(raw));
const next: Catalog = structuredClone(current.data);
next.dataVersion = '0.4.3';

const template = next.events.find(e => e.id === 'ben_13');
if (!template) throw new Error('ben_13 template not found');
if (!next.events.some(e => e.id === 'ben_14')) {
  next.events.push({
    id: 'ben_14',
    kind: template.kind,
    names: { en: 'Ben 14', km: 'បិណ្ឌ ១៤' },
    sourceIds: [...template.sourceIds],
    rule: { ...template.rule, id: 'ben_14', day: 14 },
  });
}

const festival = next.events.find(e => e.id === 'pchum_ben_festival');
if (!festival?.rule) throw new Error('pchum_ben_festival rule not found');
festival.rule.offset = 0;
festival.rule.duration = 1;

// Engine-evaluate a lunar rule for one Gregorian year, returning ISO dates.
function lunarDates(ruleInput: unknown, year: number): string[] {
  const rule = createRule(ruleInput as never);
  const dates: string[] = [];
  for (let anchor = year - 1; anchor <= year + 1; anchor++) {
    for (const occurrence of engine.evaluateRule(anchor, rule, undefined)) {
      if (occurrence.date.year === year) dates.push(occurrence.date.iso);
    }
  }
  return [...new Set(dates)].sort();
}

let relinked = 0;
for (const calendar of next.holidayCalendars) {
  const rows = calendar.holidays.filter(h => h.eventId === 'pchum_ben_festival').sort((a, b) => a.dates[0] < b.dates[0] ? -1 : 1);
  if (rows.length !== 3) continue; // unexpected shape for that year — leave untouched
  const ben14 = lunarDates(next.events.find(e => e.id === 'ben_14')!.rule, calendar.year);
  const climax = lunarDates(festival.rule, calendar.year);
  if (ben14.length !== 1 || climax.length !== 1) throw new Error(`${calendar.year}: expected single 14រោច/15រោច dates, got ${ben14}/${climax}`);
  if (rows[0].dates[0] !== ben14[0]) throw new Error(`${calendar.year}: first holiday day ${rows[0].dates[0]} is not the engine's 14រោច (${ben14[0]})`);
  if (rows[1].dates[0] !== climax[0]) throw new Error(`${calendar.year}: middle holiday day ${rows[1].dates[0]} is not the engine's 15រោច (${climax[0]})`);
  rows[0].eventId = 'ben_14';
  relinked++;
}

const data = normalize(validateCatalog(next));
const diff = changes(current.data, data);
if (!diff.length) {
  console.log('No changes needed.');
  process.exit(0);
}

// Backup previous workspace
const backupDirectory = join(directory, '.backups');
mkdirSync(backupDirectory, { recursive: true });
const backupPath = join(backupDirectory, `${current.revision}-${createHash('sha256').update(raw).digest('hex')}.json`);
copyFileSync(file, backupPath);

const revision = current.revision + 1;
const workspace = {
  revision,
  data,
  history: [
    ...current.history,
    {
      revision,
      at: new Date().toISOString(),
      note: 'Model Pchum Ben per tradition: add Ben 14 (14 រោច), shrink pchum_ben_festival to the single 15 រោច climax day, and link each official calendar\'s first Pchum holiday day to ben_14; the government\'s three-day leave (14 រោច, 15 រោច, travel bonus) remains in the holiday layer.',
      changes: diff,
    },
  ],
};
writeFileSync(file, JSON.stringify(workspace, null, 2) + '\n');

const bundle = buildExport(data);
writeFileSync(join(directory, 'exports', bundle.filename), bundle.content);
mkdirSync(join(directory, '.exports'), { recursive: true });
writeFileSync(join(directory, '.exports', `${bundle.manifest.dataVersion}.json`), JSON.stringify(bundle.manifest, null, 2) + '\n');

console.log(JSON.stringify({
  revision, dataVersion: data.dataVersion, events: data.events.length, holidayYearsRelinked: relinked,
  exportFile: bundle.filename, exportSha256: bundle.manifest.sha256,
}, null, 2));
