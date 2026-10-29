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
- `.github/workflows/test.yml` — runs `pnpm test` on pull requests to `main`
- `.github/workflows/release-and-publish-on-tag.yml` — publishes and releases on tag push (see Releases)
- No TypeScript, no build, no codegen, no transpilation

## Releases

- Releases are created by pushing a tag. The workflow publishes first, then creates the GitHub Release only if publishing succeeds.
- Tags must be bare semver with no `v` prefix, e.g. `1.0.4`, `1.0.4-alpha1`, `1.0.4-beta.2`, `1.0.4-rc1`. Tag filters are globs, so they approximate semver rather than matching it exactly.
- The workflow sets `package.json` `version` from the tag at publish time. The version change is not committed back to the repo, so `package.json` on `main` may lag the latest published version.
- Prerelease tags publish under their own dist-tag (`alpha`, `beta`, `rc`) and are marked as prereleases on GitHub. Only stable tags publish as `latest`.
- A failed publish leaves no GitHub Release. If publishing succeeds but the release step fails, the version is already on GitHub Packages and a re-run will fail at publish. Delete that version in GitHub Packages before retrying.

## Conventions

- `"type": "module"` in package.json — all `.js` files are ES modules
- Linting via [neostandard](https://github.com/neostandard/neostandard) with ESLint 10 flat config (`eslint.config.js`). Run `npx eslint .` to lint
- 2-space indent, LF line endings
- `test/` directory is linted along with source files
- When committing with issue references (e.g. "references #43", "closes #43"), use the exact keyword the user provides
- Reference phrases should be on the last line of the commit message, separated by a blank line
- Don't commit changes unless the user explicity instructs you to do so

