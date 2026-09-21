// One-off data seed (v0.4.4): label the three Pchum Ben government leave days
// with their traditional per-day titles — 14 រោច as Ben 14, 15 រោច as
// Pchum Ben Festival (unchanged), and the travel-bonus day as Post Pchum Ben
// Festival. Every entry carries a note that the Anukret lists all three days
// as ពិធីបុណ្យភ្ជុំបិណ្ឌ (Pchum Ben Festival) and that these per-day labels
// are deliberate, so maintainers do not override them back. dataVersion 0.4.4.
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
next.dataVersion = '0.4.4';

function lunarDate(ruleInput: unknown, year: number): string {
  const rule = createRule(ruleInput as never);
  for (let anchor = year - 1; anchor <= year + 1; anchor++) {
    for (const occurrence of engine.evaluateRule(anchor, rule, undefined)) {
      if (occurrence.date.year === year) return occurrence.date.iso;
    }
  }
  throw new Error(`no date for rule in ${year}`);
}

const note = 'The official Anukret (sub-decree) lists all three Pchum Ben days as ពិធីបុណ្យភ្ជុំបិណ្ឌ (Pchum Ben Festival). This entry keeps a deliberate per-day title — Ben 14 (the 14 រោច Kan Ben day), Pchum Ben Festival (the 15 រោច climax) or Post Pchum Ben Festival (the travel-bonus day after the festival) — do not override these labels back to the single sub-decree title.';

let retitled = 0;
for (const calendar of next.holidayCalendars) {
  const rows = calendar.holidays.filter(h => h.eventId === 'ben_14' || h.eventId === 'pchum_ben_festival').sort((a, b) => a.dates[0] < b.dates[0] ? -1 : 1);
  if (rows.length !== 3) continue;
  const ben14 = lunarDate(next.events.find(e => e.id === 'ben_14')!.rule, calendar.year);
  const climax = lunarDate(next.events.find(e => e.id === 'pchum_ben_festival')!.rule, calendar.year);
  if (rows[0].dates[0] !== ben14) throw new Error(`${calendar.year}: first day ${rows[0].dates[0]} is not 14 រោច (${ben14})`);
  if (rows[1].dates[0] !== climax) throw new Error(`${calendar.year}: middle day ${rows[1].dates[0]} is not 15 រោច (${climax})`);
  rows[0].names = { en: 'Ben 14', km: 'បិណ្ឌ ១៤' };
  rows[1].names = { en: 'Pchum Ben Festival', km: 'ពិធី​បុណ្យ​ភ្ជុំ​បិណ្ឌ' };
  rows[2].names = { en: 'Post Pchum Ben Festival', km: 'ក្រោយពិធីបុណ្យភ្ជុំបិណ្ឌ' };
  for (const row of rows) row.note = note;
  retitled++;
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
      note: 'Title the three Pchum Ben leave days per tradition — Ben 14 (14 រោច), Pchum Ben Festival (15 រោច), Post Pchum Ben Festival (travel bonus) — and annotate every entry that the Anukret lists all three days as ពិធីបុណ្យភ្ជុំបិណ្ឌ so maintainers keep the deliberate per-day labels.',
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
  revision, dataVersion: data.dataVersion, holidayYearsRetitled: retitled,
  exportFile: bundle.filename, exportSha256: bundle.manifest.sha256,
}, null, 2));
