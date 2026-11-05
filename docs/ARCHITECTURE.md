# PromptVault architecture

PromptVault is a static, local-first single-page app. Everything runs in the browser; there is no backend.

```
┌──────────────────────────── Browser ────────────────────────────┐
│  React UI (pages/, components/)                                  │
│        │  live queries (dexie-react-hooks)                       │
│        ▼                                                         │
│  lib/repo.ts ── lib/search.ts ── lib/backup/* ── lib/ocr.ts      │
│        │                                         │               │
│        ▼                                         ▼               │
│  IndexedDB (Dexie)                     Tesseract worker (WASM)   │
│  creations · assets · assetFiles       served from /ocr/         │
│  collections · meta                                              │
└──────────────────────────────────────────────────────────────────┘
```

## Folders

| Path | Purpose |
| --- | --- |
| `src/pages/` | One component per screen (dashboard, library, detail, edit, collections, compare, extract, backup, settings). |
| `src/components/ui/` | Design-system primitives: buttons, inputs, dialogs, menus, badges, empty states. |
| `src/components/layout/` | App shell, sidebar, top bar, global search and shortcuts. |
| `src/components/creations/` | Cards, list rows, the attachment editor, library toolbar, lightbox. |
| `src/components/collections/` | Collection create/edit, picker and item manager dialogs. |
| `src/lib/db.ts` | Dexie database schema. |
| `src/lib/repo.ts` | All writes: save/delete/duplicate creations, collections, clear data, sample removal. |
| `src/lib/search.ts` | MiniSearch index plus filtering and sorting. |
| `src/lib/images.ts` | File-signature checks, size limits and thumbnail generation. |
| `src/lib/backup/` | Backup schema (Zod), export (zip/JSON), import (validation, conflict handling) and Markdown. |
| `src/lib/ocr.ts` | Lazy-loaded Tesseract worker using locally served engine files. |
| `src/lib/sample-data.ts` | The optional demo library. |
| `src/store/` | Zustand stores for UI preferences (persisted to localStorage) and in-memory hand-offs. |
| `scripts/` | Copy OCR assets, generate sample art, icons, social preview and screenshots. |
| `e2e/` | Playwright tests that run against the production build. |

## Data model

- **Creation**: one saved item. Holds text fields, generation settings, `tags`, `collectionIds` (many-to-many), `assetIds` (ordered), `coverAssetId`, `video` (link and duration), `parentId`/`parentTitle` for variations, `isSample`, and timestamps (`addedAt`, `updatedAt`, `lastUsedAt`).
- **Asset**: metadata for an attached image (role, name, type, size, dimensions, alt text, caption) plus a small preview (`thumb`).
- **AssetFile**: the untouched original bytes, stored separately so grids never load full-size files.
- **Collection**: name, description, colour.
- **Meta**: small key/value flags (onboarding done, last backup time, dismissed hints).

Binary data is stored as `ArrayBuffer` rather than `Blob` because some browsers (for example Safari private windows) can't store Blobs in IndexedDB.

## Search

`buildSearchIndex` builds an in-memory MiniSearch index over title, prompt, tags, model, description, category and negative prompt, with prefix matching and light fuzziness. A plain substring pass catches punctuation-heavy queries (like `--ar 16:9`). Filters and sorting run on top of the result set. Nothing is sent anywhere.

## Backup format

A full backup is a zip file:

```
promptvault-backup.json     data (see below)
assets/<assetId>.<ext>      original image files
thumbs/<assetId>.webp|jpg   small previews (optional)
```

`promptvault-backup.json`:

```jsonc
{
  "format": "promptvault-backup",
  "version": 1,
  "exportedAt": "2026-11-05T19:00:00.000Z",
  "app": "PromptVault",
  "scope": "full",            // "full" | "collections" | "items"
  "includesFiles": true,
  "collections": [ /* Collection */ ],
  "creations":   [ /* Creation */ ],
  "assets":      [ /* Asset metadata + "file" and "thumbFile" paths */ ]
}
```

A data-only export is the same JSON on its own, with an empty `assets` array.

On import, every collection, creation and asset entry is validated with Zod. Unknown or malformed entries are skipped and reported, image files are verified by their signature, and the data is written in a single transaction so a failure leaves the library unchanged. Future format versions must increase `version` and keep older versions importable.

## Security measures

- Production builds inject a Content Security Policy (`vite.config.ts`) with `connect-src 'self'`, no inline scripts and `wasm-unsafe-eval` only for the OCR engine.
- No `dangerouslySetInnerHTML` anywhere. External links pass through `safeExternalUrl` (http/https only) and open with `rel="noopener noreferrer"`. The page sends no referrer.
- Uploads are limited to JPG, PNG, WebP and GIF, verified by magic bytes, up to 40 MB each.

## Extending PromptVault

The current version doesn't depend on any of these, but the structure leaves room for them:

- **Browser extension.** An extension could build a backup-format JSON (or a future "inbox" message) and hand it to the existing import pipeline in `lib/backup/import.ts`.
- **Sync / accounts.** All writes go through `lib/repo.ts`, which is the place to add change tracking for an optional sync layer. `updatedAt` timestamps already exist on every record.
- **Semantic search.** `lib/search.ts` exposes a single `applyFilters` entry point; an embedding-based ranker could plug in beside MiniSearch.
- **AI-assisted features.** Any feature that sends data to a third party must be opt-in, disclosed in the UI, and must update the CSP deliberately.
- **More OCR languages.** Add language data to `scripts/copy-ocr-assets.mjs` and pass the language codes in `lib/ocr.ts`.
- **Schema changes.** Add a new `this.version(n)` block in `lib/db.ts` with an upgrade function.
