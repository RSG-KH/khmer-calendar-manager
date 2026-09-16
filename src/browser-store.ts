import { canonical, changes, emptyCatalog, ENGINE_VERSION, normalize, object, validateCatalog, type Snapshot, type Workspace } from './model.ts';
import { exportContent, validateWorkspace, type ExportBundle, type ExportManifest } from './workspace.ts';

type State = { workspace: Workspace; exports: ExportManifest[]; backups: Workspace[]; token: string };
export type WorkspaceBackup = { format: 'khmer-calendar-manager'; schemaVersion: 1; workspace: Workspace; exports: ExportManifest[] };
const databaseName = 'khmer-calendar-manager';
const conflict = () => new Error('The saved workspace changed in another tab. Download your draft, discard it, reload, and review before saving.');

function emptyState(): State {
  return { workspace: { revision: 0, data: emptyCatalog(), history: [] }, exports: [], backups: [], token: 'initial' };
}
function snapshot(state: State): Snapshot { return { workspace: state.workspace, etag: state.token, engineVersion: ENGINE_VERSION }; }
async function sha256(content: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Read/compare/write happen in one IndexedDB transaction, including across tabs.
async function transaction<T>(write: boolean, operation: (state: State) => T): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Browser storage is unavailable'));
    request.onblocked = () => reject(new Error('Close other manager tabs and retry opening the workspace'));
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('workspace', write ? 'readwrite' : 'readonly');
      const store = tx.objectStore('workspace'), request = store.get('current');
      let result: T, failure: unknown;
      request.onsuccess = () => {
        try {
          const state = (request.result ?? emptyState()) as State;
          state.workspace = validateWorkspace(state.workspace);
          result = operation(state);
          if (write) store.put(state, 'current');
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Browser storage could not save the workspace. Download your draft and check available storage.'));
      tx.onerror = () => { failure ??= tx.error; };
    });
  } finally { db.close(); }
}

export function validateBackup(input: unknown): WorkspaceBackup {
  const value = object(input, 'workspace backup', ['format', 'schemaVersion', 'workspace', 'exports']);
  if (value.format !== 'khmer-calendar-manager' || value.schemaVersion !== 1 || !Array.isArray(value.exports)) throw new Error('Choose a manager workspace backup. Use Import data for a catalog or yearly holiday file.');
  const seen = new Set<string>();
  for (const input of value.exports) {
    const item = object(input, 'export record', ['schemaVersion', 'dataVersion', 'engineVersion', 'file', 'sha256', 'bytes']);
    if (item.schemaVersion !== 1 || typeof item.dataVersion !== 'string' || typeof item.engineVersion !== 'string' || typeof item.file !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || seen.has(item.dataVersion)) throw new Error('Invalid or duplicate export record in workspace backup');
    seen.add(item.dataVersion);
  }
  return { format: 'khmer-calendar-manager', schemaVersion: 1, workspace: validateWorkspace(value.workspace), exports: value.exports };
}

export const browserStore = {
  read: () => transaction(false, snapshot),
  save(input: unknown, expected: string, note: string): Promise<Snapshot> {
    const data = normalize(validateCatalog(input));
    if (typeof note !== 'string' || !note.trim() || note.length > 2000) throw new Error('Enter a change note (maximum 2,000 characters)');
    return transaction(true, state => {
      if (state.token !== expected) throw conflict();
      const diff = changes(state.workspace.data, data);
      if (!diff.length) return snapshot(state);
      state.backups = [...state.backups, state.workspace].slice(-20);
      const revision = state.workspace.revision + 1;
      state.workspace = { revision, data, history: [...state.workspace.history, { revision, at: new Date().toISOString(), note: note.trim(), changes: diff }] };
      state.token = crypto.randomUUID();
      return snapshot(state);
    });
  },
  async export(expected: string): Promise<ExportBundle> {
    const current = await browserStore.read();
    if (current.etag !== expected) throw conflict();
    const { content, filename, dataVersion } = exportContent(current.workspace.data);
    const manifest: ExportManifest = { schemaVersion: 1, dataVersion, engineVersion: ENGINE_VERSION, file: filename, sha256: await sha256(content), bytes: new TextEncoder().encode(content).byteLength };
    return transaction(true, state => {
      if (state.token !== expected) throw conflict();
      const previous = state.exports.find(item => item.dataVersion === dataVersion);
      if (previous && canonical(previous) !== canonical(manifest)) throw new Error('This data version was already exported with different content or engine version. Increase the data version, save, and export again.');
      if (!previous) state.exports.push(manifest);
      return { filename, content, manifest };
    });
  },
  backup(): Promise<WorkspaceBackup> {
    return transaction(false, state => ({ format: 'khmer-calendar-manager', schemaVersion: 1, workspace: state.workspace, exports: state.exports }));
  },
  backups(): Promise<Workspace[]> { return transaction(false, state => state.backups); },
  restore(input: unknown, expected: string): Promise<Snapshot> {
    const backup = validateBackup(input);
    return transaction(true, state => {
      if (state.token !== expected) throw conflict();
      const merged = new Map(state.exports.map(item => [item.dataVersion, item]));
      for (const item of backup.exports) {
        const existing = merged.get(item.dataVersion);
        if (existing && canonical(existing) !== canonical(item)) throw new Error(`Backup conflicts with previously exported version ${item.dataVersion}. Existing records have been preserved.`);
        merged.set(item.dataVersion, item);
      }
      state.backups = [...state.backups, state.workspace].slice(-20);
      state.workspace = backup.workspace;
      state.exports = [...merged.values()];
      state.token = crypto.randomUUID();
      return snapshot(state);
    });
  },
};
