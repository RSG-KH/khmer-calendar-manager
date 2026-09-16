import { useEffect, useState } from 'react';
import { browserStore, validateBackup, type WorkspaceBackup } from './browser-store.ts';
import { changes, type Snapshot, type Workspace } from './model.ts';

type Props = {
  snapshot: Snapshot; dirty: boolean; busy: boolean;
  perform: (operation: () => Promise<void>) => Promise<void>;
  restored: (value: Snapshot) => void;
  download: (filename: string, content: string) => void;
  error: (error: unknown) => void;
};
export function WorkspaceBackupPanel({ snapshot, dirty, busy, perform, restored, download, error }: Props) {
  const [backup, setBackup] = useState<WorkspaceBackup | null>(null), [accepted, setAccepted] = useState(false);
  const [previous, setPrevious] = useState<Workspace[]>([]), [selected, setSelected] = useState('');
  useEffect(() => { void browserStore.backups().then(setPrevious).catch(error); }, [snapshot]);
  async function downloadSaved(workspace?: Workspace) {
    const value = await browserStore.backup();
    if (workspace) value.workspace = workspace;
    download(`manager-workspace-r${value.workspace.revision}.json`, JSON.stringify(value, null, 2) + '\n');
  }
  return <section className="panel padded">
    <p>Your saved catalog and history stay in this browser. Keep a downloaded copy before clearing site data or moving to another browser.</p>
    <button disabled={busy || dirty} onClick={() => void perform(() => downloadSaved())}>Download workspace</button>
    {dirty && <p className="muted">Save your draft first, or use Download draft to keep unsaved changes.</p>}
    {!!previous.length && <div className="backup-revision"><label className="field">Previous saved revision<select aria-label="Previous saved revision" value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose a backup</option>{previous.map((item, index) => <option key={index} value={index}>Revision {item.revision} · {item.history.at(-1)?.note ?? 'Empty workspace'}</option>)}</select></label><button disabled={busy || selected === ''} onClick={() => void perform(() => downloadSaved(previous[Number(selected)]))}>Download previous revision</button></div>}
    <label className="field">Open workspace backup<input type="file" aria-label="Open workspace backup" accept=".json,application/json" disabled={busy || dirty} onChange={e => {
      const file = e.target.files?.[0]; e.target.value = ''; setBackup(null); setAccepted(false);
      if (file) void perform(async () => { if (file.size > 8 * 1024 * 1024) throw new Error('Choose a backup smaller than 8 MB'); setBackup(validateBackup(JSON.parse(await file.text()))); });
    }} /></label>
    {backup && <div className="notice info"><div><h3>Review workspace restoration</h3><p>Revision {backup.workspace.revision} · {backup.workspace.data.sources.length} sources · {backup.workspace.data.events.length} events · {backup.workspace.data.holidayCalendars.length} holiday years · {changes(snapshot.workspace.data, backup.workspace.data).length} catalog changes.</p>
      <details><summary>Review backup catalog and history</summary><pre>{JSON.stringify(backup.workspace, null, 2)}</pre></details>
      <label className="checkbox"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />I reviewed this backup and want to replace the saved workspace. The current workspace will be backed up.</label>
      <button disabled={busy || dirty || !accepted} onClick={() => void perform(async () => { restored(await browserStore.restore(backup, snapshot.etag)); setBackup(null); setAccepted(false); })}>Restore workspace</button>
    </div></div>}
  </section>;
}
