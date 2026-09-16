# Data format — version 1

The manager owns the catalog schema. Recurrence configurations use the engine's public rule contract. Unknown fields, duplicate IDs/dates, invalid dates and missing source references are rejected.

## Canonical catalog

`data/workspace.json` contains `{ revision, data, history }`. `data` is the catalog accepted by a full JSON import and emitted by an export:

```json
{
  "schemaVersion": 1,
  "dataVersion": "0.1.0",
  "sources": [],
  "events": [],
  "holidayCalendars": [],
  "overrides": []
}
```

IDs use lowercase letters, digits, hyphens, underscores or dots, start with a letter/digit, and are at most 80 characters. Dates use `YYYY-MM-DD`. Official calendar years and calculation previews support 1800–2200; original historical dates and explicit records can use Gregorian years 1–9999.

| Record | Fields |
| --- | --- |
| Source | `id`, `title`, `publisher`, `kind`; optional `url`, `reference`, `publishedOn`, `notes` |
| Event | `id`, `kind`, `names`, `sourceIds`; either `dates` or `rule`; optional `description`, `originalDate` |
| Yearly calendar | `year`, `coverage`, `sourceIds`, `holidays` |
| Holiday | `id`, `names`, `dates`, `status`, `sourceIds`; optional `eventId`, `note` |
| Correction | `eventId`, `year`, `dates`, `sourceId`, `reason` |

Names and descriptions are objects with `en` and `km` strings. Draft names require at least one language; exports require both names. Description text is optional. Source kinds are `government`, `calendar`, `historical` or `other`; a source needs a URL or document reference. URLs are HTTP(S); source records are not fetched or automatically authenticated.

Event kinds are `traditional`, `historical` or `observance`. Historical events require `originalDate`. An event has either a non-empty array of explicit dates, or an engine rule with the same ID. Annual commemorations must not start before the original historical event; preview dates before the original date are excluded, including earlier days in its first year.

Rules support `solar`, `solar_nth_weekday`, `khmer_lunar`, `new_year_first`, `new_year_middle` and `new_year_last`. Gregorian/lunar rules must explicitly supply month/day, lunar rules also supply `waxing`, and weekday rules supply `occurrence`. Engine options include effective anchor years, offset and duration. Lunar month 7 with `monthPolicy: "ordinary_or_second_asadh"` covers ordinary and leap-month years. Calculations are delegated to the installed engine package.

A correction replaces one recurring event's complete occurrence list for an **anchor year**. Empty `dates` cancels that year's calculated occurrences. A source and reason are mandatory. This changes the event occurrence only; any government holiday designation is maintained separately.

An official holiday requires government sources, dates within its calendar year, and `status: "active"` or `"cancelled"`. A cancelled holiday retains its dates and requires an explanatory `note`. Linking an `eventId` is optional and does not turn calculated dates into official leave.

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
- A full catalog import replaces the catalog after the same review. Import the catalog itself, not the `{ revision, data, history }` workspace wrapper. The local server restores that wrapper on disk; the hosted page provides workspace restoration under **Review & export**.

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

The separate manifest records `schemaVersion`, `dataVersion`, `engineVersion`, `file`, `sha256` and `bytes`. Its checksum covers the **exact UTF-8 data-file bytes**, including the final newline. Consumers should verify the checksum and supported schema/engine version before adoption. A checksum identifies content; it does not certify the publication's authenticity.

Dates in a cancelled holiday record are retained for audit/display; consumers must exclude cancelled records when determining active public holidays. `coverage: "partial"` means missing dates are unknown, not confirmed non-holidays. Import and export never infer substitute leave from weekends.
