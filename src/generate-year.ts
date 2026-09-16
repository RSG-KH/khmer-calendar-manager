import { createRule, type RuleInput } from 'khmer-calendar-engine';
import { engine, validateCatalog, year, type Catalog, type Holiday } from './model.ts';

// A starting list for modern years, based on the LRC's 2026 publication:
// https://lrc.gov.kh/en/annual-holiday-calendar-2026/
// These definitions suggest dates; only developer review establishes official leave.
export const FIRST_TEMPLATE_YEAR = 2026;
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;
type Pattern = { id: string; en: string; km: string; rule?: WithoutId<RuleInput> };
const patterns: Pattern[] = [
  { id: 'new-year', en: 'International New Year’s Day', km: 'ទិវាចូលឆ្នាំសកល', rule: { type: 'solar', month: 1, day: 1 } },
  { id: 'victory', en: 'Victory Day over Genocide', km: 'ទិវាជ័យជម្នះលើរបបប្រល័យពូជសាសន៍', rule: { type: 'solar', month: 1, day: 7 } },
  { id: 'women', en: 'International Women’s Day', km: 'ទិវាអន្តរជាតិនារី', rule: { type: 'solar', month: 3, day: 8 } },
  { id: 'khmer-new-year', en: 'Khmer New Year', km: 'ពិធីបុណ្យចូលឆ្នាំថ្មីប្រពៃណីជាតិ' },
  { id: 'labour', en: 'International Labour Day', km: 'ទិវាពលកម្មអន្តរជាតិ', rule: { type: 'solar', month: 5, day: 1 } },
  { id: 'visak', en: 'Visak Bochea', km: 'ពិធីបុណ្យវិសាខបូជា', rule: { type: 'khmer_lunar', month: 5, day: 15, waxing: true } },
  { id: 'ploughing', en: 'Royal Ploughing Ceremony', km: 'ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល', rule: { type: 'khmer_lunar', month: 5, day: 4, waxing: false } },
  { id: 'king-birthday', en: 'King Norodom Sihamoni’s Birthday', km: 'ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្ម ព្រះករុណាព្រះបាទសម្ដេចព្រះបរមនាថ នរោត្តម សីហមុនី', rule: { type: 'solar', month: 5, day: 14 } },
  { id: 'queen-birthday', en: 'Queen Mother’s Birthday', km: 'ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្ម សម្ដេចព្រះមហាក្សត្រី នរោត្តម មុនិនាថ សីហនុ', rule: { type: 'solar', month: 6, day: 18 } },
  { id: 'constitution', en: 'Constitution Day', km: 'ទិវាប្រកាសរដ្ឋធម្មនុញ្ញ', rule: { type: 'solar', month: 9, day: 24 } },
  { id: 'pchum', en: 'Pchum Ben Festival', km: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ', rule: { type: 'khmer_lunar', month: 9, day: 15, waxing: false, offset: -1, duration: 3 } },
  { id: 'king-father', en: 'King Father’s Commemoration Day', km: 'ទិវាប្រារព្ធពិធីគោរពព្រះវិញ្ញាណក្ខន្ធ ព្រះបរមរតនកោដ្ឋ', rule: { type: 'solar', month: 10, day: 15 } },
  { id: 'coronation', en: 'King Norodom Sihamoni’s Coronation Day', km: 'ព្រះរាជពិធីគ្រងព្រះបរមរាជសម្បត្តិ ព្រះករុណាព្រះបាទសម្ដេចព្រះបរមនាថ នរោត្តម សីហមុនី', rule: { type: 'solar', month: 10, day: 29 } },
  { id: 'independence', en: 'Independence Day', km: 'ពិធីបុណ្យឯករាជ្យជាតិ', rule: { type: 'solar', month: 11, day: 9 } },
  { id: 'water', en: 'Water Festival', km: 'ព្រះរាជពិធីបុណ្យអុំទូក បណ្ដែតប្រទីប និងសំពះព្រះខែ អកអំបុក', rule: { type: 'khmer_lunar', month: 11, day: 14, waxing: true, duration: 3 } },
  { id: 'peace', en: 'Peace Day in Cambodia', km: 'ទិវាសន្តិភាពនៅកម្ពុជា', rule: { type: 'solar', month: 12, day: 29 } },
];

export function generateYear(data: Catalog, selectedYear: number): Catalog {
  year(selectedYear, 'Year');
  if (selectedYear < FIRST_TEMPLATE_YEAR) throw new Error(`The modern starting list supports ${FIRST_TEMPLATE_YEAR} onward. Enter historical official lists from their publications.`);
  if (data.holidayCalendars.some(c => c.year === selectedYear)) throw new Error('This year already has a list. Edit it to preserve your corrections.');
  const holidays: Holiday[] = patterns.map(p => ({
    id: p.id, names: { en: p.en, km: p.km }, status: 'draft', sourceIds: [],
    dates: p.rule
      ? engine.evaluateRule(selectedYear, createRule({ ...p.rule, id: p.id })).map(o => o.date.iso)
      : engine.newYear(selectedYear).dates.map(d => d.iso),
  }));
  return validateCatalog({ ...data, holidayCalendars: [...data.holidayCalendars, { year: selectedYear, coverage: 'partial', sourceIds: [], holidays }] });
}

export function confirmYear(data: Catalog, selectedYear: number, sourceId: string, coverage: 'partial' | 'complete'): Catalog {
  const next = structuredClone(data), calendar = next.holidayCalendars.find(c => c.year === selectedYear);
  if (!calendar || !calendar.holidays.some(h => h.status === 'draft')) throw new Error('No unreviewed holidays in this year.');
  if (!next.sources.some(s => s.id === sourceId && s.kind === 'government')) throw new Error('Choose the government publication you checked.');
  calendar.coverage = coverage;
  calendar.sourceIds = [...new Set([...calendar.sourceIds, sourceId])];
  for (const holiday of calendar.holidays) if (holiday.status === 'draft') {
    holiday.status = 'active';
    holiday.sourceIds = [...new Set([...holiday.sourceIds, sourceId])];
  }
  return validateCatalog(next);
}
