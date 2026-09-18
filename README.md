# Khmer Calendar Manager

A developer web app for maintaining events, historical facts, translations, source-backed corrections and government yearly holiday calendars. Calendar previews use the shared **Khmer Calendar Engine** package.

**[Open the hosted manager](https://rsg-kh.github.io/khmer-calendar-manager/)** — use it directly in your browser, or run the local file-backed version below.

## Status

**0.3.2 — streamlined catalog with official 2016–2027 holidays and research-verified historical coverage.** The default workspace (`data/workspace.json`) is fully seeded with 137 events (111 engine recurrence rules + 26 static date-backed events), 22 corrections (15 King Sihamoni birthday overrides 2005–2019, 3 Chinese festival archive-parity dates, and 4 documented International Day of Peace observance exceptions 1998–2001), and 12 officially confirmed government public holiday calendars (2016–2027) backed by Royal Government of Cambodia Sub-Decrees (Anukret).

The 2000–2030 legacy archive (3,246 duplicate entries) has been streamlined: all 349 unlinked occurrences were extracted into 24 first-class date-backed events (9 Chinese traditional festivals across 31 years and 15 UNESCO/historical milestones), allowing `eventCalendars` to be retired (`[]`). This drops the uncompressed export payload by 90% down to ~108 KB (~15 KB gzipped) while ensuring zero data loss and simple downstream consumption in Android and PWA.

Historical commemorations no longer inherit the legacy 2000 cutoff: anniversary rules start at `anniversaryBase + 1` (Victory Day counts ខួបលើកទី១ from 1980, Independence Day from 1954, Labor Day from 1887, etc.), the Paris Peace Agreement starts at its 1991 signing and the Win-Win Policy at 1998, commemorated yearly through 2023 before its renaming to Peace Day in Cambodia as a national holiday from 2024-12-29, and 10 additional static milestones carry the original dates (Victory Day 1979-01-07, Independence 1953-11-09, Constitution 1993-09-24, Angkor's UNESCO inscription 1992-12-14, ICJ Preah Vihear judgment 1962-06-15, UN membership 1955-12-14, UNESCO membership 1951-07-03, National Police founding 1945-05-16, Labor Day 1886-05-01, Human Rights Day 1948-12-10). Royal commemorations use their true start years: Coronation Day since the coronation on 2004-10-29 and the King-Father commemoration since its first observance on 2013-10-15.

A further 23 observances follow researched first-observance years ([docs/research](docs/research/), rounds 1–2 with primary-source citations): international days from 1948–1994 (Cambodia-first for Teachers' Day 1997, Indigenous Peoples' 2005 and Persons with Disabilities' 1999), National Day of Remembrance from its 2018 statute with a 1984 Day of Hatred milestone, Arbor Day from its 1992 revival, Fish Day 2003, Anti-Corruption 2004, Anti-Human-Trafficking 2007, Environmental Sanitation from Sub-decree No. 47 of 12 June 1995, International Buddhist Day from its first Cambodian observance on 2024-04-08, and Queen Mother's Birthday from 1994, the restored Kingdom's first holiday calendar (maintainer-attested unbroken observance). World Water Day (22 March, since 1993) and World Meteorological Day (23 March, since 1961) are separate events, and the pre-2002 International Day of Peace follows the General Assembly's actual opening days (third Tuesday of September by default, with documented exceptions on 9 September 1998, 14 September 1999, 5 September 2000 and 14 September 2001 recorded as corrections).

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

In the canonical catalog (`data/workspace.json`), this archive has been fully streamlined for Schema v2:
- **111 Recurrence Rules**: Evaluated dynamically for any year (1800–2200) via `khmer-calendar-engine`.
- **26 Static Date-Backed Events**: the 15 UNESCO/historical milestones (Preah Vihear, Kun Lbokator, Royal Ballet, Tuol Sleng, Krama, etc.) plus 11 origin milestones (Victory Day 1979, Independence 1953, Constitution 1993, Angkor 1992, ICJ Preah Vihear 1962, UN 1955, UNESCO 1951, National Police 1945, Labor Day 1886, Human Rights Day 1948, Day of Hatred 1984) are explicit date-backed events in `events`.
- **Retired `eventCalendars`**: Kept empty (`[]`), eliminating runtime archive-vs-engine precedence conflicts and shrinking the export bundle by 90% (~108 KB).
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

Local development installs the compiled JavaScript package from the engine's [GitHub release v0.2.0](https://github.com/RSG-KH/khmer-calendar-engine/releases/tag/v0.2.0). `package.json` pins the versioned release URL, and `package-lock.json` records the archive's integrity hash. `npm ci` downloads that exact package during setup or CI. The Pages deployment workflow then selects its requested engine release and tests it before publication.

All calendar formulas stay in the engine; the manager owns data validation, import, editing and export. Each deployed build uses one verified engine version. If that version changes, previously exported data versions remain protected: increase the data version before exporting with the new engine.

The adopted package comes from engine commit [`2abd6fd`](https://github.com/RSG-KH/khmer-calendar-engine/commit/2abd6fde383bcf3d62ea09c063cf224855268c17). Its SHA-256 matches the release's `SHA256SUMS`:

```text
585b5130ac620a549b67e2b997db27e7be00da536e1ac85e287f3fde43c4a022
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
