# Data format — version 3

The manager owns the catalog schema. Recurrence configurations use the engine's public rule contract. Unknown fields, duplicate IDs/dates, invalid dates and missing source references are rejected.

## Canonical catalog

`data/workspace.json` contains `{ revision, data, history }`. `data` is the catalog accepted by a full JSON import and emitted by an export:

```json
{
  "schemaVersion": 3,
  "dataVersion": "0.4.2",
  "sources": [],
  "events": [],
  "eventCalendars": [],
  "holidayCalendars": [],
  "overrides": [],
  "newYearArrivals": []
}
```

Schema version 3 adds the `newYearArrivals` evidence section; version 2 catalogs remain valid without it, and version 1 catalogs upgrade in memory as before. A version 2 catalog carrying the arrival section is rejected — move it to version 3.

IDs use lowercase letters, digits, hyphens, underscores or dots, start with a letter/digit, and are at most 80 characters. Dates use `YYYY-MM-DD`. Official calendar years and calculation previews support 1800–2200; original historical dates and explicit records can use Gregorian years 1–9999.

| Record | Fields |
| --- | --- |
| Source | `id`, `title`, `publisher`, `kind`; optional `url`, `reference`, `publishedOn`, `notes` |
| Event | `id`, `kind`, `names`, `sourceIds`; either `dates` or `rule`; optional `description`, `originalDate`, `anniversaryBase` |
| Recorded-event calendar | `year`, `coverage`, `sourceIds`, `events` |
| Recorded occurrence | `id`, `date`, `kind`, `names`, `sourceIds`; optional `eventId` linking a recurrence definition |
| Yearly calendar | `year`, `coverage`, `sourceIds`, `holidays` |
| Holiday | `id`, `names`, `dates`, `status`, `sourceIds`; optional `eventId`, `note` |
| Correction | `eventId`, `year`, `dates`, `sourceId`, `reason` |
| New Year arrival (v3) | `year`, `status`, `sourceIds`, `zoneStated`, `interpretedZone`, `retrieved`; optional `interpretedOffset`, `zoneBasis`, `sourceConflictNote` |
| New Year arrival, evidenced | adds `localDate`, `localTime`, `minuteOfDay`, `second`, `precision`, `role`, `grade` |
| New Year arrival, disputed | adds `disputeReason`, `claims`; claim fields are `localDate`, `localTime`, `precision`, `sourceIds`, optional `role` |

Names and descriptions are objects with `en` and `km` strings. Draft names require at least one language; exports require both names. Description text is optional. Source kinds are `government`, `calendar`, `historical` or `other`; a source needs a URL or document reference. URLs are HTTP(S); source records are not fetched or automatically authenticated.

Event kinds are `traditional`, `historical` or `observance`. Historical events require `originalDate`. An event has either a non-empty array of explicit dates, or an engine rule with the same ID. Annual commemorations must not start before the original historical event; preview dates before the original date are excluded, including earlier days in its first year.

`anniversaryBase` is available only on a recurring event whose English or Khmer name contains `{anniversary}`; by convention **both** names carry it (English as a ` · {anniversary}` suffix, Khmer as a ` ខួបលើកទី{anniversary}` suffix). Official holiday entries linked to such an event via `eventId` follow the same English convention; their Khmer side carries the placeholder or, for years captured from printed sub-decrees (2025–2026), the baked count. Preview and consumer output replace the placeholder with `year - anniversaryBase`, using Khmer numerals in the Khmer name and an English ordinal (1st/2nd/3rd/…/11th–13th/21st/…) in the English name, e.g. `Victory Over Genocide Day · 47th` for base 1979 in 2026. By convention the rule's `fromYear` is `anniversaryBase + 1` (the first ខួប), while a companion date-backed milestone event carries the original historical date so the base year never renders an awkward "0th" anniversary.

Rules support `solar`, `solar_nth_weekday`, `khmer_lunar`, `chinese_festival`, `new_year_first`, `new_year_middle` and `new_year_last`. Gregorian/lunar rules must explicitly supply month/day, lunar rules also supply `waxing`, and weekday rules supply `occurrence`. Chinese festival rules require rule `id` to match one of the 9 traditional festival identifiers, with `monthPolicy` set to `"cn-reference-utc8"` (Tong Shu reference standard) or `"archive-v1"`. Engine options include effective anchor years, offset and duration. Lunar month 7 with `monthPolicy: "ordinary_or_second_asadh"` covers ordinary and leap-month years. Calculations are delegated to the installed engine package.

A correction replaces one recurring event's complete occurrence list for an **anchor year**. Empty `dates` cancels that year's calculated occurrences. A source and reason are mandatory. This changes the event occurrence only; any government holiday designation is maintained separately.

## Recorded event calendars and streamlined events

Schema version 2 supports recorded event calendars (`eventCalendars`) to preserve dated source observations separately from reusable recurrence definitions. Every occurrence has a stable ID, one date, bilingual names and source provenance; `eventId` links it to a rule when a reviewed mapping exists.

- A `complete` recorded calendar is the event result for that year. Rule calculations are suppressed, matching the Android archive-precedence behavior.
- A `partial` recorded calendar supplements calculations. A linked occurrence on the same date replaces the calculated row instead of duplicating it.
- Official holiday calendars remain a separate evidence layer. A holiday matching a recorded occurrence or linked rule/date enriches the preview rather than creating a duplicate occurrence.

### Streamlined dynamic and date-backed events
For lightweight runtime consumption in downstream applications (Android and PWA), the canonical catalog in `data/workspace.json` streamlines this model:
- All 9 traditional Chinese festivals (Chinese New Year, Lantern/Spirit Parade, Qingming, Zongzi, Ghost Festival, Mid-Autumn, Winter Solstice, etc.) are computed dynamically across 1900–2100 via `chinese_festival` recurrence rules (`monthPolicy: "cn-reference-utc8"`). Three explicit `overrides` document historical published archive parity for Qingming (2009, 2029) and Zongzi (2013).
- Remaining non-rule events (26 UNESCO/historical milestones, including the 10 pre-2000 origin dates such as Victory Day 1979-01-07 and Independence 1953-11-09, plus the 1984 Day of Hatred) are modeled directly as first-class `Event` records in `events` with explicit `dates: ["YYYY-MM-DD", ...]`.
- Consequently, `eventCalendars` is kept empty (`[]`), dropping the uncompressed JSON export bundle down to ~131 KB and eliminating the need for client apps to implement archive-versus-rule precedence logic.
- Schema-v1 and v2 catalogs are accepted and upgraded in memory. New exports use schema version 3 (which added the `newYearArrivals` catalog section).

### Standardized official holiday calendars
Official holiday calendars (`holidayCalendars`) across all confirmed years (2016–2027) are standardized as individual per-day entries (283 total off-days across 12 consecutive years):
- **Single-Day Scope**: Each entry covers exactly one off-day date (`dates: ["YYYY-MM-DD"]`).
- **Explicit `eventId`**: Every holiday entry provides an `eventId` referencing its canonical recurrence rule in `events` (e.g. `khmer_new_year_1`, `pchum_ben_festival`, `water_festival`, `new_year_day`), allowing client apps (Android, PWA) to unambiguously match official leave to calculated observances with zero duplicate rendering.
- **Day-Specific Names**: Multi-day holidays carry their traditional day-specific titles (e.g. Khmer New Year Days 1–3: *Moha Sankranta*, *Veareak Vanabat*, *Veareak Laeung Sak*). The three Pchum Ben leave days follow the same convention: *Ben 14* (១៤ រោច), *Pchum Ben Festival* (១៥ រោច) and *Post Pchum Ben Festival* (the travel-bonus day after the festival). The official Anukret lists all three as ពិធីបុណ្យភ្ជុំបិណ្ឌ (Pchum Ben Festival) — the per-day titles are deliberate display labels recorded in each entry's ; do not override them back to the single sub-decree title.
- **Clean Citations**: Government decrees provide their official Khmer decree titles in source `notes` and English document references in `reference`, prefixed with the document symbol `📜 ` and citing the signatory Prime Minister (PM Hun Sen for 2016–2024; PM Hun Manet for 2025–2027).

#### Verified Royal Government Sub-Decrees (2016–2027)

| Year | Sub-Decree No. | Signed Date | Khmer Heading / Lunar Alignment | Signatory | Off-Days |
|:---:|:---|:---:|:---|:---|:---:|
| **2016** | No. 137 ANKr.BK | 2015-10-01 | ៤ រោច ខែ ភទ្របទ ឆ្នាំមមែ សប្តស័ក ព.ស.២៥៥៩ | PM Hun Sen | 28 |
| **2017** | No. 223 ANKr.BK | 2016-10-27 | ១១ រោច ខែ អស្សុជ ឆ្នាំវក អដ្ឋស័ក ព.ស.២៥៦០ | PM Hun Sen | 27 |
| **2018** | No. 202 ANKr.BK | 2017-11-28 | ១០ កើត ខែ មិគសិរ ឆ្នាំរកា នព្វស័ក ព.ស.២៥៦១ | PM Hun Sen | 27 |
| **2019** | No. 126 ANKr.BK | 2018-10-04 | ១០ រោច ខែ ភទ្របទ ឆ្នាំច សំរឹទ្ធិស័ក ព.ស.២៥៦២ | PM Hun Sen | 28 |
| **2020** | No. 112 ANKr.BK | 2019-08-02 | ២ កើត ខែ ស្រាពណ៍ ឆ្នាំកុរ ឯកស័ក ព.ស.២៥៦៣ | PM Hun Sen | 22 |
| **2021** | No. 131 ANKr.BK | 2020-08-26 | ៨ កើត ខែ ភទ្របទ ឆ្នាំជូត ទោស័ក ព.ស.២៥៦៤ | PM Hun Sen | 21 |
| **2022** | No. 145 ANKr.BK | 2021-08-19 | ១១ កើត ខែ ស្រាពណ៍ ឆ្នាំឆ្លូវ ត្រីស័ក ព.ស.២៥៦៥ | PM Hun Sen | 21 |
| **2023** | No. 166 ANKr.BK | 2022-08-12 | ១៥ កើត ខែ ស្រាពណ៍ ឆ្នាំខាល ចត្វាស័ក ព.ស.២៥៦៦ | PM Hun Sen | 21 |
| **2024** | No. 230 ANKr.BK | 2023-08-18 | ២ កើត ខែ ស្រាពណ៍ ឆ្នាំថោះ បញ្ចស័ក ព.ស.២៥៦៧ | PM Hun Sen | 22 |
| **2025** | No. 204 ANKr.BK | 2024-08-29 | ១០ រោច ខែ ស្រាពណ៍ ឆ្នាំរោង ឆស័ក ព.ស.២៥៦៨ | PM Hun Manet | 22 |
| **2026** | No. 167 ANKr.BK | 2025-09-05 | ១៣ កើត ខែ ភទ្របទ ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩ | PM Hun Manet | 22 |
| **2027** | No. 198 ANKr.BK | 2026-09-16 | ៥ កើត ខែ ភទ្របទ ឆ្នាំមមែ អដ្ឋស័ក ព.ស.២៥៧០ | PM Hun Manet | 22 |

An official holiday requires government sources, dates within its calendar year, and `status: "active"` or `"cancelled"`. A cancelled holiday retains its dates and requires an explanatory `note`. Linking an `eventId` is optional and does not turn calculated dates into official leave.

## New Year arrival evidence (schema v3)

`newYearArrivals` carries the **Moha Sangkran arrival clocks as published evidence** — the engine's `arrivalEstimate` is the prediction, never this record. The dataset integrates the 18 September 2026 research package (`research-khmer-new-year-time`) with the National Television of Cambodia (TVK, ទូរទស្សន៍ជាតិកម្ពុជា) broadcast archive across 19 evidenced years (1997, 2009, 2010–2026 unbroken), reproducible via `node tools/seed-arrivals.ts`.

- An **evidenced** record stores one absolute `localDate` + `localTime`/`minuteOfDay` (clock digits must match `minuteOfDay`; `second` is `null` at minute precision or integer seconds when broadcast with second precision, e.g. `2024` at `22:17:24`), its research `grade` (`A` direct government statement … `E` website data), `role` (`traditional_arrival`, never satisfiable by `ceremony`), and zone fields: `zoneStated` records what the source printed, `interpretedZone`/`interpretedOffset`/`zoneBasis` store the modern UTC+07:00 interpretation separately. Validation enforces that an evidenced `localDate` equals the engine's festival start for that year — a source-date disagreement must be recorded as **disputed**, never as data that overrides validated dates.
- A **disputed** record carries no single clock: it preserves each published `claims` form (including second-precision and `ceremony` entries) plus a `disputeReason`. While early research quarantined 2020 and 2024, both have been resolved with direct official television broadcast evidence:
  - **2020**: Confirmed as **13 April 2020 at 20:48** by TVK official announcement, resolving a diaspora printed calendar typo that printed 14 April with an invalid weekday and corroborating the engine's 13 April festival start.
  - **2024**: Confirmed as **13 April 2024 at 22:17:24** by TVK official broadcast, resolving the dispute between the 22:24 traditional lattice calculation and 22:17 ceremony schedule.
  - **2015**: Corrected to **14:01** per the primary Khmer broadcast announcement (superseding the secondary 14:02 transcription).
- Consumers apply their own grade policy or display the evidenced record where available (12 of the 19 years match the engine's traditional 24-minute lattice calculation to the exact minute: 1997, 2010, 2016–2023, 2025, 2026). A year without an admissible record shows no arrival time — there is **no formula fallback** from the engine's estimate, whose minutes lie on a 24-minute lattice and disagree with off-lattice publications by 1–24 minutes.

Arrival records are evidence, not holidays: they never enter `holidayCalendars`, carry no leave implications, and clock times must not be embedded in event or holiday names — client applications (Android, PWA) format the arrival time directly in the Moha Sangkran title/header, pairing the 12-hour clock with native period descriptors (`ព្រឹក`, `រសៀល`, `ល្ងាច`, `យប់`, `រំលងអធ្រាត្រ`) and the suffix `(ផ្លូវការ)` / `(Official)` for evidenced records or `(ប៉ាន់ស្មាន)` / `(Estimated)` for calculated predictions.

## Generate and review a year

**Generate year** evaluates the manager's modern holiday patterns through the shared engine and creates a yearly list with `coverage: "partial"`. Each entry starts with `status: "draft"` and empty `sourceIds`. This draft-only status is accepted in saved workspaces and catalog backups, but **blocks app export**. A calendar may omit government sources only while all its records are drafts; empty unsourced calendars also block export.

Developers edit the generated dates, remove unwanted suggestions and add new records while comparing the government's PDF or photo. The preview file is temporary; its URL or document reference belongs in a source record. **Confirm reviewed year** attaches the selected government source to the remaining draft entries and marks them active. Already reviewed and cancelled entries retain their status and sources. Confirmation does not regenerate dates or restore removed entries.

The starter in `src/generate-year.ts` contains 16 holiday patterns based on the [LRC 2026 calendar](https://lrc.gov.kh/en/annual-holiday-calendar-2026/) and is offered for years 2026–2200. These are proposed recurring patterns, not future government designations. All calendar arithmetic stays in the engine. Historical official lists remain available through manual entry or import. A year with existing records cannot be regenerated, protecting corrections and removals.

Exported app bundles contain only active/cancelled official records with government sources, never draft holiday entries.

## Yearly JSON import

Use this shape for a publication or amendment. **The example below is illustrative, not an actual government record.** Replace the authority, locator and holiday data with reviewed material.

```json
{
  "schemaVersion": 1,
  "type": "official-holidays",
  "year": 2026,
  "coverage": "partial",
  "source": {
    "id": "example-publication",
    "kind": "government",
    "title": "Replace with publication title",
    "publisher": "Replace with issuing authority",
    "reference": "Replace with instrument number and page"
  },
  "holidays": [
    {
      "id": "example-holiday",
      "names": { "en": "Example only", "km": "សាកល្បង" },
      "dates": ["2026-07-01"],
      "status": "active"
    }
  ]
}
```

Import entries inherit the publication's source ID. Optional holiday fields are `eventId` and `note`. Status defaults to `active` when omitted.

- **Partial:** add or replace the listed IDs; preserve other holiday records. A partial amendment to a complete list preserves the list's complete coverage.
- **Complete:** replace the year's entire holiday list. Omitted IDs appear as removals in the review.
- Changed existing IDs and removals require explicit acceptance in the import review. The import enters the draft first; saving is a separate step.
- Source metadata conflicts appear in the same before/after review.
- A full catalog import replaces the catalog after the same review. Import the catalog itself, not the `{ revision, data, history }` workspace wrapper. The local server restores that wrapper on disk; the hosted page provides workspace restoration under **Review & save → Workspace backups**.

### Browser workspace backups

**Download workspace** produces `{ format: "khmer-calendar-manager", schemaVersion: 1, workspace: { revision, data, history }, exports: [...] }`. The `exports` array preserves previous export manifests so restoring a workspace cannot silently reuse an exported version for different data or an engine version. Restoration validates the entire backup and requires review before replacing the saved workspace; the current workspace becomes a previous-revision backup. Conflicting export records are rejected. These backups are developer working files, separate from the event-data bundles consumed by the apps.

## Yearly CSV import

Required columns: `id,en,km,start`. Optional columns: `end,status,eventId,note`. Column order may vary. The UI supplies the year, government source and partial/complete coverage.

```csv
id,en,km,start,end,status,eventId,note
example-holiday,Example only,សាកល្បង,2026-07-01,2026-07-02,active,,Illustrative data
```

`end` is inclusive and defaults to `start`. A range must stay within one year. Quoted commas, escaped quotes, multiline cells and UTF-8 BOM are supported. Repeated IDs in one file are rejected; use a JSON date array for a non-contiguous holiday date set. Cancellation rows require a note. Downloadable UI templates contain no official data.

## Export contract

The data file is the normalized catalog above. Arrays are ordered by stable IDs/year, date and source-ID arrays are sorted, object keys are ordered, and the file ends in one LF newline. History and backups are omitted. The file contains rule definitions and necessary explicit records; recurring date occurrences are calculated by the consumer's engine.

The separate manifest records `schemaVersion` (matching the catalog: 3 since the arrival section), `dataVersion`, `engineVersion`, `file`, `sha256` and `bytes`. Its checksum covers the **exact UTF-8 data-file bytes**, including the final newline. Consumers should verify the checksum and supported schema/engine version before adoption. A checksum identifies content; it does not certify the publication's authenticity.

Dates in a cancelled holiday record are retained for audit/display; consumers must exclude cancelled records when determining active public holidays. `coverage: "partial"` means missing dates are unknown, not confirmed non-holidays. Import and export never infer substitute leave from weekends.
