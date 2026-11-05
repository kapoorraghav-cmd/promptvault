# Changelog

All notable changes to PromptVault are documented here. This project follows [Semantic Versioning](https://semver.org).

## [1.0.0] — 2026-11-05

The first public release.

### Added

- Local library stored in IndexedDB: creations with title, prompt, negative prompt, notes, model, content type, category, tags, collections, aspect ratio, resolution, seed, settings, source URL and creation date.
- Image attachments: multiple per creation, drag-and-drop, clipboard paste, preview before saving, roles (result, reference, thumbnail), cover selection, alt text, captions, replace and remove, untouched originals with generated previews, full-size viewer.
- Video records that store a link, duration and thumbnail (no video download).
- Library with grid and list views, on-device full-text search, filters (type, collection, model, tag, favourites) and sorting.
- Collections with colours, rename, delete (keeps the items), add/remove items and multi-collection membership.
- Favourites and a "recently used prompts" list based on copying.
- Variations: duplicate any prompt as an independent copy that records its origin; side-by-side comparison with word-level highlights.
- Screenshot-to-prompt extraction with a bundled Tesseract OCR engine running on the device.
- Backup and restore: full `.zip` backup with original images, data-only `.json`, Markdown export, single-item and per-collection export, validated import with a preview and duplicate handling (skip, replace, keep both).
- Dashboard with totals, recent items, recently used prompts, quick-access collections, a getting-started checklist and backup reminders.
- Settings: theme (dark, light, system), default view, sample data, storage usage and persistence request, clear-all-data with typed confirmation, privacy information and about.
- First-run tour and a removable sample library with original illustrations.
- Responsive layout for desktop, tablet and phone; keyboard shortcuts (`N` new, `⌘K`/`Ctrl K` or `/` search, `⌘↵`/`Ctrl ↵` save).
- Strict Content Security Policy in production builds.
- Unit tests (Vitest), end-to-end tests (Playwright: Chromium, Firefox, WebKit, mobile Chrome and Safari), CI and GitHub Pages deployment.

[1.0.0]: https://github.com/kapoorraghav-cmd/promptvault/releases/tag/v1.0.0
