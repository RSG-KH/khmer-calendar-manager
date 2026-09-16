import { emptyCatalog, type Catalog, type Source } from '../src/model.ts';

// Synthetic data used only in isolated tests; these are not actual government publications.
export const source: Source = { id: 'test-government', title: 'Test government publication', publisher: 'Test issuer', kind: 'government', url: 'https://example.org/test-publication' };
export function catalog(): Catalog {
  return { ...emptyCatalog(), sources: [structuredClone(source)], events: [{
    id: 'test-lent', kind: 'traditional', names: { en: 'Test lunar event', km: 'សាកល្បង' }, sourceIds: [source.id],
    rule: { id: 'test-lent', type: 'khmer_lunar', month: 7, day: 1, waxing: false, monthPolicy: 'ordinary_or_second_asadh' },
  }] };
}
export function holidayImport(entries = [{ id: 'test-holiday', names: { en: 'Test holiday', km: 'សាកល្បង' }, dates: ['2026-07-30'], status: 'active' }], coverage = 'partial') {
  return JSON.stringify({ schemaVersion: 1, type: 'official-holidays', source, year: 2026, coverage, holidays: entries });
}
