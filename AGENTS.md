# AGENTS.md

## Project overview

Single-file Node.js ES module (`index.js`) that uploads local files to AWS S3. No build step — ships raw `.js`. Published to GitHub Packages under `@uazgraduatecollege`.

## Commands

- **Lint:** `npx standard` (or runs automatically as `pretest` before tests)
- **Test:** `npm test` — runs `standard` then `mocha --reporter spec`

Tests run against a local [s3rver](https://www.npmjs.com/package/s3rver) mock by default. To test against a real S3 bucket, set `AWS_S3_BUCKET` (plus standard AWS credential env vars) before running.

## Architecture

- `index.js` — sole source file, exports `S3Publisher` class
- `test/index.js` — Mocha + Chai tests using s3rver (local S3 mock)
- No TypeScript, no build, no codegen, no transpilation

## Conventions

- `"type": "module"` in package.json — all `.js` files are ES modules
- Linting via `standard` (StandardJS style). ESLint config exists but `standard` is the actual linter used
- 2-space indent, LF line endings
- `test/` directory is excluded from linting (`.eslintignore`)
