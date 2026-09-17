import { useState } from 'react';
import type { Catalog, Change } from './model.ts';

export function download(filename: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function record(data: Catalog, change: Change): unknown {
  if (change.section === 'Version') return data.dataVersion;
  if (change.section === 'Source') return data.sources.find(s => s.id === change.id);
  if (change.section === 'Event') return data.events.find(s => s.id === change.id);
  if (change.section === 'Event calendar') { const c = data.eventCalendars.find(c => String(c.year) === change.id); return c && { year: c.year, coverage: c.coverage, sourceIds: c.sourceIds }; }
  if (change.section === 'Calendar') { const c = data.holidayCalendars.find(c => String(c.year) === change.id); return c && { year: c.year, coverage: c.coverage, sourceIds: c.sourceIds }; }
  const [first, second] = change.id.split('/');
  if (change.section === 'Recorded event') return data.eventCalendars.find(c => c.year === Number(first))?.events.find(e => e.id === second);
  if (change.section === 'Holiday') return data.holidayCalendars.find(c => c.year === Number(first))?.holidays.find(h => h.id === second);
  return data.overrides.find(o => o.eventId === first && o.year === Number(second));
}
export function ChangeList({ before, after, list }: { before: Catalog; after: Catalog; list: Change[] }) {
  const [limit, setLimit] = useState(50);
  return <div className="change-list">{list.slice(0, limit).map(c => <details key={`${c.section}/${c.id}`}>
    <summary><span className={`badge ${c.action}`}>{c.action}</span><span>{c.section}</span><strong>{c.id}</strong></summary>
    <div className="diff"><div><h4>Before</h4><pre>{JSON.stringify(record(before, c) ?? null, null, 2)}</pre></div><div><h4>After</h4><pre>{JSON.stringify(record(after, c) ?? null, null, 2)}</pre></div></div>
  </details>)}{list.length > limit && <button onClick={() => setLimit(limit + 100)}>Show more changes ({list.length - limit} remaining)</button>}</div>;
}
export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="empty"><div className="empty-icon" aria-hidden>▦</div><h3>{title}</h3><p>{children}</p></div>;
}
