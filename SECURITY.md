# Security Policy

PromptVault is a local-first web app: it has no server, no accounts and no database outside the user's own browser. Security issues are still taken seriously, especially anything that could expose a user's library or run untrusted code.

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x (latest release and `main`) | Yes |

## Reporting a vulnerability

**Please don't report security problems in public issues.**

Use GitHub's private vulnerability reporting:

1. Go to the repository's [Security tab](https://github.com/kapoorraghav-cmd/promptvault/security).
2. Click **Report a vulnerability**.
3. Describe the issue, the steps to reproduce it and the impact you expect.

If you can't use GitHub, email the maintainer at **kapoorraghav@live.com** with "PromptVault security" in the subject.

You can expect an acknowledgement within a few days. This is a volunteer-maintained project, so fix times vary, but you'll be kept informed and credited (if you'd like) when a fix is released.

## What's in scope

Examples of issues we'd like to hear about:

- Script injection (XSS) through prompts, titles, imported backups, file names or links
- Uploaded or imported files being executed or rendered as anything other than an image
- Ways to bypass the import validation or file-type checks
- Anything that causes library data to be sent to another server
- Weaknesses in the production Content Security Policy

## Security model

- All data stays in the browser's IndexedDB on the user's device. PromptVault doesn't encrypt it. Anyone with access to the browser profile can read it.
- The production build includes a Content Security Policy that blocks connections to other origins (`connect-src 'self'`) and disallows inline scripts.
- Uploaded images are verified by their file signature. SVG, HTML and other script-capable formats are refused.
- Imported backups are size-limited and every record is validated before it's written.
- User text is always rendered as text, never as HTML, and only `http(s)` links are made clickable.
