// One-off data seed: carry the {anniversary} count in the English names of every
// recurring event with anniversaryBase (34 events), matching the Khmer
// ខួបលើកទី{anniversary} convention, so consumers render e.g.
// "Victory Over Genocide Day · 47th" from the catalog itself. dataVersion 0.4.1.
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
next.dataVersion = '0.4.1';

let updated = 0;
for (const event of next.events) {
  if (event.anniversaryBase === undefined) continue;
  if (!event.names.km.includes('{anniversary}')) throw new Error(`${event.id}: Khmer name lacks {anniversary}; review this event before extending English`);
  if (event.names.en.includes('{anniversary}')) continue;
  event.names.en = `${event.names.en} · {anniversary}`;
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
      note: 'Add {anniversary} to the English names of all 34 anniversary events (e.g. "Victory Over Genocide Day · {anniversary}" rendering as "· 47th"), matching the Khmer ខួបលើកទី count; consumers substitute year - anniversaryBase with an English ordinal.',
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
  englishNamesUpdated: updated, historyChanges: diff.length,
  exportFile: bundle.filename, exportBytes: bundle.manifest.bytes, exportSha256: bundle.manifest.sha256,
}, null, 2));
