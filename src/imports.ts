import { GregorianDate } from 'khmer-calendar-engine';
import { changes, isoDate, object, validateCatalog, validateSource, year, type Catalog, type Change, type Holiday, type Source } from './model.ts';

export type CsvOptions = { source: Source; year: number; coverage: 'partial' | 'complete' };
export type ImportPlan = { data: Catalog; changes: Change[]; conflicts: Change[]; description: string; destructive: boolean };

/** RFC-style quoted fields, including commas, escaped quotes and multiline cells. */
export function parseCsv(content: string): Record<string, string>[] {
  const input = content.replace(/^\uFEFF/, '');
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  const endCell = () => { row.push(cell); cell = ''; closed = false; };
  const endRow = () => { endCell(); if (row.some(v => v.trim())) rows.push(row); row = []; };
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else cell += ch;
    } else if (ch === '"') {
      if (cell || closed) throw new Error('CSV: unexpected quote');
      quoted = true;
    } else if (ch === ',') endCell();
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && input[i + 1] === '\n') i++; endRow(); }
    else { if (closed) throw new Error('CSV: unexpected text after a closing quote'); cell += ch; }
  }
  if (quoted) throw new Error('CSV: unclosed quoted field');
  if (cell || row.length || closed) endRow();
  if (rows.length < 2) throw new Error('CSV: include a header and at least one holiday');
  const headers = rows.shift()!.map(v => v.trim());
  const allowed = ['id', 'en', 'km', 'start', 'end', 'status', 'eventId', 'note'];
  if (new Set(headers).size !== headers.length) throw new Error('CSV: duplicate column names');
  for (const h of headers) if (!allowed.includes(h)) throw new Error(`CSV: unknown column “${h}”`);
  for (const h of ['id', 'en', 'km', 'start']) if (!headers.includes(h)) throw new Error(`CSV: missing “${h}” column`);
  return rows.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${i + 2}: expected ${headers.length} columns, got ${values.length}`);
    return Object.fromEntries(headers.map((h, i) => [h, values[i].trim()]));
  });
}

export function dateRange(start: string, end = start): string[] {
  isoDate(start); isoDate(end);
  if (end < start || start.slice(0, 4) !== end.slice(0, 4)) throw new Error('A holiday range must run forward within one year');
  const [y, m, d] = start.split('-').map(Number);
  const result: string[] = []; let date = new GregorianDate(y, m, d);
  while (date.iso <= end) { result.push(date.iso); if (date.iso === end) break; date = date.plusDays(1); }
  return result;
}

export function planImport(base: Catalog, content: string, format: 'json' | 'csv', options?: CsvOptions): ImportPlan {
  let incoming: any;
  if (format === 'csv') {
    if (!options) throw new Error('Choose the year, government source and coverage for this CSV');
    incoming = { schemaVersion: 1, type: 'official-holidays', ...options, holidays: parseCsv(content).map(row => ({
      id: row.id, names: { en: row.en, km: row.km }, dates: dateRange(row.start, row.end || row.start),
      status: row.status || 'active', ...(row.eventId ? { eventId: row.eventId } : {}), ...(row.note ? { note: row.note } : {}),
    })) };
  } else {
    try { incoming = JSON.parse(content); } catch { throw new Error('JSON: the file is not valid JSON'); }
  }
  let next: Catalog, description: string;
  if (incoming?.type === 'official-holidays') {
    object(incoming, 'import', ['schemaVersion', 'type', 'year', 'coverage', 'source', 'holidays']);
    if (incoming.schemaVersion !== 1) throw new Error('Unsupported import schema version');
    year(incoming.year, 'import.year');
    if (!['partial', 'complete'].includes(incoming.coverage)) throw new Error('Choose complete or partial coverage');
    const source = validateSource(incoming.source);
    if (source.kind !== 'government') throw new Error('Official holiday imports require a government source');
    if (!Array.isArray(incoming.holidays)) throw new Error('holidays must be an array');
    const entries: Holiday[] = incoming.holidays.map((input: unknown, i: number) => {
      const h = object(input, `holidays[${i}]`, ['id', 'names', 'dates', 'status', 'eventId', 'note']);
      return { ...h, status: h.status ?? 'active', sourceIds: [source.id] } as Holiday;
    });
    if (new Set(entries.map(h => h.id)).size !== entries.length) throw new Error('The import contains duplicate holiday IDs');
    next = structuredClone(base);
    next.sources = [...next.sources.filter(s => s.id !== source.id), source];
    const previous = next.holidayCalendars.find(c => c.year === incoming.year);
    const holidays = incoming.coverage === 'complete' ? entries : [
      ...(previous?.holidays ?? []).filter(h => !entries.some(e => e.id === h.id)), ...entries,
    ];
    next.holidayCalendars = [...next.holidayCalendars.filter(c => c.year !== incoming.year), {
      year: incoming.year, coverage: incoming.coverage === 'complete' || previous?.coverage === 'complete' ? 'complete' : 'partial',
      sourceIds: [...new Set([...(previous?.sourceIds ?? []), source.id])].sort(), holidays,
    }];
    description = `${incoming.year} · ${incoming.coverage === 'complete' ? 'complete replacement of the yearly list' : 'partial update; unlisted holidays are preserved'}`;
  } else {
    next = validateCatalog(incoming);
    description = 'Full catalog replacement';
  }
  next = validateCatalog(next);
  const diff = changes(base, next);
  return { data: next, changes: diff, conflicts: diff.filter(c => c.action === 'changed'), description, destructive: diff.some(c => c.action === 'removed') };
}
