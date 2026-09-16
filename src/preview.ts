import { EventDateOverride, GregorianDate, createRule } from 'khmer-calendar-engine';
import { engine, year, type Catalog } from './model.ts';

export type PreviewRow = { date: string; id: string; en: string; km: string; kind: string; basis: string; sourceIds: string[]; cancelled?: boolean };
export function preview(data: Catalog, selectedYear: number): { rows: PreviewRow[]; issues: string[] } {
  year(selectedYear, 'preview year');
  const rows: PreviewRow[] = [], issues: string[] = [];
  for (const event of data.events) {
    const dates = new Map<string, { basis: string; sourceIds: string[] }>();
    if (event.dates) for (const date of event.dates) if (Number(date.slice(0, 4)) === selectedYear) dates.set(date, { basis: 'Recorded', sourceIds: event.sourceIds });
    if (event.rule) {
      const rule = createRule(event.rule);
      const anchors = new Set<number>();
      // Maximum offset + duration can cross two Gregorian year boundaries.
      for (let y = Math.max(engine.minYear, selectedYear - 2); y <= Math.min(engine.maxYear, selectedYear + 2); y++) anchors.add(y);
      const overrides = data.overrides.filter(o => o.eventId === event.id);
      for (const o of overrides) if (o.dates.some(d => Number(d.slice(0, 4)) === selectedYear)) anchors.add(o.year);
      for (const anchor of anchors) {
        const o = overrides.find(o => o.year === anchor);
        const replacement = o ? new EventDateOverride(event.id, anchor, o.dates.map(iso => {
          const [y, m, d] = iso.split('-').map(Number); return new GregorianDate(y, m, d);
        }), o.sourceId, o.reason) : undefined;
        try {
          for (const value of engine.evaluateRule(anchor, rule, replacement)) {
            if (value.date.year !== selectedYear) continue;
            if (event.kind === 'historical' && event.originalDate && value.date.iso < event.originalDate) continue;
            const corrected = value.basis === 'source_override';
            if (corrected || !dates.has(value.date.iso)) dates.set(value.date.iso, { basis: corrected ? 'Corrected' : 'Calculated', sourceIds: corrected ? [value.sourceId!] : event.sourceIds });
          }
        } catch (error) { issues.push(`${event.id}, anchor ${anchor}: ${String(error)}`); }
      }
    }
    for (const [date, detail] of dates) rows.push({ date, id: event.id, ...event.names, kind: event.kind, ...detail });
  }
  for (const calendar of data.holidayCalendars.filter(c => c.year === selectedYear)) for (const h of calendar.holidays) {
    for (const date of h.dates) rows.push({ date, id: h.id, ...h.names, kind: 'official', basis: h.status === 'active' ? 'Official holiday' : 'Cancelled holiday', sourceIds: h.sourceIds, cancelled: h.status === 'cancelled' });
  }
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0);
  return { rows, issues };
}
