# AGENTS.md

## Project overview

Single-file Node.js ES module (`index.js`) that uploads local files to AWS S3. No build step — ships raw `.js`. Published to GitHub Packages under `@uazgraduatecollege`.

## Commands

- **Lint:** `npx standard` (or runs automatically as `pretest` before tests)
- **Test:** `npm test` — runs `standard` then `mocha --reporter spec`
- In CI/CD, use `npm ci` instead of `npm install` for deterministic builds from the lock file.

Tests run against a local [s3rver](https://www.npmjs.com/package/s3rver) mock by default. To test against a real S3 bucket, set `AWS_S3_BUCKET` (plus standard AWS credential env vars) before running.

## Architecture

- `index.js` — sole source file, exports `S3Publisher` class
- `test/index.js` — Mocha + Chai tests using s3rver (local S3 mock)
- `example.js` — runnable example, demonstrates S3Publisher usage with s3rver mock or live AWS
- No TypeScript, no build, no codegen, no transpilation

## Conventions

- `"type": "module"` in package.json — all `.js` files are ES modules
- Linting via `standard` (StandardJS style). ESLint config exists but `standard` is the actual linter used
- 2-space indent, LF line endings
- `test/` directory is linted along with source files
- When committing with issue references (e.g. "references #43", "closes #43"), use the exact keyword the user provides
