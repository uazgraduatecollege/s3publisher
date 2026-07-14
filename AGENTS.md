# AGENTS.md

## Project overview

Single-file Node.js ES module (`index.js`) that uploads local files to AWS S3. No build step — ships raw `.js`. Published to GitHub Packages under `@uazgraduatecollege`.

## Commands

- **Lint:** `npx standard` (or runs automatically as `pretest` before tests)
- **Test:** `npm test` — runs `standard` then `mocha --reporter spec`

Tests require a live AWS S3 bucket. Set these env vars before running:
```
AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
```

## Architecture

- `index.js` — sole source file, exports `S3Publisher` class
- `test/index.js` — Mocha + Chai tests against real S3 (not mocked)
- No TypeScript, no build, no codegen, no transpilation

## Conventions

- `"type": "module"` in package.json — all `.js` files are ES modules
- Linting via `standard` (StandardJS style). ESLint config exists but `standard` is the actual linter used
- 2-space indent, LF line endings
- `test/` directory is excluded from linting (`.eslintignore`)
