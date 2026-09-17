import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonical, changes, emptyCatalog, ENGINE_VERSION, normalize, validateCatalog, type Catalog, type Snapshot, type Workspace } from '../src/model.ts';
import { exportContent, validateWorkspace } from '../src/workspace.ts';

export class ConflictError extends Error {}
export function digest(text: string): string { return createHash('sha256').update(text).digest('hex'); }
export function buildExport(data: Catalog) {
  const { content, filename, dataVersion } = exportContent(data);
  return { filename, content, manifest: {
    schemaVersion: 2, dataVersion, engineVersion: ENGINE_VERSION,
    file: filename, sha256: digest(content), bytes: Buffer.byteLength(content),
  } };
}

export class Store {
  readonly directory: string;
  readonly file: string;
  constructor(directory: string) { this.directory = resolve(directory); this.file = join(this.directory, 'workspace.json'); }
  async initialize() {
    await mkdir(this.directory, { recursive: true });
    try { await writeFile(this.file, JSON.stringify({ revision: 0, data: emptyCatalog(), history: [] }, null, 2) + '\n', { flag: 'wx' }); }
    catch (error: any) { if (error.code !== 'EEXIST') throw error; }
    await this.read(); // Never replace an invalid existing workspace with an empty one.
  }
  async read(): Promise<Snapshot> {
    const raw = await readFile(this.file, 'utf8');
    const workspace = validateWorkspace(JSON.parse(raw));
    return { workspace, etag: digest(raw), engineVersion: ENGINE_VERSION };
  }
  async save(input: unknown, expected: string, note: string): Promise<Snapshot> {
    const data = normalize(validateCatalog(input));
    if (typeof note !== 'string' || !note.trim() || note.length > 2000) throw new Error('Enter a change note (maximum 2,000 characters)');
    const lockPath = join(this.directory, '.write.lock');
    let lock;
    try { lock = await open(lockPath, 'wx'); }
    catch (error: any) { if (error.code === 'EEXIST') throw new ConflictError('Another save is in progress. Reload the workspace before retrying.'); throw error; }
    let temporary: string | undefined;
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      const current = await this.read();
      if (current.etag !== expected) throw new ConflictError('The file changed since this draft was loaded. Download your draft, reload, and review the changes before saving.');
      const diff = changes(current.workspace.data, data);
      if (!diff.length) return current;
      const raw = await readFile(this.file, 'utf8');
      if (digest(raw) !== expected) throw new ConflictError('The workspace was edited during this save. Reload and try again.');
      const backupDirectory = join(this.directory, '.backups');
      await mkdir(backupDirectory, { recursive: true });
      try { await writeFile(join(backupDirectory, `${current.workspace.revision}-${expected}.json`), raw, { flag: 'wx' }); }
      catch (error: any) { if (error.code !== 'EEXIST') throw error; }
      const revision = current.workspace.revision + 1;
      const workspace: Workspace = { revision, data, history: [...current.workspace.history, { revision, at: new Date().toISOString(), note: note.trim(), changes: diff }] };
      temporary = join(this.directory, `${randomUUID()}.tmp`);
      const handle = await open(temporary, 'wx');
      try { await handle.writeFile(JSON.stringify(workspace, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
      if (digest(await readFile(this.file, 'utf8')) !== expected) throw new ConflictError('The workspace changed during this save. Your draft has not overwritten it.');
      await rename(temporary, this.file); temporary = undefined;
      return await this.read();
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
      await lock.close(); await unlink(lockPath);
    }
  }
  async export(expected: string) {
    const current = await this.read();
    if (current.etag !== expected) throw new ConflictError('The saved workspace changed. Reload before exporting.');
    const bundle = buildExport(current.workspace.data);
    const directory = join(this.directory, '.exports'); await mkdir(directory, { recursive: true });
    const record = join(directory, `${bundle.manifest.dataVersion}.json`);
    const serialized = JSON.stringify(bundle.manifest, null, 2) + '\n';
    try { await writeFile(record, serialized, { flag: 'wx' }); }
    catch (error: any) {
      if (error.code !== 'EEXIST') throw error;
      const previous = JSON.parse(await readFile(record, 'utf8'));
      if (canonical(previous) !== canonical(bundle.manifest)) throw new ConflictError('This data version was already exported with different content. Increase the data version, save, and export again.');
    }
    return bundle;
  }
}
