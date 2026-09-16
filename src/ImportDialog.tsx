import { useEffect, useState } from 'react';
import { type Catalog } from './model.ts';
import { planImport, type ImportPlan } from './imports.ts';
import { EditorDialog } from './EditorDialog.tsx';
import { Field } from './forms.tsx';
import { SourceControl, type SaveSource } from './SourceControl.tsx';
import { ChangeList, download } from './ReviewParts.tsx';

export function ImportDialog({ data, selectedYear, saveSource, apply, close }: {
  data: Catalog; selectedYear: number; saveSource: SaveSource; apply: (plan: ImportPlan) => void; close: () => void;
}) {
  const [content, setContent] = useState(''), [format, setFormat] = useState<'json' | 'csv'>('json');
  const [sourceId, setSourceId] = useState(''), [coverage, setCoverage] = useState<'partial' | 'complete'>('partial');
  const [plan, setPlan] = useState<ImportPlan | null>(null), [accepted, setAccepted] = useState(false), [error, setError] = useState<string>();
  useEffect(() => { setPlan(null); setAccepted(false); }, [data, content, format, sourceId, coverage, selectedYear]);
  function attempt(fn: () => void) { try { setError(undefined); fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }
  return <EditorDialog title="Import data" error={error} close={close}><section className="editor">
    <div className="section-heading"><h2>Import data</h2><p>JSON or CSV · review changes before applying.</p></div>
    {!plan ? <>
      <div className="form-grid"><Field label="Choose file"><input type="file" accept=".json,.csv" onChange={e => {
        const file = e.target.files?.[0];
        if (file) { if (file.size > 8 * 1024 * 1024) { setError('Choose a file smaller than 8 MB'); return; } void file.text().then(text => { setContent(text); setFormat(file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json'); setError(undefined); }).catch(e => setError(String(e))); }
      }} /></Field><Field label="Import format"><select value={format} onChange={e => setFormat(e.target.value as typeof format)}><option value="json">JSON</option><option value="csv">CSV</option></select></Field></div>
      {format === 'csv' && <><p>Holidays for {selectedYear}</p><Field label="Government source for CSV"><SourceControl data={data} saveSource={saveSource} government onValueChange={ids => setSourceId(ids[0] ?? '')} /></Field><Field label="CSV coverage"><select value={coverage} onChange={e => setCoverage(e.target.value as typeof coverage)}><option value="partial">Partial update — keep unlisted holidays</option><option value="complete">Complete list — replace this year</option></select></Field></>}
      <Field label="Import content"><textarea className="code-input" rows={7} value={content} onChange={e => setContent(e.target.value)} placeholder="Choose a file or paste its contents…" /></Field>
      <details className="disclosure"><summary>Download a template</summary><div className="row-actions"><button onClick={() => download('holidays-template.csv', 'id,en,km,start,end,status,eventId,note\n', 'text/csv')}>CSV template</button><button onClick={() => download('holidays-template.json', JSON.stringify({ schemaVersion: 1, type: 'official-holidays', year: selectedYear, coverage: 'partial', source: { id: '', kind: 'government', title: '', publisher: '', url: '', reference: '' }, holidays: [] }, null, 2))}>JSON template</button></div></details>
      <div className="form-actions"><button className="primary" disabled={!content.trim()} onClick={() => attempt(() => {
        const source = data.sources.find(s => s.id === sourceId);
        if (format === 'csv' && !source) throw new Error('Choose or add the government reference for this list.');
        setPlan(planImport(data, content, format, source ? { source, year: selectedYear, coverage } : undefined));
      })}>Review import</button><button onClick={close}>Cancel</button></div>
    </> : <>
      <h3>{plan.changes.length ? `${plan.changes.length} changes` : 'Already up to date'}</h3><p>{plan.description}</p>
      <ChangeList before={data} after={plan.data} list={plan.changes} />
      {(plan.conflicts.length > 0 || plan.destructive) && <label className="checkbox"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />I reviewed the replacements and removals and want to use the imported values.</label>}
      <div className="form-actions"><button className="primary" disabled={!plan.changes.length || ((plan.conflicts.length > 0 || plan.destructive) && !accepted)} onClick={() => attempt(() => apply(plan))}>Apply import</button><button onClick={() => setPlan(null)}>Back</button></div>
    </>}
  </section></EditorDialog>;
}
