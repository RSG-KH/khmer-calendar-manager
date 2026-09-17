import { useMemo, useState } from 'react';
import type { Catalog } from './model.ts';
import { preview } from './preview.ts';
import { PublicationPreview } from './YearTools.tsx';
import { FIRST_TEMPLATE_YEAR } from './generate-year.ts';

export function CalendarWorkspace({ data, selectedYear, hidden, edit, generate, importData }: {
  data: Catalog; selectedYear: number; hidden: boolean;
  edit: (kind: 'holiday' | 'event', id?: string) => void; generate: () => void; importData: () => void;
}) {
  const [filter, setFilter] = useState('all'), [query, setQuery] = useState(''), [limit, setLimit] = useState(60);
  const [hasAnnouncement, setHasAnnouncement] = useState(false);
  const calendar = data.holidayCalendars.find(c => c.year === selectedYear);
  const eventCalendar = data.eventCalendars.find(c => c.year === selectedYear);
  const calculated = useMemo(() => preview(data, selectedYear), [data, selectedYear]);
  const records = [
    ...(calendar?.holidays ?? []).filter(h => !h.dates.some(date => eventCalendar?.events.some(e => e.id === h.id && e.date === date))).map(h => ({ id: h.id, kind: 'holiday' as const, names: h.names, dates: h.dates, draft: h.status === 'draft', cancelled: h.status === 'cancelled', basis: h.status === 'draft' ? 'Awaiting review' : h.status === 'cancelled' ? 'Cancelled holiday' : 'Official holiday', editable: true })),
    ...(eventCalendar?.events ?? []).map(e => {
      const holiday = calendar?.holidays.find(h => h.id === e.id && h.dates.includes(e.date));
      return { id: e.id, kind: holiday ? 'holiday' as const : 'event' as const, names: e.names, dates: [e.date], draft: holiday?.status === 'draft', cancelled: holiday?.status === 'cancelled', basis: holiday ? holiday.status === 'draft' ? 'Awaiting review' : holiday.status === 'cancelled' ? 'Cancelled holiday' : 'Official holiday' : 'Recorded event', editable: !!holiday };
    }),
    ...data.events.filter(e => eventCalendar?.coverage !== 'complete' || !e.rule).map(e => {
      const rows = calculated.rows.filter(r => r.id === e.id && !['official', 'draft'].includes(r.kind));
      return { id: e.id, kind: 'event' as const, names: e.names, dates: rows.map(r => r.date), draft: false, cancelled: false, basis: rows.some(r => r.basis === 'Corrected') ? 'Adjusted event' : e.rule ? 'Calculated event' : 'Recorded event', editable: true };
    }),
  ].filter(r => (filter === 'all' || (filter === 'draft' ? r.draft : r.kind === filter)) && `${r.names.en} ${r.names.km} ${r.id} ${r.dates.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.dates[0] ?? '9999').localeCompare(b.dates[0] ?? '9999') || a.id.localeCompare(b.id));
  const commonBasis = records.length && records.every(r => r.basis === records[0].basis) ? records[0].basis : null;
  return <div hidden={hidden}>
    <div className="calendar-controls">
      <div className="row-actions"><button onClick={importData}>Import</button><button onClick={() => edit('event')}>+ Add event</button><button onClick={() => edit('holiday')}>+ Add holiday</button></div>
      <div className="calendar-filters"><input aria-label="Search calendar" value={query} onChange={e => { setQuery(e.target.value); setLimit(60); }} placeholder="Search names or dates…" /><select aria-label="Calendar filter" value={filter} onChange={e => { setFilter(e.target.value); setLimit(60); }}><option value="all">All records</option><option value="holiday">Official holidays</option><option value="event">Events</option><option value="draft">Awaiting review</option></select></div>
    </div>
    <div className={`calendar-workbench ${hasAnnouncement ? 'has-announcement' : ''}`}>
      <PublicationPreview onFileChange={setHasAnnouncement} />
      <div>
        {!calendar && <section className="generate-year"><div><strong>{selectedYear} public holidays</strong><p>{selectedYear >= FIRST_TEMPLATE_YEAR ? 'Start with calculated dates and check the announcement.' : 'Add the dates from the announcement.'}</p></div>{selectedYear >= FIRST_TEMPLATE_YEAR && <button className="primary" onClick={generate}>Generate year</button>}</section>}
        <section className="panel calendar-list">
          <div className="list-count">{records.length} {records.length === 1 ? 'record' : 'records'}{commonBasis && ` · ${commonBasis}`}</div>
          {calculated.issues.length > 0 && <div className="notice error" role="alert">{calculated.issues.join('\n')}</div>}
          {records.length ? <div className="record-list">{records.slice(0, limit).map(r => <article key={`${r.kind}/${r.id}`} className={r.cancelled ? 'cancelled' : ''}>
            <div className="calendar-dates">{r.dates.length ? r.dates.map(date => <time key={date} dateTime={date}>{new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</time>) : <span>No dates<br />in {selectedYear}</span>}</div>
            <div className="calendar-name"><h3>{r.names.en || r.names.km}</h3>{r.names.en && r.names.km && <p lang="km">{r.names.km}</p>}{!commonBasis && <span className={`record-basis ${r.draft ? 'pending' : ''}`}>{r.basis}</span>}</div>
            {r.editable ? <button onClick={() => edit(r.kind, r.id)}>Edit</button> : <span className="record-basis">Imported</span>}
          </article>)}</div> : <div className="empty"><h3>{query || filter !== 'all' ? 'No matching records' : 'No records yet'}</h3><p>{query || filter !== 'all' ? 'Change the filter or search.' : 'Generate the holidays, import a list, or add an event.'}</p></div>}
          {records.length > limit && <div className="pagination"><button onClick={() => setLimit(limit + 60)}>Show more</button></div>}
        </section>
      </div>
    </div>
  </div>;
}
