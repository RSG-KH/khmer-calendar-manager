# Khmer Calendar Manager

A developer web app for maintaining events, historical facts, translations, source-backed corrections and government yearly holiday calendars. Calendar previews use the shared **Khmer Calendar Engine** package.

**[Open the hosted manager](https://rsg-kh.github.io/khmer-calendar-manager/)** — use it directly in your browser, or run the local file-backed version below.

## Status

The canonical catalog (`data/workspace.json`) is on **Schema v3 / Data v0.4.5**, verified against **[Khmer Calendar Engine v0.5.1](https://github.com/RSG-KH/khmer-calendar-engine/releases/tag/v0.5.1)**:
- **139 Curated Events**: 113 recurrence rules evaluated dynamically for any year (1800–2200), 26 static date-backed milestones, and 22 reviewed corrections.
- **Event Knowledge Companion**: `data/knowledge.json` carries one curated bilingual entry per catalog event (139 entries), enforced in 1-to-1 lockstep with the catalog via `tests/knowledge.test.ts`. See [docs/data-format.md](docs/data-format.md#event-knowledge-companion).
- **New Year Arrival Evidence (Schema v3)**: 19 evidenced Moha Sangkran arrival time records (1997, 2009, 2010–2026 unbroken) anchored by National Television of Cambodia (TVK) broadcasts and AKP government releases, with arrival estimates computed by the engine.
- **Official Holiday Calendars (2016–2027)**: 12 consecutive years of official government public holidays (283 off-days) transcribed, confirmed, and mathematically aligned from Royal Government Sub-Decrees with document numbers and signatories.
- **Retired `eventCalendars`**: Legacy duplicate occurrences retired (`[]`), reducing export payload by 90% (~108 KB uncompressed, ~15 KB gzip).

For a complete history of releases, data revisions, and engine upgrades, see **[CHANGELOG.md](CHANGELOG.md)**.


Implemented:

- A compact header overview and three stages below it: **Calendar → Review & save → Export**.
- One calendar workspace with search, holiday/event filters, calculated dates and an always-visible announcement panel. **Import** opens a popup on that page.
- Generate a modern holiday year through the engine, then correct, add or remove entries while checking a PDF or photo beside the list.
- Save unfinished holiday drafts and confirm reviewed dates against a government publication before export.
- Add/edit popups with references created or edited in context, preserving the parent form. An event can be started before its reference exists. Year-specific date changes are available inside the recurring event's editor.
- Source records with authority, publication date, document reference, URL and review notes.
- Bilingual event editing, explicit dates, historical original dates and optional annual commemorations.
- Complete or partial recorded-event calendars, with complete years taking precedence over calculated recurrences while retaining links to their definitions.
- Engine-backed recurrence previews and individual-year corrections or cancellations.
- Official holiday records, amendments and cancellations, kept separate from calculated festivals.
- JSON and CSV imports with validation, before/after review and explicit acceptance of replacements or removals.
- Canonical JSON saves, revision history, automatic backups and stale-file/concurrent-save checks.
- Deterministic data exports with a version, compatible engine version and SHA-256 manifest.

## Hosted manager and GitHub Pages

The hosted page saves each browser's workspace in IndexedDB. Catalogs are private to that browser profile; editing does not upload event data or commit it to GitHub. After the page has loaded, editing, calculations and downloads work without API requests. Reopening the site requires a network connection; offline app installation is not implemented.

Under **Review & save → Workspace backups**, use **Download workspace** to keep a copy of the saved catalog, history and export-version records. Use **Open workspace backup**, review its contents, and confirm **Restore workspace** to restore it in this or another browser. The last 20 saved revisions are available for download. Clearing site data or ending a private-browsing session can remove browser saves, so retain downloaded copies on disk. Unsaved changes can be kept with **Draft & recovery tools → Download draft** and restored through **Calendar → Import**.

The **Deploy manager to Pages** workflow runs on pushes to `main` and through **Actions → Deploy manager to Pages → Run workflow**:

1. Resolve the latest stable engine release, download its JavaScript package, and verify `SHA256SUMS` and npm integrity.
2. Run data/storage tests and the local browser workflow.
3. Build the static page and test imports, previews, saves, cross-tab conflicts, workspace restoration and export checksums using the actual repository URL path.
4. Deploy the tested build. The previous site remains available if verification fails.

The engine version is fixed within each deployed build and shown in the manager. The build also publishes `engine-release.json` and retains the exact package/lockfile as the **manager-build-record** Actions artifact. Publishing an engine release alone does not redeploy the manager; run this workflow to adopt it. Set its optional `engine_version` input to an exact tag, such as `v0.1.0`, to select or roll back a release.

Repository setup: **Settings → Pages → Source → GitHub Actions**. No extra hosting token is required; the deploy job uses GitHub's built-in permissions. A failed workflow never replaces the working site with an unverified engine.

## Run locally

Requires **Node.js 24 or newer**. Node 26 was used for verification.

```text
npm ci
npm run dev
```

Open **http://127.0.0.1:4387**. The server listens on loopback only. Once dependencies are installed, editing, calculations and exports work offline; opening a publication URL naturally requires access to that source.

For the compiled application:

```text
npm run build
npm start
```

The optional `PORT` and `MANAGER_DATA_DIR` environment variables select a different port or data directory. Tests use isolated temporary directories.

## Working with data

### Prepare a new official holiday year

1. In **Calendar**, select a year and click **Generate year**. No JSON or CSV preparation is needed.
2. Choose the government's PDF or photo in **Announcement**. Compare it beside the dates; edit differences, remove holidays not listed, and add new ones. Removing a record is available inside its edit popup. The preview file stays open while you edit, filter, import, or visit another stage; it is temporary and is not included in backups.
3. Open **Review & save** and click **Confirm [year]**. Choose an existing publication or use **Add reference** in that popup to record its authority and URL/document number. Select the coverage, acknowledge the review, and **Confirm reviewed year**. Generated entries remain **Awaiting review** until confirmed.
4. Choose a data version, enter a change note, and **Save changes**. Unfinished work can also be saved and resumed; export remains blocked until review is complete.
5. Open **Export**, prepare the bundle, and download its data JSON and manifest. Commit reviewed source-data changes and explicitly adopt the bundle in consuming applications. On the hosted page, also download a workspace backup from **Review & save**.

The starting list covers 16 usual holiday occasions, based on the [LRC's 2026 calendar](https://lrc.gov.kh/en/annual-holiday-calendar-2026/), and is offered for 2026 onward. Fixed dates and lunar festivals are recalculated through the shared engine; Khmer New Year uses the engine's full three/four-day festival. The starting list is a proposal for review, not a government announcement for another year. It does not infer weekend substitute leave or carry a prior year's official status forward. Generation is disabled once a year has records so corrections and removals are preserved. Historical lists can be entered manually or imported.

### Other editing and optional imports

Use **Add event** on the calendar for historical facts, traditional festivals and recurring observances. Select a reference or add it directly from that editor; typed event fields stay intact. The **Events** filter shows these definitions, including records with no dates in the selected year. Calculations appear directly in the list.

For an exception, edit the recurring event and expand **Change dates for a specific year**. Enter replacement dates and their reference, or leave the dates empty to cancel that year's occurrences. Other years keep the engine calculation. Changing official holiday dates does not change the engine's festival calculation.

The calendar's **Import** button opens a JSON/CSV popup with a change review before applying. CSV references can be added within the popup. These are optional developer conveniences; government announcements can be reviewed directly as PDFs or photos.

**Partial imports preserve unlisted holidays. Complete imports replace the selected yearly list and expose removals for review.** Repeating an identical import produces no changes. Existing IDs are retained across wording and date corrections.

[Data format and import rules](docs/data-format.md) documents the catalog, yearly JSON/CSV formats, correction semantics and exported manifest. The manager accepts structured data transcribed from publications. XML adapters and document extraction can be added when an actual source format requires them.

### Migrated Android archive and streamlined catalog

[`data/migrations/android-archive-and-rules.json`](data/migrations/android-archive-and-rules.json) is the raw transitional migration import containing the 3,246 recorded occurrences for 2000–2030 in `eventCalendars`. The migration pins SHA-256 hashes for each Android input and is verified by tests (`npm test` and `npm run migrate:android:check`).

In the canonical catalog (`data/workspace.json`), this archive has been fully streamlined for Schema v3:
- **113 Recurrence Rules**: Evaluated dynamically for any year (1800–2200) via `khmer-calendar-engine` (139 events total).
- **26 Static Date-Backed Events**: the 15 UNESCO/historical milestones (Preah Vihear, Kun Lbokator, Royal Ballet, Tuol Sleng, Krama, etc.) plus 11 origin milestones (Victory Day 1979, Independence 1953, Constitution 1993, Angkor 1992, ICJ Preah Vihear 1962, UN 1955, UNESCO 1951, National Police 1945, Labor Day 1886, Human Rights Day 1948, Day of Hatred 1984) are explicit date-backed events in `events`.
- **Retired `eventCalendars`**: Kept empty (`[]`), eliminating runtime archive-vs-engine precedence conflicts and shrinking the export bundle by 90% (~108 KB).
- **New Year Arrival Evidence (Schema v3)**: 19 evidenced Moha Sangkran arrival time records (1997, 2009, 2010–2026 unbroken), anchored by National Television of Cambodia (TVK, ទូរទស្សន៍ជាតិកម្ពុជា) broadcasts, AKP government releases, and inspected contemporary sources. Resolves historical disputes (2020 at 13 Apr 20:48; 2024 at 13 Apr 22:17:24) and corrects 2015 to 14:01 per primary announcements.
- **Official Holiday Calendars (2016–2027)**: 12 consecutive years of official government public holidays transcribed, confirmed, and mathematically aligned from Royal Government Sub-Decrees (Anukret Nos. 137, 223, 202, 126, 112, 131, 145, 166, 230, 204, 167, and 198). Standardized as individual per-day entries (283 off-days) with explicit `eventId` linking directly to recurrence rules, day-specific names (Moha Sankranta, Vanabat, Laeung Sak), verified lunar calendar alignment, and user-friendly source citations (see [docs/data-format.md](docs/data-format.md)).
- **22 Corrections**: 15 King Norodom Sihamoni birthday 3-day holiday dates (2005–2019) before reducing to 1 day in 2020, 3 Chinese festival archive-parity dates (Qingming 2009 and 2029, Zongzi 2013), and 4 International Day of Peace observance exceptions (9 Sep 1998, 14 Sep 1999, 5 Sep 2000, 14 Sep 2001 after the 11 September attacks).

### Storage and recovery

- `data/workspace.json`: canonical catalog, revision number and save history; commit this file with reviewed data changes.
- `data/.backups/`: previous complete workspace files, named by revision and content hash; ignored by Git.
- `data/.exports/`: manifests recording which content was exported under each version; ignored by Git.

A save uses a temporary file and replacement after checking the loaded revision. If another tab or editor changed the file, the manager refuses to overwrite it. Download your draft, discard the stale local copy, reload the saved file and review your changes again. For backup recovery, stop the server and restore a selected complete backup as `data/workspace.json`.

A crash during a save can leave `data/.write.lock`. Remove that lock only after confirming no manager process is saving. An invalid workspace is reported, never silently replaced with an empty catalog.

Each exported version is immutable within the local export history: changed content requires a new data version. Keep the exported JSON and manifest together in your release records; restoring or moving the project does not automatically recreate ignored export history.

## Engine dependency

Local development installs the compiled JavaScript package from the engine's [GitHub release v0.5.1](https://github.com/RSG-KH/khmer-calendar-engine/releases/tag/v0.5.1). `package.json` pins the versioned release URL, and `package-lock.json` records the archive's integrity hash. `npm ci` downloads that exact package during setup or CI. The Pages deployment workflow then selects its requested engine release and tests it before publication.

All calendar formulas stay in the engine; the manager owns data validation, import, editing and export. Each deployed build uses one verified engine version. If that version changes, previously exported data versions remain protected: increase the data version before exporting with the new engine.

The adopted package comes from engine commit [`a18f448`](https://github.com/RSG-KH/khmer-calendar-engine/commit/a18f448be4d4590368d42f8208f02fff0f8fb572). Its SHA-256 matches the release's `SHA256SUMS`:

```text
a7176798767962419b3a0f0f7043f65be946bab635d5b508745d2e0da0c49ceb
```

### Adopt a newer engine release

Check the [latest stable release](https://github.com/RSG-KH/khmer-calendar-engine/releases/latest) and review any API or rule changes. The helper downloads the selected release, verifies its checksum, updates the dependency/lockfile, and records its provenance in `public/engine-release.json`:

```text
npm run engine:update -- latest
npm test
npm run build
npm run test:browser
npm run build:pages
npm run test:pages
```

Use a tag in place of `latest` to select an exact release. Update this dependency record and commit `package.json`, `package-lock.json` and `public/engine-release.json` together after verification. Restart the local manager after installing an engine update. Normal startup keeps the selected version; the export manifest records the loaded engine version.

## Verification

```text
npm test
npm run build
npm run test:browser
npm run build:pages
npm run test:pages
```

Browser tests require installed Google Chrome, or set `CHROME_BIN` to a Chromium executable. Tests cover year generation, preserved corrections, unconfirmed export rejection, data/storage validation, both browser workflows in local-server and static Pages modes, and browser-storage conflict, backup, export and failure scenarios. Desktop and mobile layouts are checked; screenshots are written to ignored `build/verification/`. Test publications and events are synthetic and never enter the default catalog.

## License

[Apache License 2.0](LICENSE). The installed engine package includes its own license and third-party notices.
