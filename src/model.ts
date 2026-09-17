import { GregorianDate, KhmerCalendarEngine, createRule, type RuleInput } from 'khmer-calendar-engine';

export const engine = new KhmerCalendarEngine();
export const ENGINE_VERSION = engine.version;
export type Names = { en: string; km: string };
export type Source = {
  id: string; title: string; publisher: string;
  kind: 'government' | 'calendar' | 'historical' | 'other';
  url?: string; reference?: string; publishedOn?: string; notes?: string;
};
export type Event = {
  id: string; kind: 'traditional' | 'historical' | 'observance'; names: Names;
  sourceIds: string[]; description?: Names; originalDate?: string;
  dates?: string[]; rule?: RuleInput; anniversaryBase?: number;
};
export type EventOccurrence = {
  id: string; date: string; kind: 'traditional' | 'historical' | 'observance'; names: Names;
  sourceIds: string[]; eventId?: string;
};
export type EventCalendar = {
  year: number; coverage: 'complete' | 'partial'; sourceIds: string[]; events: EventOccurrence[];
};
export type Holiday = {
  id: string; names: Names; dates: string[]; status: 'draft' | 'active' | 'cancelled';
  sourceIds: string[]; eventId?: string; note?: string;
};
export type HolidayCalendar = {
  year: number; coverage: 'complete' | 'partial'; sourceIds: string[]; holidays: Holiday[];
};
export type Override = { eventId: string; year: number; dates: string[]; sourceId: string; reason: string };
export type Catalog = {
  schemaVersion: 2; dataVersion: string; sources: Source[]; events: Event[];
  eventCalendars: EventCalendar[]; holidayCalendars: HolidayCalendar[]; overrides: Override[];
};
export type Change = { section: string; id: string; action: 'added' | 'changed' | 'removed' };
export type HistoryEntry = { revision: number; at: string; note: string; changes: Change[] };
export type Workspace = { revision: number; data: Catalog; history: HistoryEntry[] };
export type Snapshot = { workspace: Workspace; etag: string; engineVersion: string };

export function emptyCatalog(): Catalog {
  return { schemaVersion: 2, dataVersion: '0.1.0', sources: [], events: [], eventCalendars: [], holidayCalendars: [], overrides: [] };
}

export class ValidationError extends Error {}
function fail(path: string, message: string): never { throw new ValidationError(`${path}: ${message}`); }
export function object(value: unknown, path: string, fields: string[]): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  for (const key of Object.keys(value)) if (!fields.includes(key)) fail(path, `unknown field “${key}”`);
  return value as Record<string, any>;
}
function text(value: unknown, path: string, max = 500, optional = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) fail(path, `expected ${optional ? 'text' : 'non-empty text'} (maximum ${max} characters)`);
}
export function id(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(value)) fail(path, 'use 1–80 lowercase letters, numbers, dots, underscores or hyphens');
}
export function year(value: unknown, path: string): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < engine.minYear || Number(value) > engine.maxYear) fail(path, `expected a year from ${engine.minYear} to ${engine.maxYear}`);
}
export function isoDate(value: unknown, path = 'date'): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(path, 'use YYYY-MM-DD');
  const [y, m, d] = value.split('-').map(Number);
  try { return new GregorianDate(y, m, d).iso; } catch { return fail(path, 'not a real Gregorian date'); }
}
export function names(value: unknown, path: string): void {
  const v = object(value, path, ['en', 'km']);
  text(v.en, `${path}.en`, 500, true); text(v.km, `${path}.km`, 500, true);
  if (!v.en.trim() && !v.km.trim()) fail(path, 'enter an English or Khmer name');
}
function array(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > 50000) fail(path, 'expected an array with at most 50,000 entries');
}
function unique(values: unknown[], path: string): void {
  if (new Set(values).size !== values.length) fail(path, 'duplicate entries');
}
function optionalText(v: Record<string, any>, field: string, path: string, max = 5000): void {
  if (v[field] !== undefined) text(v[field], `${path}.${field}`, max, true);
}
function dates(value: unknown, path: string, allowEmpty = false, expectedYear?: number): void {
  array(value, path); if (!allowEmpty && !value.length) fail(path, 'at least one date is required');
  value.forEach((date, i) => {
    const iso = isoDate(date, `${path}[${i}]`);
    if (expectedYear !== undefined && Number(iso.slice(0, 4)) !== expectedYear) fail(path, `all dates must be in ${expectedYear}`);
  });
  unique(value, path);
}
export function validateSource(input: unknown, path = 'source'): Source {
  const v = object(input, path, ['id', 'title', 'publisher', 'kind', 'url', 'reference', 'publishedOn', 'notes']);
  id(v.id, `${path}.id`); text(v.title, `${path}.title`); text(v.publisher, `${path}.publisher`);
  if (!['government', 'calendar', 'historical', 'other'].includes(v.kind)) fail(path, 'unknown source kind');
  for (const field of ['reference', 'notes', 'url']) optionalText(v, field, path);
  if (v.url) {
    let url: URL;
    try { url = new URL(v.url); } catch { return fail(`${path}.url`, 'invalid URL'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail(`${path}.url`, 'use a public HTTP(S) URL without credentials');
  }
  if (!v.url && !v.reference?.trim()) fail(path, 'provide a URL or a document reference');
  if (v.publishedOn !== undefined) isoDate(v.publishedOn, `${path}.publishedOn`);
  return v as Source;
}

export function validateCatalog(input: unknown): Catalog {
  const raw = object(input, 'catalog', ['schemaVersion', 'dataVersion', 'sources', 'events', 'eventCalendars', 'holidayCalendars', 'overrides']);
  if (![1, 2].includes(raw.schemaVersion)) fail('schemaVersion', 'only versions 1 and 2 are supported');
  const v = raw.schemaVersion === 1 ? { ...raw, schemaVersion: 2, eventCalendars: raw.eventCalendars ?? [] } : raw;
  if (typeof v.dataVersion !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(v.dataVersion)) fail('dataVersion', 'use a version such as 0.1.0 or 2026.1.0');
  for (const key of ['sources', 'events', 'eventCalendars', 'holidayCalendars', 'overrides']) array(v[key], key);
  v.sources.forEach((source: unknown, i: number) => validateSource(source, `sources[${i}]`));
  unique(v.sources.map((s: Source) => s.id), 'sources');
  const sources = new Map<string, Source>(v.sources.map((s: Source) => [s.id, s]));
  const eventIds = new Set<string>(v.events.map((e: Event) => e?.id));
  function sourceIds(value: unknown, path: string, government = false, allowEmpty = false) {
    array(value, path); if (!value.length && !allowEmpty) fail(path, 'at least one source is required'); unique(value, path);
    for (const sourceId of value) {
      id(sourceId, path);
      const source = sources.get(sourceId);
      if (!source) fail(path, `source “${sourceId}” does not exist`);
      if (government && source.kind !== 'government') fail(path, `“${sourceId}” is not a government publication`);
    }
  }
  v.events.forEach((input: unknown, i: number) => {
    const p = `events[${i}]`, e = object(input, p, ['id', 'kind', 'names', 'sourceIds', 'description', 'originalDate', 'dates', 'rule', 'anniversaryBase']);
    id(e.id, `${p}.id`); names(e.names, `${p}.names`); sourceIds(e.sourceIds, `${p}.sourceIds`);
    if (!['traditional', 'historical', 'observance'].includes(e.kind)) fail(p, 'unknown event kind');
    if (e.description !== undefined) {
      const d = object(e.description, `${p}.description`, ['en', 'km']);
      text(d.en, `${p}.description.en`, 5000, true); text(d.km, `${p}.description.km`, 5000, true);
    }
    if (e.originalDate !== undefined) isoDate(e.originalDate, `${p}.originalDate`);
    if (e.kind === 'historical' && !e.originalDate) fail(p, 'a historical event needs its original date');
    if ((e.rule !== undefined) === (e.dates !== undefined)) fail(p, 'choose explicit dates or a recurrence rule');
    if (e.anniversaryBase !== undefined) {
      if (!e.rule || !Number.isInteger(e.anniversaryBase) || e.anniversaryBase < 1 || e.anniversaryBase > engine.maxYear) fail(`${p}.anniversaryBase`, 'use a valid base year on a recurring event');
      if (!e.names.en.includes('{anniversary}') && !e.names.km.includes('{anniversary}')) fail(`${p}.anniversaryBase`, 'the event name must contain {anniversary}');
    }
    if (e.dates !== undefined) {
      dates(e.dates, `${p}.dates`);
      if (e.kind === 'historical' && e.dates.some((d: string) => d < e.originalDate)) fail(p, 'an appearance cannot precede the original historical date');
    }
    if (e.rule !== undefined) {
      if (e.rule?.id !== e.id) fail(p, 'rule ID must match event ID');
      const required = e.rule.type === 'khmer_lunar' ? ['month', 'day', 'waxing'] : e.rule.type === 'solar_nth_weekday' ? ['month', 'day', 'occurrence'] : e.rule.type === 'solar' ? ['month', 'day'] : [];
      for (const field of required) if (e.rule[field] === undefined) fail(`${p}.rule`, `missing ${field}`);
      try { createRule(e.rule); } catch (error) { fail(`${p}.rule`, String(error)); }
      if (e.kind === 'historical' && (e.rule.fromYear ?? engine.minYear) < Math.max(engine.minYear, Number(e.originalDate.slice(0, 4)))) fail(`${p}.rule`, 'the first anchor year cannot precede the historical event');
    }
  });
  unique(v.events.map((e: Event) => e.id), 'events');
  v.eventCalendars.forEach((input: unknown, i: number) => {
    const p = `eventCalendars[${i}]`, c = object(input, p, ['year', 'coverage', 'sourceIds', 'events']);
    year(c.year, `${p}.year`);
    if (!['complete', 'partial'].includes(c.coverage)) fail(p, 'coverage must be complete or partial');
    sourceIds(c.sourceIds, `${p}.sourceIds`); array(c.events, `${p}.events`);
    c.events.forEach((input: unknown, j: number) => {
      const ep = `${p}.events[${j}]`, e = object(input, ep, ['id', 'date', 'kind', 'names', 'sourceIds', 'eventId']);
      id(e.id, `${ep}.id`); names(e.names, `${ep}.names`); sourceIds(e.sourceIds, `${ep}.sourceIds`);
      if (!['traditional', 'historical', 'observance'].includes(e.kind)) fail(ep, 'unknown event kind');
      const date = isoDate(e.date, `${ep}.date`);
      if (Number(date.slice(0, 4)) !== c.year) fail(`${ep}.date`, `must be in ${c.year}`);
      if (e.eventId !== undefined) { id(e.eventId, `${ep}.eventId`); if (!eventIds.has(e.eventId)) fail(ep, `linked event “${e.eventId}” does not exist`); }
    });
    unique(c.events.map((e: unknown) => (e as EventOccurrence).id), `${p}.events`);
  });
  unique(v.eventCalendars.map((c: EventCalendar) => c.year), 'eventCalendars');
  unique(v.eventCalendars.flatMap((c: EventCalendar) => c.events.map(e => e.id)), 'event occurrence IDs');
  v.holidayCalendars.forEach((input: unknown, i: number) => {
    const p = `holidayCalendars[${i}]`, c = object(input, p, ['year', 'coverage', 'sourceIds', 'holidays']);
    year(c.year, `${p}.year`);
    if (!['complete', 'partial'].includes(c.coverage)) fail(p, 'coverage must be complete or partial');
    array(c.holidays, `${p}.holidays`);
    sourceIds(c.sourceIds, `${p}.sourceIds`, true, c.holidays.every(h => (h as Holiday | null)?.status === 'draft'));
    c.holidays.forEach((input: unknown, j: number) => {
      const hp = `${p}.holidays[${j}]`, h = object(input, hp, ['id', 'names', 'dates', 'status', 'sourceIds', 'eventId', 'note']);
      id(h.id, `${hp}.id`); names(h.names, `${hp}.names`); dates(h.dates, `${hp}.dates`, false, c.year);
      sourceIds(h.sourceIds, `${hp}.sourceIds`, true, h.status === 'draft'); optionalText(h, 'note', hp);
      if (!['draft', 'active', 'cancelled'].includes(h.status)) fail(hp, 'status must be draft, active or cancelled');
      if (h.status === 'cancelled' && !h.note?.trim()) fail(hp, 'a cancellation needs an explanation');
      if (h.eventId !== undefined && !eventIds.has(h.eventId)) fail(hp, `linked event “${h.eventId}” does not exist`);
    });
    unique(c.holidays.map(h => (h as Holiday).id), `${p}.holidays`);
  });
  unique(v.holidayCalendars.map((c: HolidayCalendar) => c.year), 'holidayCalendars');
  v.overrides.forEach((input: unknown, i: number) => {
    const p = `overrides[${i}]`, o = object(input, p, ['eventId', 'year', 'dates', 'sourceId', 'reason']);
    year(o.year, `${p}.year`); dates(o.dates, `${p}.dates`, true);
    for (const date of o.dates) year(Number(date.slice(0, 4)), `${p}.dates`);
    sourceIds([o.sourceId], `${p}.sourceId`); text(o.reason, `${p}.reason`, 5000);
    if (!v.events.some((e: Event) => e.id === o.eventId && e.rule)) fail(p, 'a correction must refer to a recurring event');
    const event = v.events.find((e: Event) => e.id === o.eventId) as Event;
    if (event.kind === 'historical' && o.dates.some((d: string) => d < event.originalDate!)) fail(p, 'a correction cannot precede the original historical date');
  });
  unique(v.overrides.map((o: Override) => `${o.eventId}/${o.year}`), 'overrides');
  return structuredClone(v) as Catalog;
}

export function publicationIssues(data: Catalog): string[] {
  const issues: string[] = [];
  for (const c of data.holidayCalendars) if (!c.sourceIds.length) issues.push(`Add the reviewed government publication for ${c.year} before exporting.`);
  for (const e of data.events) if (!e.names.en.trim() || !e.names.km.trim()) issues.push(`Complete both names for event “${e.id}”.`);
  for (const c of data.eventCalendars) for (const e of c.events) if (!e.names.en.trim() || !e.names.km.trim()) issues.push(`Complete both names for recorded event “${e.id}”.`);
  for (const c of data.holidayCalendars) for (const h of c.holidays) {
    if (h.status === 'draft') issues.push(`Review ${c.year} holiday “${h.id}” against the publication before exporting.`);
    if (!h.names.en.trim() || !h.names.km.trim()) issues.push(`Complete both names for ${c.year} holiday “${h.id}”.`);
  }
  if (!data.events.length && !data.holidayCalendars.length) issues.push('Add events or an official calendar before exporting.');
  return issues;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).filter(k => (value as any)[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical((value as any)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
export function normalize(data: Catalog): Catalog {
  const c = structuredClone(data);
  const byId = (a: {id: string}, b: {id: string}) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  c.sources.sort(byId); c.events.sort(byId); c.eventCalendars.sort((a, b) => a.year - b.year); c.holidayCalendars.sort((a, b) => a.year - b.year);
  c.events.forEach(e => { e.sourceIds.sort(); e.dates?.sort(); });
  c.eventCalendars.forEach(y => { y.sourceIds.sort(); y.events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)); y.events.forEach(e => e.sourceIds.sort()); });
  c.holidayCalendars.forEach(y => { y.sourceIds.sort(); y.holidays.sort(byId); y.holidays.forEach(h => { h.dates.sort(); h.sourceIds.sort(); }); });
  c.overrides.sort((a, b) => (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0) || a.year - b.year);
  c.overrides.forEach(o => o.dates.sort());
  return c;
}
export function changes(before: Catalog, after: Catalog): Change[] {
  const result: Change[] = [];
  if (before.dataVersion !== after.dataVersion) result.push({ section: 'Version', id: after.dataVersion, action: 'changed' });
  function compare(section: string, a: any[], b: any[], key: (v: any) => string) {
    const left = new Map(a.map(v => [key(v), v])), right = new Map(b.map(v => [key(v), v]));
    for (const [id, value] of right) {
      if (!left.has(id)) result.push({ section, id, action: 'added' });
      else if (canonical(left.get(id)) !== canonical(value)) result.push({ section, id, action: 'changed' });
    }
    for (const id of left.keys()) if (!right.has(id)) result.push({ section, id, action: 'removed' });
  }
  const a = normalize(before), b = normalize(after);
  compare('Source', a.sources, b.sources, v => v.id); compare('Event', a.events, b.events, v => v.id);
  compare('Event calendar', a.eventCalendars.map(v => ({ ...v, events: undefined })), b.eventCalendars.map(v => ({ ...v, events: undefined })), v => String(v.year));
  compare('Recorded event', a.eventCalendars.flatMap(c => c.events.map(e => ({ ...e, year: c.year }))), b.eventCalendars.flatMap(c => c.events.map(e => ({ ...e, year: c.year }))), v => `${v.year}/${v.id}`);
  compare('Calendar', a.holidayCalendars.map(v => ({ ...v, holidays: undefined })), b.holidayCalendars.map(v => ({ ...v, holidays: undefined })), v => String(v.year));
  compare('Holiday', a.holidayCalendars.flatMap(c => c.holidays.map(h => ({ ...h, year: c.year }))), b.holidayCalendars.flatMap(c => c.holidays.map(h => ({ ...h, year: c.year }))), v => `${v.year}/${v.id}`);
  compare('Correction', a.overrides, b.overrides, v => `${v.eventId}/${v.year}`);
  return result;
}
