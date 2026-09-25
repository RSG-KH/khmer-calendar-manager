# Changelog

All notable changes to Khmer Calendar Manager and its canonical event data catalog are documented in this file.

## 0.5.0 — 2026-09-26

### Engine & Dependencies
- **Adopt `khmer-calendar-engine` v0.6.0**:
  - Adds Western natal astrology ("Big 3" + Angles: Sun, Moon, Ascendant, Midheaven) continuous-time celestial coordinates via standalone `WesternZodiacCalculator` (1800–2200).
  - Implementation based on Jean Meeus algorithms (*Astronomical Algorithms*, 2nd ed.) and Espenak & Meeus piecewise Delta-T polynomials.
  - High-precision Ascendant computation with singularity detection (`CALCULATED`, `POLAR_NON_RISING`, `COINCIDENT_PLANES`, `DEGENERATE_POLE`).
  - Bilingual zodiac signs (`WesternZodiacSign`: Aries/មេស .. Pisces/មីន) with symbols, elements, and modalities.
  - Ergonomic options-object and positional wrappers: `calculateHoroscope` and `calculateHoroscopeUtc`.
- Package pinned to engine release `v0.6.0` commit [`2a416d6`](https://github.com/RSG-KH/khmer-calendar-engine/commit/2a416d63167465a5cfdbc1c1292e0caf566441f4) with verified SHA-256 (`137cc96f...`).

### Catalog & Knowledge
- Bump catalog and manager to **Data v0.5.0** / **Workspace Revision 27**.
- Canonical catalog export: generated `data/exports/khmer-calendar-data-0.5.0.json` stamped with `engineVersion: "0.6.0"`.
- Synchronized `data/knowledge.json` and documentation to Data v0.5.0.

### Verification
- Added `tests/western-horoscope.test.ts` verifying Big 3 + Angles calculation, bilingual sign names, and UTC synchronization against engine 0.6.0.
- Hardened server test against ephemeral port collision with fetch-restricted ports on Windows.

---

## 0.4.5 — 2026-09-25

### Engine & Dependencies
- **Adopt `khmer-calendar-engine` v0.5.1**:
  - Expose traditional Moha Sangkran arrival estimate (`arrivalEstimate` on 24-minute lattice).
  - Add Chinese Ganzhi (sexagenary) day and hour pillars over proleptic Gregorian 1..9999.
  - Astrological solar calendar, sectional solar terms, and Four Pillars (BaZi) with 23:00 Zi-hour boundary synchronization.
  - Isolated festival registry and hardened validation.
- Add `.npmrc` (`allow-remote=all`) and update `tools/update-engine.mjs` to ensure seamless release tarball installation under npm 12+.

### Catalog & Knowledge
- **Event Knowledge Companion**:
  - Added `data/knowledge.json` carrying 139 researched bilingual entries (Khmer and English), exactly matching each event in the catalog.
  - Added `tests/knowledge.test.ts` to enforce 1-to-1 lockstep between catalog events and knowledge entries.
- Canonical catalog export: generated `data/exports/khmer-calendar-data-0.4.5.json`.

### Documentation
- Extracted version history out of `README.md` into this dedicated `CHANGELOG.md`.

---

## 0.4.4 — 2026-09-22

### Catalog & Rules
- **Traditional Pchum Ben structure, per-day titles and calculated Post day**:
  - The Kan Ben series runs 1–15 រោច: Ben 14 (១៤ រោច) is its own day, `pchum_ben_festival` is the single 15 រោច climax, and Post Pchum Ben Festival (ក្រោយពិធីបុណ្យភ្ជុំបិណ្ឌ, `khmer_lunar` day 15, offset +1) is calculated so sub-decree-less years (1800–2015, 2028–2200) list the travel-bonus day.
  - The three government leave days carry deliberate per-day titles: Ben 14, Pchum Ben Festival, and Post Pchum Ben Festival, each noting that the official Anukret lists all three as ពិធីបុណ្យភ្ជុំបិណ្ឌ.
  - Total catalog events: 139.

---

## 0.4.3 — 2026-09-21

### Catalog & Rules
- **Traditional Pchum Ben structure**:
  - The Kan Ben series now runs 1–15 រោច as printed: Ben 14 (១៤ រោច) is its own day, `pchum_ben_festival` is the single 15 រោច climax (previously a 3-day block from 14 រោច), and each official calendar links its first Pchum holiday day to `ben_14`.
  - The government's three-day leave remains in the holiday layer. 138 events.

---

## 0.4.2 — 2026-09-21

### Holiday Calendars
- **Holiday English anniversary counts**:
  - The 68 official holiday entries (2016–2027) linked to `anniversaryBase` events now carry ` · {anniversary}` in English too, aligned with their Khmer side (58 placeholder entries + 10 baked 2025–2026 counts).
  - The preview substitutes holiday placeholders via the linked event's base, so no raw `{anniversary}` tokens appear in any preview row.

---

## 0.4.1 — 2026-09-21

### Catalog Events
- **English anniversary counts**:
  - All 34 `anniversaryBase` events now carry the `{anniversary}` placeholder in both names (e.g. `Victory Over Genocide Day · {anniversary}` / `ទិវាជ័យជម្នះលើរបបប្រល័យពូជសាសន៍ ខួបលើកទី{anniversary}`).
  - Consumers substitute `year - anniversaryBase` themselves: Khmer renders Khmer numerals (ខួបលើកទី៤៧), English renders an ordinal (` · 47th`) — the manager preview matches this.

---

## 0.4.0 — 2026-09-19

### Schema & Data
- **Moha Sangkran arrival-time evidence (Schema v3)**:
  - Added the `newYearArrivals` evidence section seeded from the arrival-time research package: 22 arrival sources (`arrival-s02`…`arrival-s29`) and 19 per-year evidenced records (1997, 2009, 2010–2026 unbroken) anchored by National Television of Cambodia (TVK) broadcasts, AKP government releases, and contemporary sources.
  - Resolves historical disputes (2020 at 13 Apr 20:48; 2024 at 13 Apr 22:17:24) and corrects 2015 to 14:01 per primary announcements.
  - Validation rejects evidenced arrivals whose date disagrees with the engine's validated festival start.
- **Streamlined catalog**:
  - Extracted 349 unlinked legacy occurrences into 24 first-class date-backed events (9 Chinese traditional festivals across 31 years and 15 UNESCO/historical milestones), allowing `eventCalendars` to be retired (`[]`).
  - Drops uncompressed export payload by 90% down to ~108 KB (~15 KB gzipped).
- **Historical commemorations**:
  - Removed legacy 2000 cutoff; anniversary rules start at `anniversaryBase + 1`.
  - Researched 23 observances with primary-source citations for true first-observance start years.

---

## 0.3.3 — 2026-09-18

### Holiday Calendars
- Added document symbols and signatories in English and Khmer for all 12 confirmed Royal Government Sub-Decrees (2016–2027).

---

## 0.3.2 — 2026-09-18

### Holiday Calendars
- Added official public holidays for 2016–2019 from Royal Government Sub-Decrees, establishing 12 consecutive years (2016–2027) of verified government public holidays.

---

## 0.3.1 — 2026-09-18

### Commemorations & Observances
- Extended historical commemorations before the legacy 2000 cutoff.
- Applied event-origin research for 20+ observances with verified first-observance years.

---

## 0.3.0 — 2026-09-18

### Engine & Recurrence
- Adopted `khmer-calendar-engine` v0.2.0.
- Migrated Chinese traditional festivals to dynamic lunisolar recurrence rules (`cn-reference-utc8`).

---

## 0.2.0 — 2026-09-17

### Migration & Schema v2
- Introduced Schema v2 with year-level recorded-event calendars (`eventCalendars`).
- Converted 3,246 legacy Android occurrences across 2000–2030, adopting 100 recurrence definitions.
- Added King Sihamoni birthday overrides (2005–2019) and confirmed 2025–2026 public holidays.

---

## 0.1.0 — 2026-09-16

### Initial Release
- Developer web app for maintaining events, historical facts, translations, source-backed corrections, and government yearly holiday calendars.
- Supports both local Node.js server and static GitHub Pages browser deployment with IndexedDB storage.
