# PromptVault — project status

_Last updated: 5 November 2026 · Version 1.0.0_

## Completed

| Phase | What was built | Tested |
| --- | --- | --- |
| 1. Foundation & design system | React 19 + TypeScript + Vite 8 + Tailwind 4; dark/light design tokens; component kit (buttons, inputs, dialogs, menus, badges, empty states); logo, favicon and app icons | Type-check, lint, visual review |
| 2. Dashboard & navigation | Sidebar, mobile drawer, global search (⌘K or /), shortcuts, dashboard stats, recent items, recently used prompts, quick collections, getting-started checklist, backup reminder | E2E |
| 3. Prompts & images | Create/edit/delete, incomplete records, multiple images with drag/drop/paste, roles, cover, alt text, captions, replace/remove, untouched originals plus previews, lightbox, file-type and size checks | Unit + E2E |
| 4. Organisation | Search (MiniSearch), filters (type, collection, model, tag, favourites), sorting, grid/list, collections (create/rename/delete/add/remove), favourites | Unit + E2E |
| 5. Video & variations | Video link, duration and thumbnail; duplicate as variation with origin; versions panel; side-by-side compare with word diff | E2E |
| 6. Import/export | Full .zip backup, data-only .json, Markdown, single-item and per-collection export, validated import with preview and skip/replace/keep-both | Unit + E2E (including corrupted files) |
| 7. OCR | Bundled Tesseract.js engine and English data served locally; editable result; save as new creation with the screenshot attached | E2E in Chromium and WebKit, with a check for zero external requests |
| 8. Settings, privacy, onboarding | Theme, default view, sample data load/remove, storage usage and persistence, clear-all with typed confirmation, privacy and about sections, five-step tour | E2E |
| 9. QA & responsive | 20 unit tests, 18 E2E scenarios across desktop Chromium/WebKit and phone-sized Chrome/Safari; no horizontal overflow on phones; production build with CSP | Passing locally |
| 10. Docs & GitHub assets | README, LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, architecture guide, issue and PR templates, CI and Pages workflows, real screenshots, social preview | — |

## Outstanding

- [ ] Upload `docs/social-preview.png` as the repository's social preview image (GitHub only allows this from the website: Settings → General → Social preview).
- [ ] Confirm the Firefox E2E run passes in CI (Firefox couldn't be launched by the test runner on the development Mac).
- [ ] Planned features listed in the README roadmap (offline/PWA install, bulk actions, more OCR languages, browser extension, optional sync).

## Known issues and limitations

- **Data lives in one browser on one device.** There's no sync. Use backups to move or protect the library.
- **Private/incognito windows** delete their data when closed.
- **Very large backups** are built in memory. Libraries of many gigabytes may fail to export on low-memory devices; export by collection instead.
- **OCR** is English-only in this release. Accuracy depends on image quality, and stylised fonts or handwriting may need manual correction.
- **HEIC photos** (iPhone default) aren't supported by most browsers. Convert them to JPG or PNG first.
- **Video files aren't stored**, by design. Only the link, duration and an optional thumbnail are saved.
- **No offline install yet.** PromptVault isn't installable as an offline app (PWA) yet, so it needs a connection to load.

## How to make changes

1. `npm install` once, then `npm run dev` to work on the app.
2. Run `npm run check` (and `npm run test:e2e` for UI changes) before committing.
3. Push to `main`. GitHub Actions runs the checks and redeploys the live site automatically.
