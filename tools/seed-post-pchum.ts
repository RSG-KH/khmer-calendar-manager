// One-off data seed (v0.4.5): calculate Post Pchum Ben Festival (the
// travel-bonus day after the 15 រោច climax) as its own event so years
// without a sub-decree (1800–2015, 2028–2200) list it again, as the former
// 3-day festival block did. The 2016–2027 holiday entries re-link to the new
// event so official years merge into one row per day. dataVersion 0.4.4 (composed with seed-pchum-titles into the single 0.4.4 release).
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KhmerCalendarEngine, createRule } from 'khmer-calendar-engine';
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

const festival = next.events.find(e => e.id === 'pchum_ben_festival');
if (!festival?.rule) throw new Error('pchum_ben_festival rule not found');
if (!next.events.some(e => e.id === 'post_pchum_ben_festival')) {
  next.events.push({
    id: 'post_pchum_ben_festival',
    kind: festival.kind,
    names: { en: 'Post Pchum Ben Festival', km: 'ក្រោយពិធីបុណ្យភ្ជុំបិណ្ឌ' },
    sourceIds: [...festival.sourceIds],
    rule: { ...festival.rule, id: 'post_pchum_ben_festival', offset: 1 },
  });
}

function lunarDate(ruleInput: unknown, year: number): string {
  const rule = createRule(ruleInput as never);
  for (let anchor = year - 1; anchor <= year + 1; anchor++) {
    for (const occurrence of engine.evaluateRule(anchor, rule, undefined)) {
      if (occurrence.date.year === year) return occurrence.date.iso;
    }
  }
  throw new Error(`no date for rule in ${year}`);
}

let relinked = 0;
for (const calendar of next.holidayCalendars) {
  const rows = calendar.holidays.filter(h => h.eventId === 'ben_14' || h.eventId === 'pchum_ben_festival').sort((a, b) => a.dates[0] < b.dates[0] ? -1 : 1);
  if (rows.length !== 3) continue;
  const post = lunarDate(next.events.find(e => e.id === 'post_pchum_ben_festival')!.rule, calendar.year);
  if (rows[2].dates[0] !== post) throw new Error(`${calendar.year}: bonus day ${rows[2].dates[0]} is not the day after the climax (${post})`);
  rows[2].eventId = 'post_pchum_ben_festival';
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
      note: 'Calculate Post Pchum Ben Festival (the travel-bonus day after the 15 រោច climax) as its own event so sub-decree-less years list it again, and re-link the 2016–2027 bonus-day holiday entries to it.',
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
