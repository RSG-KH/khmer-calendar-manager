import { useEffect, useMemo, useState } from 'react';
import { changes, emptyCatalog, engine, ENGINE_VERSION, normalize, publicationIssues, validateCatalog, type Catalog, type Snapshot } from './model.ts';
import { EventForm, Field, HolidayForm, OverrideForm } from './forms.tsx';
import { api, browserMode } from './storage.ts';
import { WorkspaceBackupPanel } from './WorkspaceBackupPanel.tsx';
import { confirmYear, generateYear } from './generate-year.ts';
import { YearReview } from './YearTools.tsx';
import { EditorDialog } from './EditorDialog.tsx';
import { CalendarWorkspace } from './CalendarWorkspace.tsx';
import { ImportDialog } from './ImportDialog.tsx';
import { ChangeList, download, Empty } from './ReviewParts.tsx';
import type { SaveSource } from './SourceControl.tsx';

type Step = 'calendar' | 'review' | 'export';
type Editor = { kind: 'holiday' | 'event'; id?: string };
const steps: [Step, string][] = [['calendar', 'Calendar'], ['review', 'Review & save'], ['export', 'Export']];
const calendarYears = Array.from({ length: engine.maxYear - engine.minYear + 1 }, (_, index) => engine.minYear + index);

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [draft, setDraft] = useState<Catalog>(emptyCatalog);
  const [step, setStep] = useState<Step>('calendar'), [editing, setEditing] = useState<Editor | null>(null);
  const [adjusting, setAdjusting] = useState<{ eventId: string; year: number } | null>(null);
  const [reviewingYear, setReviewingYear] = useState<number | null>(null), [importing, setImporting] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [adjustmentError, setAdjustmentError] = useState<string>();
  const [note, setNote] = useState(''), [bundle, setBundle] = useState<any>(null);
  const diff = useMemo(() => snapshot ? changes(snapshot.workspace.data, draft) : [], [snapshot, draft]);
  const dirty = diff.length > 0, issues = publicationIssues(draft);
  const pendingYears = draft.holidayCalendars.filter(c => c.holidays.some(h => h.status === 'draft'));
  function attempt(fn: () => void) { try { setMessage(null); fn(); } catch (error) { setMessage({ text: error instanceof Error ? error.message : String(error), error: true }); } }
  async function perform(fn: () => Promise<void>) { setBusy(true); try { await fn(); } catch (error) { setMessage({ text: error instanceof Error ? error.message : String(error), error: true }); } finally { setBusy(false); } }
  async function load() { await perform(async () => {
    const value = await api('workspace') as Snapshot;
    if (!snapshot && value.workspace.data.holidayCalendars.length) setSelectedYear(value.workspace.data.holidayCalendars.at(-1)!.year);
    setSnapshot(value); setDraft(value.workspace.data); setEditing(null); setBundle(null); setMessage(null);
  }); }
  useEffect(() => { void load(); }, []);
  useEffect(() => setBundle(null), [draft]);
  useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  useEffect(() => { if (message && !message.error) { const timer = setTimeout(() => setMessage(null), 4500); return () => clearTimeout(timer); } }, [message]);
  function navigate(next: Step) { setStep(next); setMessage(null); }
  function update(change: (data: Catalog) => void, description: string) {
    const next = structuredClone(draft); change(next); setDraft(normalize(validateCatalog(next))); setNote(description); setMessage({ text: description });
  }
  function openEditor(kind: Editor['kind'], id?: string) { setMessage(null); setEditing({ kind, id }); }
  const saveSource: SaveSource = (source, existingId) => {
    if (!existingId && draft.sources.some(s => s.id === source.id)) throw new Error(`Reference “${source.id}” already exists. Choose it from the list.`);
    update(d => { d.sources = [...d.sources.filter(s => s.id !== source.id), source]; }, `${existingId ? 'Updated' : 'Added'} reference ${source.id}`);
  };
  const calendar = draft.holidayCalendars.find(c => c.year === selectedYear);
  const event = editing?.kind === 'event' ? draft.events.find(e => e.id === editing.id) : undefined;
  const holiday = editing?.kind === 'holiday' ? calendar?.holidays.find(h => h.id === editing.id) : undefined;
  const adjustment = adjusting ? draft.overrides.find(o => o.eventId === adjusting.eventId && o.year === adjusting.year) : undefined;
  return <div className="workspace">
    <header className="app-header"><div className="header-main">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('calendar'); }}><img className="brand-mark" src={`${import.meta.env.BASE_URL}icons/khmer-calendar.png`} width="40" height="40" alt="" /><span>Khmer Calendar<strong>Event manager</strong></span></a>
      <div className="header-summary">
        <dl className="header-overview" aria-label="Workspace overview"><div><dt>Recorded years</dt><dd>{draft.eventCalendars.length}</dd></div><div><dt>Rules</dt><dd>{draft.events.length}</dd></div><div><dt>Holiday years</dt><dd>{draft.holidayCalendars.length}</dd></div><div><dt>Arrival years</dt><dd>{draft.newYearArrivals?.length ?? 0}</dd></div><div><dt>References</dt><dd>{draft.sources.length}</dd></div></dl>
        <span className="status header-status"><span className={`status-dot ${dirty ? 'dirty' : ''}`} />{snapshot ? dirty ? `${diff.length} unsaved changes` : `Saved · revision ${snapshot.workspace.revision}` : 'Opening workspace…'}</span>
      </div>
      <div className="year-picker"><label>Year<select aria-label="Selected year" value={selectedYear} onChange={e => { setSelectedYear(Number(e.target.value)); setMessage(null); }}>{calendarYears.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
    </div></header>
    <main>
      <nav className="workflow" aria-label="Progress"><ol>{steps.map(([id, label], index) => <li key={id}><button aria-current={step === id ? 'step' : undefined} onClick={() => navigate(id)}><span className="step-number" aria-hidden>{index + 1}</span><span>{label}</span></button></li>)}</ol></nav>
      {message && !(message.error && (editing || reviewingYear !== null)) && <div className={`notice ${message.error ? 'error' : 'success'}`} role={message.error ? 'alert' : 'status'}><span>{message.text}</span><button aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button></div>}
      {!snapshot ? <section className="panel"><Empty title={busy ? 'Opening the catalog…' : 'Workspace unavailable'}>{busy ? 'Loading saved records.' : <button onClick={() => void load()}>Retry connection</button>}</Empty></section> : <>
        <CalendarWorkspace data={draft} selectedYear={selectedYear} hidden={step !== 'calendar'} edit={openEditor} importData={() => setImporting(true)} generate={() => attempt(() => update(d => { d.holidayCalendars = generateYear(d, selectedYear).holidayCalendars; }, `Generated ${selectedYear} holidays for review`))} />
        {step === 'review' && <>
          {pendingYears.length > 0 && <section className="panel review-years">{pendingYears.map(c => <div key={c.year}><div><strong>{c.year} holidays</strong><p>{c.holidays.filter(h => h.status === 'draft').length} awaiting review against the announcement</p></div><button onClick={() => { setMessage(null); setReviewingYear(c.year); }}>Confirm {c.year}</button></div>)}</section>}
          <section className="panel padded"><div className="section-heading"><h2>{dirty ? `${diff.length} changes to save` : 'Your catalog is saved'}</h2>{dirty && <p>You can save unfinished work and confirm the holidays later.</p>}</div>
            <div className="form-grid"><Field label="Data version" help="Increase before exporting changed data."><input value={draft.dataVersion} onChange={e => setDraft({ ...draft, dataVersion: e.target.value })} /></Field>{dirty && <Field label="Change note"><input value={note} onChange={e => setNote(e.target.value)} placeholder="What changed?" /></Field>}</div>
            {dirty && <><details className="disclosure"><summary>Inspect {diff.length} changes</summary><ChangeList before={snapshot.workspace.data} after={draft} list={diff} /></details><div className="form-actions"><button className="primary" disabled={busy || !note.trim()} onClick={() => void perform(async () => { const saved = await api('save', { data: draft, expected: snapshot.etag, note }) as Snapshot; setSnapshot(saved); setDraft(saved.workspace.data); setNote(''); setMessage({ text: `Saved revision ${saved.workspace.revision}.` }); })}>Save changes</button></div></>}
            <details className="disclosure"><summary>Draft & recovery tools</summary><div className="row-actions"><button disabled={busy} onClick={() => download(`draft-${draft.dataVersion}.json`, JSON.stringify(normalize(draft), null, 2) + '\n')}>Download draft</button><button disabled={busy || !dirty} onClick={() => { setDraft(snapshot.workspace.data); setNote(''); setMessage(null); }}>Discard draft</button><button disabled={busy || dirty} onClick={() => void load()}>{browserMode ? 'Reload saved workspace' : 'Reload saved file'}</button></div></details>
          </section>
          {browserMode && <details className="panel disclosure-panel"><summary>Workspace backups</summary><WorkspaceBackupPanel snapshot={snapshot} dirty={dirty} busy={busy} perform={perform} download={download} error={error => setMessage({ text: String(error), error: true })} restored={value => { setSnapshot(value); setDraft(value.workspace.data); setNote(''); setBundle(null); setMessage({ text: `Restored workspace revision ${value.workspace.revision}.` }); }} /></details>}
          <details className="panel disclosure-panel"><summary>Saved history</summary><div className="disclosure-body">{!snapshot.workspace.history.length ? <p>No saves yet.</p> : <ol className="history">{[...snapshot.workspace.history].reverse().map(h => <li key={h.revision}><span className="history-number">{h.revision}</span><div><strong>{h.note}</strong><p>{h.at} · {h.changes.length} changes</p></div></li>)}</ol>}</div></details>
        </>}
        {step === 'export' && <section className="panel padded"><div className="section-heading"><h2>Export for the apps</h2><p>Download the reviewed data and its manifest.</p></div>
          {(dirty || issues.length > 0) && <div className="export-issues"><p>{dirty ? 'Save your changes before exporting.' : 'Finish reviewing these records before exporting.'}</p><button onClick={() => navigate('review')}>Go to review & save</button>{issues.length > 0 && <details className="disclosure"><summary>Show {issues.length} items to resolve</summary><ul>{issues.map(i => <li key={i}>{i}</li>)}</ul></details>}</div>}
          <button className="primary" disabled={busy || dirty || !!issues.length} onClick={() => void perform(async () => { setBundle(await api('export', { expected: snapshot.etag })); setMessage(null); })}>Prepare export</button>
          {bundle && <div className="export-result"><div><h3>{bundle.filename}</h3><code>SHA-256 {bundle.manifest.sha256}</code></div><div className="row-actions"><button onClick={() => download(bundle.filename, bundle.content)}>Download data JSON</button><button onClick={() => download(bundle.filename.replace('.json', '.manifest.json'), JSON.stringify(bundle.manifest, null, 2) + '\n')}>Download manifest</button></div></div>}
        </section>}
      </>}
      {editing && <EditorDialog title={`${editing.id ? 'Edit' : 'Add'} ${editing.kind}`} error={message?.error ? message.text : undefined} close={() => setEditing(null)}>
        {editing.kind === 'holiday' ? <HolidayForm key={`holiday/${editing.id ?? 'new'}`} item={holiday} data={draft} selectedYear={selectedYear} saveSource={saveSource} attempt={attempt} cancel={() => setEditing(null)} remove={holiday ? () => attempt(() => { update(d => { d.holidayCalendars.find(c => c.year === selectedYear)!.holidays = calendar!.holidays.filter(h => h.id !== holiday.id); }, `Removed ${holiday.names.en || holiday.id}`); setEditing(null); }) : undefined} save={(item, coverage) => {
          if (!editing.id && calendar?.holidays.some(h => h.id === item.id)) throw new Error(`Holiday “${item.id}” already exists.`);
          update(d => { const c = d.holidayCalendars.find(c => c.year === selectedYear) ?? { year: selectedYear, coverage, sourceIds: [], holidays: [] }; c.holidays = [...c.holidays.filter(h => h.id !== item.id), item]; c.coverage = coverage; c.sourceIds = [...new Set([...c.sourceIds, ...item.sourceIds])]; d.holidayCalendars = [...d.holidayCalendars.filter(c => c.year !== selectedYear), c]; }, `Updated ${selectedYear} holiday ${item.id}`); setEditing(null);
        }} /> : <EventForm key={`event/${editing.id ?? 'new'}`} item={event} data={draft} saveSource={saveSource} attempt={attempt} cancel={() => setEditing(null)} remove={event ? () => attempt(() => { update(d => { d.events = d.events.filter(e => e.id !== event.id); }, `Removed event ${event.id}`); setEditing(null); }) : undefined} save={item => {
          if (!editing.id && draft.events.some(e => e.id === item.id)) throw new Error(`Event “${item.id}” already exists.`);
          update(d => { d.events = [...d.events.filter(e => e.id !== item.id), item]; }, `Updated event ${item.id}`); setEditing(null);
        }}>
          {event?.rule && <details className="disclosure"><summary>Change dates for a specific year</summary><p>Use the usual calculation for other years.</p><div className="row-actions"><button type="button" onClick={() => { setAdjustmentError(undefined); setAdjusting({ eventId: event.id, year: selectedYear }); }}>Change {selectedYear} dates</button>{draft.overrides.filter(o => o.eventId === event.id && o.year !== selectedYear).map(o => <button type="button" key={o.year} onClick={() => { setAdjustmentError(undefined); setAdjusting({ eventId: event.id, year: o.year }); }}>Edit {o.year} dates</button>)}</div></details>}
        </EventForm>}
      </EditorDialog>}
      {adjusting && <EditorDialog title="Change event dates" error={adjustmentError} close={() => setAdjusting(null)}><OverrideForm item={adjustment} eventId={adjusting.eventId} selectedYear={adjusting.year} data={draft} saveSource={saveSource} cancel={() => setAdjusting(null)} attempt={fn => { try { fn(); } catch (e) { setAdjustmentError(e instanceof Error ? e.message : String(e)); } }} remove={adjustment ? () => { update(d => { d.overrides = d.overrides.filter(o => !(o.eventId === adjusting.eventId && o.year === adjusting.year)); }, `Restored calculation for ${adjusting.year}`); setAdjusting(null); } : undefined} save={item => {
        if (item.year !== adjusting.year && draft.overrides.some(o => o.eventId === item.eventId && o.year === item.year)) throw new Error('This year already has changed dates. Edit that entry.');
        update(d => { d.overrides = [...d.overrides.filter(o => !(o.eventId === adjusting.eventId && o.year === adjusting.year)), item]; }, `Changed ${item.year} dates for ${item.eventId}`); setAdjusting(null);
      }} /></EditorDialog>}
      {reviewingYear !== null && <EditorDialog title="Confirm year" error={message?.error ? message.text : undefined} close={() => setReviewingYear(null)}><YearReview data={draft} selectedYear={reviewingYear} saveSource={saveSource} cancel={() => setReviewingYear(null)} confirm={(sourceId, coverage) => attempt(() => { update(d => { d.holidayCalendars = confirmYear(d, reviewingYear, sourceId, coverage).holidayCalendars; }, `Confirmed ${reviewingYear} holidays`); setReviewingYear(null); })} /></EditorDialog>}
      {importing && <ImportDialog data={draft} selectedYear={selectedYear} saveSource={saveSource} close={() => setImporting(false)} apply={plan => { setDraft(plan.data); setNote(`Imported ${plan.description}`); setMessage({ text: 'Import applied.' }); setImporting(false); }} />}
    </main>
    <footer className="page-footer"><span>{browserMode ? 'Saved in this browser' : 'Local workspace'}</span><span>Engine {ENGINE_VERSION} · Data {draft.dataVersion}</span></footer>
  </div>;
}
