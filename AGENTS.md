# AGENTS.md

## Project overview

Single-file Node.js ES module (`index.js`) that uploads local files to AWS S3. No build step — ships raw `.js`. Published to GitHub Packages under `@uazgraduatecollege`. Uses [pnpm](https://pnpm.io) as the package manager (pinned via `packageManager` in package.json).

## Commands

- **Lint:** `npx eslint .` (or runs automatically as `pretest` before tests)
- **Test:** `pnpm test` — runs `eslint .` then `mocha --reporter spec`
- In CI/CD, use `pnpm install --frozen-lockfile` instead of `pnpm install` for deterministic builds from the lock file.

Tests run against a local [s3rver](https://www.npmjs.com/package/s3rver) mock by default. To test against a real S3 bucket, set `AWS_S3_BUCKET` (plus standard AWS credential env vars) before running.

## Architecture

- `index.js` — sole source file, exports `S3Publisher` class
- `test/index.js` — Mocha + Chai tests using s3rver (local S3 mock)
- `example.js` — runnable example, demonstrates S3Publisher usage with s3rver mock or live AWS
- No TypeScript, no build, no codegen, no transpilation

## Conventions

- `"type": "module"` in package.json — all `.js` files are ES modules
- Linting via [neostandard](https://github.com/neostandard/neostandard) with ESLint 9 flat config (`eslint.config.js`). Run `npx eslint .` to lint
- 2-space indent, LF line endings
- `test/` directory is linted along with source files
- When committing with issue references (e.g. "references #43", "closes #43"), use the exact keyword the user provides
- Reference phrases should be on the last line of the commit message, separated by a blank line
- Don't commit changes unless the user explicity instructs you to do so

