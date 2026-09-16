import { useEffect, useState } from 'react';
import { Field } from './forms.tsx';
import { type Catalog } from './model.ts';
import { SourceControl, type SaveSource } from './SourceControl.tsx';

export function YearReview({ data, selectedYear, saveSource, confirm, cancel }: {
  data: Catalog; selectedYear: number; saveSource: SaveSource;
  confirm: (sourceId: string, coverage: 'partial' | 'complete') => void; cancel: () => void;
}) {
  const [sourceId, setSourceId] = useState(''), [coverage, setCoverage] = useState<'partial' | 'complete'>('complete');
  const [reviewed, setReviewed] = useState(false);
  useEffect(() => setReviewed(false), [data, selectedYear]);
  const source = data.sources.find(s => s.id === sourceId && s.kind === 'government');
  return <section className="editor">
    <div className="section-heading"><h2>Confirm {selectedYear} holidays</h2></div>
    <Field label="Publication checked"><SourceControl data={data} saveSource={saveSource} government onValueChange={ids => { setSourceId(ids[0] ?? ''); setReviewed(false); }} /></Field>
    <Field label="Reviewed coverage"><select value={coverage} onChange={e => { setCoverage(e.target.value as typeof coverage); setReviewed(false); }}><option value="complete">Complete yearly list</option><option value="partial">Only part of the yearly list</option></select></Field>
    {source?.url && <a href={source.url} target="_blank" rel="noreferrer">Open publication ↗</a>}
    <label className="checkbox"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I checked the holidays and dates against this announcement.</label>
    <div className="form-actions"><button className="primary" disabled={!reviewed || !source} onClick={() => confirm(sourceId, coverage)}>Confirm reviewed year</button><button onClick={cancel}>Keep editing</button></div>
  </section>;
}

export function PublicationPreview({ onFileChange }: { onFileChange: (hasFile: boolean) => void }) {
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) { setUrl(''); return; }
    const next = URL.createObjectURL(file); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return <section className="panel padded publication-preview">
    <h2>Announcement</h2>
    <Field label="PDF or photo"><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => {
      const selected = e.target.files?.[0];
      const next = selected && ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(selected.type) ? selected : null;
      setFile(next); onFileChange(!!next);
    }} /></Field>
    {file && url ? <>{file.type === 'application/pdf' ? <iframe title="Government announcement PDF" src={url} /> : <a href={url} target="_blank" rel="noreferrer" title="Open full-size announcement"><img src={url} alt="Government announcement preview" /></a>}</> : <p className="announcement-empty">Open the announcement to check its dates alongside the list.</p>}
  </section>;
}
