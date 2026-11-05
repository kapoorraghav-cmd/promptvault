# Contributing to PromptVault

Thanks for your interest in improving PromptVault! Bug reports, ideas, documentation fixes and code are all welcome.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- **Report a bug** using the [bug report form](https://github.com/kapoorraghav-cmd/promptvault/issues/new?template=bug_report.yml).
- **Suggest a feature** using the [feature request form](https://github.com/kapoorraghav-cmd/promptvault/issues/new?template=feature_request.yml).
- **Improve the docs**, including typos and unclear instructions.
- **Pick up an issue.** Comment on it first so work isn't duplicated.

Please never include private prompts, images or personal data in issues or pull requests.

## Development setup

Requirements: [Node.js](https://nodejs.org/) 22.12+ and npm.

```bash
git clone https://github.com/kapoorraghav-cmd/promptvault.git
cd promptvault
npm install
npm run dev
```

`npm run dev` copies the bundled OCR engine into `public/ocr/` and starts Vite at http://localhost:5173.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build the production site into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |
| `npm run typecheck` | Type-check with TypeScript |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright). Run `npx playwright install` once first |
| `npm run check` | Lint, type-check, unit tests and build in one go |

## Project structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a tour of the codebase. In short:

```
src/
  components/   UI building blocks (ui/, layout/, creations/, collections/, onboarding/)
  pages/        One file per screen
  lib/          Data, storage, search, backup, OCR and helpers (no React in most files)
  store/        Small UI state (theme, view preference, in-memory hand-offs)
e2e/            Playwright end-to-end tests
scripts/        Build helpers (OCR assets, sample art, screenshots, icons)
```

## Guidelines

- **Privacy first.** Don't add analytics, tracking, remote fonts or third-party requests. Any optional online feature must be opt-in and clearly explain what data is sent. The production Content Security Policy (in `vite.config.ts`) should stay strict.
- **Local-first.** The app must keep working with no account, no backend and no API key.
- **Never render untrusted HTML.** Don't use `dangerouslySetInnerHTML`. Validate links with `safeExternalUrl`.
- **Keep the design consistent.** Use the existing tokens (`bg-surface`, `text-muted`, `border-line`…) and components in `src/components/ui`.
- **Accessibility matters.** Use real buttons and links, label inputs and support the keyboard.
- **Test what you change.** Add or update unit tests in `src/**/*.test.ts` and end-to-end tests in `e2e/` for user-facing behaviour.
- **Database changes** need a new Dexie version in `src/lib/db.ts` with an upgrade path, and the backup format (`src/lib/backup/schema.ts`) must stay backwards compatible.

## Pull requests

1. Fork the repository and create a branch from `main` (for example `fix/import-error-message`).
2. Make your change with clear, focused commits.
3. Run `npm run check` and, for UI changes, `npm run test:e2e`.
4. Open a pull request using the template. Include screenshots for visual changes.

The CI workflow runs lint, type-checking, unit tests, the production build and end-to-end tests on every pull request.

## Licence

By contributing, you agree that your contributions will be licensed under the [MIT Licence](LICENSE).
