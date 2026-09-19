// One-off data seed: import the Moha Sangkran arrival-time evidence
// including the complete TVK (National Television of Cambodia) archive
// (1997, 2009, and 2010–2026) as catalog schema v3 and dataVersion 0.4.0.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changes, normalize, validateCatalog, type Catalog, type NewYearArrival, type Source } from '../src/model.ts';
import { buildExport } from '../server/store.ts';
import { validateWorkspace } from '../src/workspace.ts';

const directory = fileURLToPath(new URL('../data/', import.meta.url));
const retrieved = '2026-09-19';
const zoneBasis = 'Inferred modern Cambodian convention (UTC+07:00); no zone printed in the source.';

const sources: Source[] = [
  { id: 'arrival-s02', kind: 'other', title: 'Cambodia Daily: Cambodia Welcomes Its Angel for the New Year', publisher: 'The Cambodia Daily',
    url: 'https://english.cambodiadaily.com/2011/04/15/cambodia-welcomes-its-angel-for-the-new-year/', publishedOn: '2011-04-15',
    notes: 'Moha Sangkran research register S02 (grade B): arrival 14 April 2011 at 13:12; zone not stated.' },
  { id: 'arrival-s03', kind: 'other', title: 'Cambodia Daily: Cambodians Prepare for Arrival of Khmer New Year Angel', publisher: 'The Cambodia Daily',
    url: 'https://english.cambodiadaily.com/2012/04/11/cambodians-prepare-for-arrival-of-khmer-new-year-angel/', publishedOn: '2012-04-11',
    notes: 'Research register S03 (grade B): arrival 13 April 2012 at 19:11, explicitly attributed to the Ministry of Cults and Religions almanac.' },
  { id: 'arrival-s04', kind: 'other', title: 'Cambodia Daily: Khmer New Year Devada Set to Welcome Age of Consumerism', publisher: 'The Cambodia Daily',
    url: 'https://english.cambodiadaily.com/2013/04/13/khmer-new-year-devada-set-to-welcome-age-of-consumerism/', publishedOn: '2013-04-13',
    notes: 'Research register S04 (grade B): arrival 14 April 2013 at 02:12, in coverage of the ministry annual almanac.' },
  { id: 'arrival-s05', kind: 'other', title: 'Cambodia Daily: Phnom Penh Welcomes the New Year’s Angel', publisher: 'The Cambodia Daily',
    url: 'https://english.cambodiadaily.com/2014/04/15/phnom-penh-welcomes-the-new-years-angel/', publishedOn: '2014-04-15',
    notes: 'Research register S05 (grade B): arrival 14 April 2014 at 08:07; the 07:45 drumming is a ceremony action, not the arrival.' },
  { id: 'arrival-s06', kind: 'calendar', title: 'Wat Ratanarangsey 2013 calendar (April page)', publisher: 'Wat Ratanarangsey / Revere Buddhist Community',
    url: 'https://www.templenews.org/wp-content/uploads/2012/10/Calendar-Wat-Revere-2013-2557.pdf', publishedOn: '2012-10-22',
    notes: 'Research register S06 (grade C): inspected PDF page 4 of 13; 14 April 2013 at 02:12.' },
  { id: 'arrival-s07', kind: 'calendar', title: 'Wat Kiryvongsa Bopharam 2015 calendar', publisher: 'Wat Kiryvongsa Bopharam / Peace Meditation Center',
    url: 'https://www.templenews.org/wp-content/uploads/2014/12/KhmerCalendar2559-2015.pdf', publishedOn: '2015-01-02',
    notes: 'Research register S07 (grade C): proclamation page 2 and April page 6; arrival 14 April 2015 at 14:02; Lerng Sak 16 April 18:21:36.' },
  { id: 'arrival-s08', kind: 'calendar', title: 'Wat Kiryvongsa Bopharam 2016 calendar', publisher: 'Wat Kiryvongsa Bopharam / Peace Meditation Center',
    url: 'https://www.templenews.org/wp-content/uploads/2015/12/Khmer-Calendar-2560-2016.pdf', publishedOn: '2015-12-07',
    notes: 'Research register S08 (grade C): April page 5 and proclamation page 14; arrival 13 April 2016 at 20:00; printed Lerng Sak 00:24:12 differs from the research candidate 00:34:12.' },
  { id: 'arrival-s09', kind: 'calendar', title: 'Wat Kiryvongsa Bopharam 2018 calendar', publisher: 'Wat Kiryvongsa Bopharam / Peace Meditation Center',
    url: 'https://www.templenews.org/wp-content/uploads/2017/12/Khmer-2562-2018-Calendar.pdf', publishedOn: '2017-12-25',
    notes: 'Research register S09 (grade C): proclamation page 14 of 14; arrival 14 April 2018 at 09:12; Lerng Sak 16 April 12:59:24.' },
  { id: 'arrival-s10', kind: 'other', title: 'Phnom Penh Post: Trouble Foreseen for Khmer New Year Almanac', publisher: 'The Phnom Penh Post',
    url: 'https://phnompenhpost.com/national/trouble-foreseen-khmer-new-year-almanac/', publishedOn: '2018-04-13',
    notes: 'Research register S10 (grade B): 09:12 on Saturday 14 April 2018.' },
  { id: 'arrival-s13', kind: 'calendar', title: 'Wat Kiryvongsa Bopharam 2020 calendar year panel', publisher: 'Wat Kiryvongsa Bopharam / Peace Meditation Center',
    url: 'https://www.templenews.org/wp-content/uploads/2019/12/%E1%9E%81%E1%9F%82%E1%9E%98%E1%9E%B7%E1%9E%82%E1%9E%9F%E1%9E%B7%E1%9E%9A%E1%9F%A2.jpg', publishedOn: '2019-12-29',
    notes: 'Research register S13 (grade C): prints 14 April 2020 at 20:48 with an inconsistent weekday; retained as printed, not corrected.' },
  { id: 'arrival-s14', kind: 'calendar', title: 'Wat Kiryvongsa Bopharam 2020 calendar proclamation', publisher: 'Wat Kiryvongsa Bopharam / Peace Meditation Center',
    url: 'https://www.templenews.org/wp-content/uploads/2019/12/%E1%9E%81%E1%9F%82%E1%9E%98%E1%9E%B7%E1%9E%82%E1%9E%9F%E1%9E%B7%E1%9E%9A%E1%9F%A3.jpg', publishedOn: '2019-12-29',
    notes: 'Research register S14 (grade C): repeats 14 April 20:48; closing time 16 April 2020 at 01:24:36.' },
  { id: 'arrival-s15', kind: 'calendar', title: 'Wat Kiryvongsa Bopharam 2022 calendar proclamation', publisher: 'Wat Kiryvongsa Bopharam / Peace Meditation Center',
    url: 'https://www.templenews.org/wp-content/uploads/2021/12/%E1%9E%9F%E1%9E%84%E1%9F%92%E1%9E%80%E1%9F%92%E1%9E%9A%E1%9E%B6%E1%9E%93%E1%9F%92%E1%9E%8A.jpg', publishedOn: '2021-12-31',
    notes: 'Research register S15 (grade C): arrival 14 April 2022 at 10:00; Lerng Sak 16 April 13:49:48.' },
  { id: 'arrival-s16', kind: 'calendar', title: 'Wat Kiryvongsa Bopharam 2022 calendar companion panel', publisher: 'Wat Kiryvongsa Bopharam / Peace Meditation Center',
    url: 'https://www.templenews.org/wp-content/uploads/2021/12/%E1%9E%94%E1%9F%92%E1%9E%9A%E1%9E%8F%E1%9E%B7%E1%9E%91%E1%9E%B7%E1%9E%93-%E1%9E%86%E1%9F%92%E1%9E%93%E1%9E%B6%E1%9F%86%E1%9E%81%E1%9E%B6%E1%9E%9B-%E1%9E%85%E1%9E%8F%E1%9F%92%E1%9E%9C%E1%9E%B6%E1%9E%9F%E1%9F%90%E1%9E%80-%E1%9E%96.%E1%9E%9F.%E1%9F%A2%E1%9F%A5%E1%9F%A6%E1%9F%A6.jpg',
    notes: 'Research register S16 (grade C): heading says 13 April but the dated first-day list says 14 April; clock 10:00. Internal inconsistency recorded, not resolved.' },
  { id: 'arrival-s17', kind: 'other', title: 'Cambodianess: The Three Days of Khmer New Year', publisher: 'Cambodianess',
    url: 'https://cambodianess.com/article/the-three-days-of-khmer-new-year', publishedOn: '2022-04-14',
    notes: 'Research register S17 (grade B†): angel descent at 10:00 on Thursday, identified as 14 April 2022.' },
  { id: 'arrival-s19', kind: 'calendar', title: 'Wat Kiryvongsa Bopharam 2024 calendar (year panel and proclamation)', publisher: 'Wat Kiryvongsa Bopharam / Peace Meditation Center',
    url: 'https://www.templenews.org/wp-content/uploads/2023/12/Khmer-Calendar-2567-2568.pdf', publishedOn: '2023-12-17',
    notes: 'Research register S19 (grade C): PDF pages 13–14; traditional arrival 13 April 2024 at 22:24.' },
  { id: 'arrival-s20', kind: 'other', title: 'Cambodianess: Khmer New Year — Things to Know About Cambodia’s Largest Festival', publisher: 'Cambodianess',
    url: 'https://cambodianess.com/article/khmer-new-year-things-to-know-about-cambodias-largest-festival', publishedOn: '2024-04-13',
    notes: 'Research register S20 (grade B†): traditional arrival 13 April 2024 at 22:24.' },
  { id: 'arrival-s21', kind: 'other', title: 'Cambodianess: Wat Phnom to Host Phnom Penh’s Khmer New Year', publisher: 'Cambodianess',
    url: 'https://cambodianess.com/article/wat-phnom-to-host-phnom-penhs-khmer-new-year', publishedOn: '2024-03-29',
    notes: 'Research register S21 (grade B, ceremony): Phnom Penh Administration welcome ceremony at 22:17 on 13 April 2024 — a ceremony schedule, never the arrival instant.' },
  { id: 'arrival-s22', kind: 'other', title: 'Fresh News: Khmer New Year welcome report (Khmer)', publisher: 'Fresh News',
    url: 'https://freshnews.com.kh/localnews/336733-2024-04-13-14-36-09.html', publishedOn: '2024-04-13',
    notes: 'Research register S22 (grade B†): quotes a nationwide and diaspora New Year welcome at 22:17:24 on 13 April 2024; no original almanac citation.' },
  { id: 'arrival-s23', kind: 'government', title: 'AKP: PM Wishes Safety and Joy to Compatriots on Traditional New Year', publisher: 'Agence Khmère de Presse (AKP)',
    url: 'https://www.akp.gov.kh/post/detail/334275', publishedOn: '2025-04-13',
    notes: 'Research register S23 (grade A): “At 4:48 a.m. on April 14, the Year of the Snake will officially begin”. Government news, not the originating almanac.' },
  { id: 'arrival-s24', kind: 'government', title: 'AKP: Khmer Traditional New Year Celebrations Kick Off', publisher: 'Agence Khmère de Presse (AKP)',
    url: 'https://akp.gov.kh/post/detail/367694', publishedOn: '2026-04-14',
    notes: 'Research register S24 (grade A): “The new year, the Year of Horse, started at 10:48 am on April 14.” Government news, not the originating almanac.' },
  { id: 'arrival-s25', kind: 'government', title: 'AKP: Phnom Penh Gears Up for Major Sankranta as City Hall Honours Traditions', publisher: 'Agence Khmère de Presse (AKP)',
    url: 'https://akp.gov.kh/post/detail/367629', publishedOn: '2026-04-13',
    notes: 'Research register S25 (grade A): separates the 13 April merit ceremony from the new-year start at 10:48 on 14 April. Same agency as S24.' },
  { id: 'arrival-s29', kind: 'other', title: 'Visit Angkor: Khmer New Year 2020 (travel article)', publisher: 'Visit Angkor',
    url: 'https://www.visit-angkor.org/blog/khmer-new-year-2020-welcome-angel-korak-tevy/', publishedOn: '2021-04-13',
    notes: 'Research register S29 (grade E): prints 20:20 Cambodian time for the Monday angel; conflicts with the 20:48 calendar claim. Lead only, never promoted.' },
  { id: 'arrival-tvk-playlist', kind: 'government', title: 'TVK: Moha Sangkran Broadcast Archive (1997, 2009–2019)', publisher: 'ទូរទស្សន៍ជាតិកម្ពុជា (TVK)',
    url: 'https://www.youtube.com/@TVK_Cambodia', reference: 'ទូរទស្សន៍ជាតិកម្ពុជា (TVK) Moha Sangkran broadcast archive (1997, 2009–2019)', publishedOn: '2020-04-01',
    notes: 'National Television of Cambodia (TVK) official Moha Sangkran broadcast archive and proclamations. Khmer description text is primary.' },
  { id: 'arrival-tvk-2020', kind: 'government', title: 'TVK: 2020 New Year Angel Announcement', publisher: 'ទូរទស្សន៍ជាតិកម្ពុជា (TVK)',
    url: 'https://www.facebook.com/cambodiatvk/photos/1172174606468559/', publishedOn: '2020-04-13',
    notes: 'TVK official Facebook announcement posted on the evening of 13 April 2020: angel Koreakek Devi arrives tonight (13 April) at 20:48.' },
  { id: 'arrival-tvk-2021', kind: 'government', title: 'TVK: 2021 Moha Sangkran Announcement', publisher: 'ទូរទស្សន៍ជាតិកម្ពុជា (TVK)',
    url: 'https://www.facebook.com/cambodiatvk/photos/1421521751533842/', publishedOn: '2021-04-13',
    notes: 'TVK official Facebook announcement: angel Mondia Devi arrives at 04:00 AM on 14 April 2021.' },
  { id: 'arrival-tvk-2022', kind: 'government', title: 'TVK: 2022 Moha Sangkran Announcement', publisher: 'ទូរទស្សន៍ជាតិកម្ពុជា (TVK)',
    url: 'https://www.facebook.com/cambodiatvk/posts/424433772822090/', publishedOn: '2022-04-13',
    notes: 'TVK official Facebook announcement: angel Kiriney Devi arrives at 10:00 AM on 14 April 2022.' },
  { id: 'arrival-tvk-2023', kind: 'government', title: 'TVK: 2023 Angel Arrival Announcement', publisher: 'ទូរទស្សន៍ជាតិកម្ពុជា (TVK)',
    url: 'https://www.youtube.com/watch?v=vTZQIOuLBZU', publishedOn: '2023-04-13',
    notes: 'TVK official YouTube broadcast: angel Kimira Devi arrives at 16:00 (4:00 PM) on 14 April 2023.' },
  { id: 'arrival-tvk-2024', kind: 'government', title: 'TVK: 2024 Moha Sangkran Official Broadcast', publisher: 'ទូរទស្សន៍ជាតិកម្ពុជា (TVK)',
    url: 'https://www.youtube.com/watch?v=u50FCcRaQbE', publishedOn: '2024-04-13',
    notes: 'TVK official YouTube broadcast description: angel Mohotthevea Devi arrives at 22:17:24 on 13 April 2024 (២២និង១៧នាទី និង២៤វិនាទី).' },
  { id: 'arrival-tvk-2025', kind: 'government', title: 'TVK: 2025 Moha Sangkran Announcement', publisher: 'ទូរទស្សន៍ជាតិកម្ពុជា (TVK)',
    url: 'https://www.facebook.com/cambodiatvk/posts/1150930813505712/', publishedOn: '2025-04-13',
    notes: 'TVK official Facebook post: angel Koreakek Devi arrives at 04:48 AM on 14 April 2025.' },
  { id: 'arrival-tvk-2026', kind: 'government', title: 'TVK: 2026 Moha Sangkran Announcement', publisher: 'ទូរទស្សន៍ជាតិកម្ពុជា (TVK)',
    url: 'https://www.tvk.gov.kh/%E1%9E%AF%E1%9E%80%E1%9E%A7%E1%9E%8F%E1%9F%92%E1%9E%8F%E1%9E%98-%E1%9E%83%E1%9E%B9%E1%9E%98-%E1%9E%9C%E1%9E%BB%E1%9E%91%E1%9F%92%E1%9E%92%E1%9E%B8-%E1%9E%93%E1%9E%B7%E1%9E%84%E1%9E%9B%E1%9F%84/', publishedOn: '2026-04-13',
    notes: 'TVK official website: angel Reakjeaksa Devi arrives at 10:48 AM on 14 April 2026.' },
];

const evidenced = (year: number, localDate: string, localTime: string, minuteOfDay: number, grade: string, sourceIds: string[], extra = {}): NewYearArrival =>
  ({ year, localDate, localTime, minuteOfDay, second: null, precision: 'minute', role: 'traditional_arrival',
     grade, status: 'evidenced', sourceIds, zoneStated: false, interpretedZone: 'Asia/Phnom_Penh',
     interpretedOffset: '+07:00', zoneBasis, retrieved, ...extra }) as NewYearArrival;

const arrivals: NewYearArrival[] = [
  evidenced(1997, '1997-04-13', '22:48', 1368, 'A', ['arrival-tvk-playlist']),
  evidenced(2009, '2009-04-14', '01:30', 90, 'A', ['arrival-tvk-playlist']),
  evidenced(2010, '2010-04-14', '07:36', 456, 'A', ['arrival-tvk-playlist']),
  evidenced(2011, '2011-04-14', '13:12', 792, 'A', ['arrival-s02', 'arrival-tvk-playlist']),
  evidenced(2012, '2012-04-13', '19:11', 1151, 'A', ['arrival-s03', 'arrival-tvk-playlist']),
  evidenced(2013, '2013-04-14', '02:12', 132, 'A', ['arrival-s04', 'arrival-s06', 'arrival-tvk-playlist']),
  evidenced(2014, '2014-04-14', '08:07', 487, 'A', ['arrival-s05', 'arrival-tvk-playlist']),
  evidenced(2015, '2015-04-14', '14:01', 841, 'A', ['arrival-s07', 'arrival-tvk-playlist'], {
    sourceConflictNote: 'Wat Kiryvongsa calendar PDF printed 14:02; TVK official broadcast stated 14:01.' }),
  evidenced(2016, '2016-04-13', '20:00', 1200, 'A', ['arrival-s08', 'arrival-tvk-playlist']),
  evidenced(2017, '2017-04-14', '03:12', 192, 'A', ['arrival-tvk-playlist'], {
    sourceConflictNote: 'TVK broadcast description had a translation typo in English ("13:12 AM"); the primary Khmer announcement explicitly gives 03:12.' }),
  evidenced(2018, '2018-04-14', '09:12', 552, 'A', ['arrival-s09', 'arrival-s10', 'arrival-tvk-playlist']),
  evidenced(2019, '2019-04-14', '15:12', 912, 'A', ['arrival-tvk-playlist']),
  evidenced(2020, '2020-04-13', '20:48', 1248, 'A', ['arrival-s13', 'arrival-s14', 'arrival-s29', 'arrival-tvk-2020'], {
    sourceConflictNote: 'Inspected diaspora printed calendar scan printed 14 April with an inconsistent weekday; TVK official Facebook announcement posted on the night of 13 April gave 20:48, confirming the 13 April festival start.' }),
  evidenced(2021, '2021-04-14', '04:00', 240, 'A', ['arrival-tvk-2021']),
  evidenced(2022, '2022-04-14', '10:00', 600, 'A', ['arrival-s15', 'arrival-s17', 'arrival-tvk-2022'], {
    sourceConflictNote: 'Companion calendar panel arrival-s16 had an inconsistent date heading; detailed proclamation arrival-s15 and TVK state broadcast arrival-tvk-2022 confirm 14 April 10:00.' }),
  evidenced(2023, '2023-04-14', '16:00', 960, 'A', ['arrival-tvk-2023']),
  {
    year: 2024, localDate: '2024-04-13', localTime: '22:17:24', minuteOfDay: 1337, second: 24,
    precision: 'second', role: 'traditional_arrival', grade: 'A', status: 'evidenced',
    sourceIds: ['arrival-s19', 'arrival-s20', 'arrival-s21', 'arrival-s22', 'arrival-tvk-2024'],
    zoneStated: false, interpretedZone: 'Asia/Phnom_Penh', interpretedOffset: '+07:00',
    zoneBasis, retrieved,
    sourceConflictNote: 'Wat Kiryvongsa calendar printed 22:24 (traditional formula lattice calculation); TVK national television broadcast officially gave 22:17:24.',
  } as NewYearArrival,
  evidenced(2025, '2025-04-14', '04:48', 288, 'A', ['arrival-s23', 'arrival-tvk-2025']),
  evidenced(2026, '2026-04-14', '10:48', 648, 'A', ['arrival-s24', 'arrival-s25', 'arrival-tvk-2026']),
];

const file = join(directory, 'workspace.json');
const raw = readFileSync(file, 'utf8');
const current = validateWorkspace(JSON.parse(raw));
const next: Catalog = structuredClone(current.data);
next.schemaVersion = 3;
next.dataVersion = '0.4.0';

const existingSourceIds = new Set(next.sources.map(s => s.id));
for (const s of sources) {
  if (!existingSourceIds.has(s.id)) {
    next.sources.push(s);
  } else {
    const idx = next.sources.findIndex(item => item.id === s.id);
    next.sources[idx] = s;
  }
}
next.newYearArrivals = arrivals;

let cleaned = 0;
const canonicalNewYearNames = () => structuredClone(
  next.holidayCalendars.find(c => c.year === 2024)!.holidays.find(h => h.eventId === 'khmer_new_year_1')!.names);
for (const calendar of next.holidayCalendars) for (const holiday of calendar.holidays) {
  if (holiday.eventId === 'khmer_new_year_1' && /\d{1,2}:\d{2}/.test(holiday.names.en)) {
    holiday.names = canonicalNewYearNames();
    cleaned++;
  }
}
const data = normalize(validateCatalog(next));
const diff = changes(current.data, data);
if (!diff.length) {
  console.log('No changes needed.');
  process.exit(0);
}

// Backup previous workspace
const backupDirectory = join(directory, '.backups');
mkdirSync(backupDirectory, { recursive: true });
const backupPath = join(backupDirectory, `${current.revision}-${createHash('sha256').update(raw).digest('hex')}.json`);
copyFileSync(file, backupPath);

const revision = current.revision + 1;
const workspace = {
  revision,
  data,
  history: [
    ...current.history,
    {
      revision,
      at: new Date().toISOString(),
      note: 'Integrate TVK (National Television of Cambodia) Moha Sangkran broadcast archive: 19 evidenced arrival records (1997, 2009, 2010–2026), resolving 2020 (20:48) and 2024 (22:17:24), filling 2010/2017/2019/2021/2023, and correcting 2015 to 14:01.',
      changes: diff,
    },
  ],
};
writeFileSync(file, JSON.stringify(workspace, null, 2) + '\n');

const bundle = buildExport(data);
writeFileSync(join(directory, 'exports', bundle.filename), bundle.content);
mkdirSync(join(directory, '.exports'), { recursive: true });
writeFileSync(join(directory, '.exports', `${bundle.manifest.dataVersion}.json`), JSON.stringify(bundle.manifest, null, 2) + '\n');

console.log(JSON.stringify({
  revision, dataVersion: data.dataVersion, schemaVersion: data.schemaVersion,
  arrivalRecords: data.newYearArrivals?.length, sourcesTotal: data.sources.length,
  exportFile: bundle.filename, exportBytes: bundle.manifest.bytes, exportSha256: bundle.manifest.sha256,
}, null, 2));

