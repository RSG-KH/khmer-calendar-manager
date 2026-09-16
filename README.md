# Khmer Calendar Manager

A developer web app for maintaining events, historical facts, translations, source-backed corrections and government yearly holiday calendars. Calendar previews use the shared **Khmer Calendar Engine** package.

**[Open the hosted manager](https://rsg-kh.github.io/khmer-calendar-manager/)** — use it directly in your browser, or run the local file-backed version below.

## Status

**0.1.0 — local and GitHub Pages versions.** The catalog starts empty. Add reviewed publications and data through the manager; existing application archives have not been migrated yet.

Implemented:

- Source records with authority, publication date, document reference, URL and review notes.
- Bilingual event editing, explicit dates, historical original dates and optional annual commemorations.
- Engine-backed recurrence previews and individual-year corrections or cancellations.
- Official holiday records, amendments and cancellations, kept separate from calculated festivals.
- JSON and CSV imports with validation, before/after review and explicit acceptance of replacements or removals.
- Canonical JSON saves, revision history, automatic backups and stale-file/concurrent-save checks.
- Deterministic data exports with a version, compatible engine version and SHA-256 manifest.

## Hosted manager and GitHub Pages

The hosted page saves each browser's workspace in IndexedDB. Catalogs are private to that browser profile; editing does not upload event data or commit it to GitHub. After the page has loaded, editing, calculations and downloads work without API requests. Reopening the site requires a network connection; offline app installation is not implemented.

Under **Review & export**, use **Download workspace** to keep a copy of the saved catalog, history and export-version records. Use **Open workspace backup**, review its contents, and confirm **Restore workspace** to restore it in this or another browser. The last 20 saved revisions are available for download. Clearing site data or ending a private-browsing session can remove browser saves, so retain downloaded copies on disk. Unsaved changes can be kept with **Download draft** and restored through **Import data**.

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

1. Add the supporting source or import JSON containing its source record.
2. Add events or enter/import a government's official dates for a selected year.
3. Inspect the engine preview. Historical facts and their commemorations retain the original date; government holiday status always comes from explicit records.
4. Review draft changes, supply a change note, and save.
5. Complete both Khmer and English names, choose a data version, and prepare an export.
6. Download the data JSON and its manifest; commit reviewed source-data changes in Git and explicitly adopt the bundle in consuming applications.

**Partial imports preserve unlisted holidays. Complete imports replace the selected yearly list and expose removals for review.** Repeating an identical import produces no changes. Existing IDs are retained across wording and date corrections.

[Data format and import rules](docs/data-format.md) documents the catalog, yearly JSON/CSV formats, correction semantics and exported manifest. The manager accepts structured data transcribed from publications. XML adapters and document extraction can be added when an actual source format requires them.

### Storage and recovery

- `data/workspace.json`: canonical catalog, revision number and save history; commit this file with reviewed data changes.
- `data/.backups/`: previous complete workspace files, named by revision and content hash; ignored by Git.
- `data/.exports/`: manifests recording which content was exported under each version; ignored by Git.

A save uses a temporary file and replacement after checking the loaded revision. If another tab or editor changed the file, the manager refuses to overwrite it. Download your draft, discard the stale local copy, reload the saved file and review your changes again. For backup recovery, stop the server and restore a selected complete backup as `data/workspace.json`.

A crash during a save can leave `data/.write.lock`. Remove that lock only after confirming no manager process is saving. An invalid workspace is reported, never silently replaced with an empty catalog.

Each exported version is immutable within the local export history: changed content requires a new data version. Keep the exported JSON and manifest together in your release records; restoring or moving the project does not automatically recreate ignored export history.

## Engine dependency

Local development installs the compiled JavaScript package from the engine's [GitHub release v0.1.0](https://github.com/RSG-KH/khmer-calendar-engine/releases/tag/v0.1.0). `package.json` pins the versioned release URL, and `package-lock.json` records the archive's integrity hash. `npm ci` downloads that exact package during setup or CI. The Pages deployment workflow then selects its requested engine release and tests it before publication.

All calendar formulas stay in the engine; the manager owns data validation, import, editing and export. Each deployed build uses one verified engine version. If that version changes, previously exported data versions remain protected: increase the data version before exporting with the new engine.

The adopted package comes from engine commit [`dd8d402`](https://github.com/RSG-KH/khmer-calendar-engine/commit/dd8d4025c912b04ef389bbc067f3875dad4816e0). Its SHA-256 matches the release's `SHA256SUMS`:

```text
9c9000baadd2d6d1cf2ae020e98fb3daf8fc269a56020ada15a7a19a1034e2f0
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

Browser tests require installed Google Chrome, or set `CHROME_BIN` to a Chromium executable. The suite covers 14 data/storage tests, the full browser workflow in both local-server and static Pages modes, and browser-storage conflict, backup, export and failure scenarios. Desktop and mobile layouts are checked; screenshots are written to ignored `build/verification/`. Test publications and events are synthetic and never enter the default catalog.

## License

[Apache License 2.0](LICENSE). The installed engine package includes its own license and third-party notices.
