import { useState, type SelectHTMLAttributes } from 'react';
import type { Catalog, Source } from './model.ts';
import { EditorDialog } from './EditorDialog.tsx';
import { SourceForm } from './forms.tsx';

export type SaveSource = (source: Source, existingId?: string) => void;

/** Adds a reference in context while the parent editor stays mounted. */
export function SourceControl({ data, saveSource, value = [], multiple = false, government = false, required = true, name = 'sourceIds', onValueChange, ...attributes }: {
  data: Catalog; saveSource: SaveSource; value?: string[]; multiple?: boolean; government?: boolean;
  onValueChange?: (ids: string[]) => void;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>) {
  const [selected, setSelected] = useState(value);
  const [editing, setEditing] = useState<string | null>(null), [error, setError] = useState<string>();
  const sources = data.sources.filter(s => !government || s.kind === 'government');
  function choose(ids: string[]) { setSelected(ids); onValueChange?.(ids); }
  function open(id: string) { setError(undefined); setEditing(id); }
  return <>
    <select {...attributes} name={name} multiple={multiple} size={multiple ? Math.min(3, Math.max(2, sources.length)) : undefined} required={required}
      value={multiple ? selected : selected[0] ?? ''} onChange={e => choose([...e.target.selectedOptions].map(o => o.value).filter(Boolean))}>
      {!multiple && <option value="">Choose a reference</option>}
      {sources.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
    </select>
    <div className="reference-actions"><button type="button" onClick={() => open('__new__')}>+ Add reference</button>{selected.map(id => {
      const source = sources.find(s => s.id === id);
      return source && <button type="button" key={id} onClick={() => open(id)}>Edit {selected.length > 1 ? source.title : 'reference'}</button>;
    })}</div>
    {editing !== null && <EditorDialog title={editing === '__new__' ? 'Add reference' : 'Edit reference'} error={error} close={() => setEditing(null)}>
      <SourceForm item={data.sources.find(s => s.id === editing)} government={government} cancel={() => setEditing(null)} attempt={fn => { try { fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }} save={source => {
        saveSource(source, editing === '__new__' ? undefined : editing);
        choose(multiple ? [...new Set([...selected, source.id])] : [source.id]);
        setEditing(null);
      }} />
    </EditorDialog>}
  </>;
}
