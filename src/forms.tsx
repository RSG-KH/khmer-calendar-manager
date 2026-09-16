import { cloneElement, isValidElement, useId, useState, type FormEvent, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import type { RuleInput } from 'khmer-calendar-engine';
import { dateRange } from './imports.ts';
import type { Catalog, Event, Holiday, Override, Source } from './model.ts';

export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  const id = useId();
  return <div className="field"><label id={`${id}-label`} htmlFor={id}>{label}</label>{isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, { id, 'aria-labelledby': `${id}-label`, 'aria-describedby': help ? `${id}-help` : undefined }) : children}{help && <small id={`${id}-help`}>{help}</small>}</div>;
}
const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
const optional = (name: string, value: string) => value ? { [name]: value } : {};
export function parseDates(value: string): string[] {
  return value.split(/[\s,;]+/).filter(Boolean).flatMap(token => {
    if (token.includes('..')) { const parts = token.split('..'); if (parts.length !== 2) throw new Error('Use start..end for a date range'); return dateRange(parts[0], parts[1]); }
    return [token];
  });
}
function submit(handler: (form: FormData) => void, attempt: (fn: () => void) => void) {
  return (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); attempt(() => handler(data)); };
}
export function SourceSelect({ sources, value, government = false, name = 'sourceId', multiple = false, ...attributes }: { sources: Source[]; value?: string | string[]; government?: boolean; name?: string; multiple?: boolean } & SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...attributes} name={name} required multiple={multiple} size={multiple ? 3 : undefined} defaultValue={value ?? (multiple ? [] : '')}>
    {!multiple && <option value="">Choose a source</option>}
    {sources.filter(s => !government || s.kind === 'government').map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
  </select>;
}
type Actions = { attempt: (fn: () => void) => void; cancel: () => void };
function FormActions({ edit, cancel }: { edit?: boolean; cancel: () => void }) {
  return <div className="form-actions"><button className="primary" type="submit">{edit ? 'Update draft' : 'Add to draft'}</button><button type="button" onClick={cancel}>Cancel</button></div>;
}

export function SourceForm({ item, save, attempt, cancel }: Actions & { item?: Source; save: (item: Source) => void }) {
  return <form className="editor" onSubmit={submit(f => save({ id: text(f, 'id'), title: text(f, 'title'), publisher: text(f, 'publisher'), kind: text(f, 'kind') as Source['kind'], ...optional('url', text(f, 'url')), ...optional('reference', text(f, 'reference')), ...optional('publishedOn', text(f, 'publishedOn')), ...optional('notes', text(f, 'notes')) }), attempt)}>
    <div className="section-heading"><h2>{item ? 'Edit source' : 'Add a source'}</h2><p>Record the publication that supports your dates or event information.</p></div>
    <div className="form-grid">
      <Field label="Source ID" help="Stable lowercase ID; it stays the same when wording changes."><input name="id" required readOnly={!!item} defaultValue={item?.id} placeholder="government-holidays-2026" /></Field>
      <Field label="Source kind"><select name="kind" defaultValue={item?.kind ?? 'government'}><option value="government">Government publication</option><option value="calendar">Calendar / almanac</option><option value="historical">Historical reference</option><option value="other">Other reference</option></select></Field>
      <Field label="Publication title"><input name="title" required defaultValue={item?.title} /></Field>
      <Field label="Issuing authority / publisher"><input name="publisher" required defaultValue={item?.publisher} /></Field>
      <Field label="Public URL"><input name="url" type="url" defaultValue={item?.url} placeholder="https://…" /></Field>
      <Field label="Document reference" help="Instrument number, page, edition or other locator."><input name="reference" defaultValue={item?.reference} /></Field>
      <Field label="Publication date"><input name="publishedOn" type="date" defaultValue={item?.publishedOn} /></Field>
    </div>
    <Field label="Review notes"><textarea name="notes" rows={3} defaultValue={item?.notes} placeholder="What was checked, amendments, or unresolved details" /></Field>
    <FormActions edit={!!item} cancel={cancel} />
  </form>;
}

export function EventForm({ item, data, save, attempt, cancel }: Actions & { item?: Event; data: Catalog; save: (item: Event) => void }) {
  const [mode, setMode] = useState(item?.rule?.type ?? 'explicit');
  const [kind, setKind] = useState<Event['kind']>(item?.kind ?? 'observance');
  const rule = item?.rule as any;
  const [firstYear, setFirstYear] = useState(String(rule?.fromYear ?? Math.max(1800, Number(item?.originalDate?.slice(0, 4) ?? 1800))));
  return <form className="editor" onSubmit={submit(f => {
    const id = text(f, 'id');
    const event: Event = { id, kind, names: { en: text(f, 'en'), km: text(f, 'km') }, sourceIds: f.getAll('sourceIds').map(String), ...optional('originalDate', text(f, 'originalDate')), description: { en: text(f, 'descriptionEn'), km: text(f, 'descriptionKm') } };
    if (mode === 'explicit') event.dates = parseDates(text(f, 'dates'));
    else {
      const rule: any = { id, type: mode, offset: Number(text(f, 'offset')), duration: Number(text(f, 'duration')), fromYear: Number(text(f, 'fromYear')), throughYear: Number(text(f, 'throughYear')) };
      if (['solar', 'solar_nth_weekday', 'khmer_lunar'].includes(mode)) { rule.month = Number(text(f, 'month')); rule.day = Number(text(f, 'day')); }
      if (mode === 'solar_nth_weekday') rule.occurrence = Number(text(f, 'occurrence'));
      if (mode === 'khmer_lunar') { rule.waxing = text(f, 'waxing') === 'true'; rule.monthPolicy = text(f, 'monthPolicy'); }
      event.rule = rule as RuleInput;
    }
    save(event);
  }, attempt)}>
    <div className="section-heading"><h2>{item ? 'Edit event' : 'Add an event'}</h2><p>Use an original date for a historical fact, and add recurrence only when an annual commemoration is intended.</p></div>
    <div className="form-grid">
      <Field label="Event ID"><input name="id" required readOnly={!!item} defaultValue={item?.id} placeholder="stable-event-id" /></Field>
      <Field label="Event kind"><select value={kind} onChange={e => setKind(e.target.value as Event['kind'])}><option value="observance">Observance</option><option value="traditional">Traditional festival</option><option value="historical">Historical event</option></select></Field>
      <Field label="English name"><input name="en" defaultValue={item?.names.en} /></Field>
      <Field label="Khmer name"><input lang="km" name="km" defaultValue={item?.names.km} /></Field>
      <Field label="Sources" help="Choose one or more supporting publications."><SourceSelect sources={data.sources} name="sourceIds" multiple value={item?.sourceIds} /></Field>
      <Field label="Original historical date" help="Retained separately from annual commemorations."><input type="date" name="originalDate" required={kind === 'historical'} defaultValue={item?.originalDate} onChange={e => { if (kind === 'historical' && e.target.value) setFirstYear(String(Math.max(Number(firstYear), 1800, Number(e.target.value.slice(0, 4))))); }} /></Field>
    </div>
    <Field label="Date method"><select value={mode} onChange={e => setMode(e.target.value)}><option value="explicit">Explicit dates / one-time event</option><option value="solar">Annual Gregorian date</option><option value="khmer_lunar">Khmer lunar recurrence</option><option value="solar_nth_weekday">Nth weekday of a month</option><option value="new_year_first">Khmer New Year — first day</option><option value="new_year_middle">Khmer New Year — middle day(s)</option><option value="new_year_last">Khmer New Year — last day</option></select></Field>
    {mode === 'explicit' ? <Field label="Event dates" help="One date per line, or a range such as 2026-04-14..2026-04-16."><textarea name="dates" rows={3} required defaultValue={item?.dates?.join('\n') ?? item?.originalDate} placeholder="YYYY-MM-DD" /></Field> : <div className="rule-box">
      <h3>Recurrence parameters</h3>
      <div className="form-grid">
        {mode === 'khmer_lunar' ? <>
          <Field label="Lunar month"><select name="month" defaultValue={rule?.month ?? 7}>{['Migasir', 'Boss', 'Meak', 'Phalkun', 'Chet', 'Pisakh', 'Jestha', 'Asadh', 'Srapon', 'Phutrobot', 'Assoch', 'Kattik', 'First Asadh', 'Second Asadh'].map((m, i) => <option key={i} value={i}>{m}</option>)}</select></Field>
          <Field label="Lunar day"><input name="day" type="number" required min={1} max={15} defaultValue={rule?.day ?? 1} /></Field>
          <Field label="Phase"><select name="waxing" defaultValue={String(rule?.waxing ?? true)}><option value="true">Waxing — Keut</option><option value="false">Waning — Roach</option></select></Field>
          <Field label="Asadh policy"><select name="monthPolicy" defaultValue={rule?.monthPolicy ?? 'exact'}><option value="exact">Exact month</option><option value="ordinary_or_second_asadh">Ordinary or second Asadh</option></select></Field>
        </> : ['solar', 'solar_nth_weekday'].includes(mode) ? <>
          <Field label="Gregorian month"><input name="month" type="number" min={1} max={12} required defaultValue={rule?.month} /></Field>
          <Field label={mode === 'solar' ? 'Day of month' : 'Weekday (Monday 1 – Sunday 7)'}><input name="day" type="number" min={1} max={mode === 'solar' ? 31 : 7} required defaultValue={rule?.day} /></Field>
          {mode === 'solar_nth_weekday' && <Field label="Occurrence (1–5)"><input name="occurrence" type="number" min={1} max={5} required defaultValue={rule?.occurrence ?? 1} /></Field>}
        </> : null}
        <Field label="First anchor year"><input name="fromYear" type="number" min={1800} max={2200} required value={firstYear} onChange={e => setFirstYear(e.target.value)} /></Field>
        <Field label="Last anchor year"><input name="throughYear" type="number" min={1800} max={2200} required defaultValue={rule?.throughYear ?? 2200} /></Field>
        <Field label="Offset in days"><input name="offset" type="number" min={-366} max={366} required defaultValue={rule?.offset ?? 0} /></Field>
        <Field label="Duration in days"><input name="duration" type="number" min={1} max={366} required defaultValue={rule?.duration ?? 1} /></Field>
      </div>
    </div>}
    <div className="form-grid"><Field label="English description"><textarea name="descriptionEn" rows={3} defaultValue={item?.description?.en} /></Field><Field label="Khmer description"><textarea name="descriptionKm" lang="km" rows={3} defaultValue={item?.description?.km} /></Field></div>
    <FormActions edit={!!item} cancel={cancel} />
  </form>;
}

export function HolidayForm({ item, data, selectedYear, save, attempt, cancel }: Actions & { item?: Holiday; data: Catalog; selectedYear: number; save: (item: Holiday, coverage: 'partial' | 'complete') => void }) {
  const [status, setStatus] = useState(item?.status ?? 'active');
  const current = data.holidayCalendars.find(c => c.year === selectedYear);
  return <form className="editor" onSubmit={submit(f => save({ id: text(f, 'id'), names: { en: text(f, 'en'), km: text(f, 'km') }, dates: parseDates(text(f, 'dates')), status, sourceIds: f.getAll('sourceIds').map(String), ...optional('eventId', text(f, 'eventId')), ...optional('note', text(f, 'note')) }, text(f, 'coverage') as 'partial' | 'complete'), attempt)}>
    <div className="section-heading"><h2>{item ? 'Edit official holiday' : 'Add official holiday'} · {selectedYear}</h2><p>Enter the designated dates from the government publication.</p></div>
    <div className="form-grid">
      <Field label="Holiday ID"><input name="id" required readOnly={!!item} defaultValue={item?.id} placeholder="stable-holiday-id" /></Field>
      <Field label="Yearly coverage"><select name="coverage" defaultValue={current?.coverage ?? 'partial'}><option value="partial">Partial list / amendment</option><option value="complete">Complete yearly list</option></select></Field>
      <Field label="English name"><input name="en" defaultValue={item?.names.en} /></Field>
      <Field label="Khmer name"><input name="km" lang="km" defaultValue={item?.names.km} /></Field>
      <Field label="Government sources"><SourceSelect sources={data.sources} government multiple name="sourceIds" value={item?.sourceIds} /></Field>
      <Field label="Linked event (optional)"><select name="eventId" defaultValue={item?.eventId ?? ''}><option value="">Independent holiday record</option>{data.events.map(e => <option value={e.id} key={e.id}>{e.names.en || e.names.km}</option>)}</select></Field>
    </div>
    <Field label="Official dates" help={`All dates must be in ${selectedYear}. Use one date per line or start..end.`}><textarea name="dates" required rows={3} defaultValue={item?.dates.join('\n')} placeholder={`${selectedYear}-04-14..${selectedYear}-04-16`} /></Field>
    <div className="form-grid"><Field label="Status"><select value={status} onChange={e => setStatus(e.target.value as Holiday['status'])}><option value="active">Designated holiday</option><option value="cancelled">Cancelled by publication</option></select></Field><Field label="Amendment / cancellation note"><textarea name="note" rows={2} required={status === 'cancelled'} defaultValue={item?.note} /></Field></div>
    <FormActions edit={!!item} cancel={cancel} />
  </form>;
}

export function OverrideForm({ item, data, selectedYear, save, attempt, cancel }: Actions & { item?: Override; data: Catalog; selectedYear: number; save: (item: Override) => void }) {
  return <form className="editor" onSubmit={submit(f => save({ eventId: text(f, 'eventId'), year: Number(text(f, 'year')), dates: parseDates(text(f, 'dates')), sourceId: text(f, 'sourceId'), reason: text(f, 'reason') }), attempt)}>
    <div className="section-heading"><h2>{item ? 'Edit correction' : 'Add a correction'}</h2><p>Replace a recurring event’s dates for one anchor year. Leave replacement dates empty to cancel its occurrences.</p></div>
    <div className="form-grid">
      <Field label="Recurring event"><select name="eventId" required defaultValue={item?.eventId ?? ''}><option value="">Choose an event</option>{data.events.filter(e => e.rule).map(e => <option value={e.id} key={e.id}>{e.names.en || e.names.km}</option>)}</select></Field>
      <Field label="Anchor year"><input name="year" type="number" required min={1800} max={2200} defaultValue={item?.year ?? selectedYear} /></Field>
      <Field label="Supporting source"><SourceSelect sources={data.sources} value={item?.sourceId} /></Field>
    </div>
    <Field label="Replacement dates" help="These replace the entire occurrence list for the anchor year."><textarea name="dates" rows={3} defaultValue={item?.dates.join('\n')} placeholder="Empty means cancelled" /></Field>
    <Field label="Reason"><textarea name="reason" required rows={3} defaultValue={item?.reason} /></Field>
    <FormActions edit={!!item} cancel={cancel} />
  </form>;
}
