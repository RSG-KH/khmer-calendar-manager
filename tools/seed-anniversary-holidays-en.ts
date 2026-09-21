// One-off data seed: carry the {anniversary} count in the English names of the
// official holiday entries linked to anniversaryBase events (68 entries, 7 events,
// 2016–2027), matching the Khmer side which already carries either the
// ខួបលើកទី{anniversary} placeholder (58 entries) or a baked count (10 entries,
// 2025–2026). dataVersion 0.4.2.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changes, normalize, validateCatalog, type Catalog } from '../src/model.ts';
import { buildExport } from '../server/store.ts';
import { validateWorkspace } from '../src/workspace.ts';

const directory = fileURLToPath(new URL('../data/', import.meta.url));
const file = join(directory, 'workspace.json');
const raw = readFileSync(file, 'utf8');
const current = validateWorkspace(JSON.parse(raw));
const next: Catalog = structuredClone(current.data);
next.dataVersion = '0.4.2';

const baseById = new Map(next.events.filter(e => e.anniversaryBase !== undefined).map(e => [e.id, e.anniversaryBase]));
let updated = 0;
for (const calendar of next.holidayCalendars) for (const holiday of calendar.holidays) {
  const base = baseById.get(holiday.eventId ?? holiday.id);
  if (base === undefined) continue;
  if (holiday.names.en.includes('{anniversary}')) continue;
  if (!holiday.names.km.includes('{anniversary}') && !holiday.names.km.includes('ខួបលើកទី'))
    throw new Error(`${calendar.year}/${holiday.id}: Khmer name carries no anniversary count; review before extending English`);
  holiday.names.en = `${holiday.names.en} · {anniversary}`;
  updated++;
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
      note: 'Add {anniversary} to the English names of the 68 official holiday entries linked to anniversaryBase events (7 events, 2016-2027), aligning with the Khmer side (58 placeholder + 10 baked 2025-2026 counts); consumers substitute year - anniversaryBase with an English ordinal.',
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
  revision, dataVersion: data.dataVersion, schemaVersion: data.schemaVersion,
  holidayEnglishNamesUpdated: updated, historyChanges: diff.length,
  exportFile: bundle.filename, exportBytes: bundle.manifest.bytes, exportSha256: bundle.manifest.sha256,
}, null, 2));
