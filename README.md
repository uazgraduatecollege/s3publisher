# S3Publisher

S3Publisher is a utility for deploying static files to AWS S3.
Intended primarily for use in CI/CD tasks, eg. publishing a tagged release using gulp.

## Requirements

- Node.js 22 or later
- AWS credentials for a live bucket, or the local [s3rver](https://www.npmjs.com/package/s3rver) mock used by the example and tests

## Installation

The package is published to GitHub Packages under the `@uazgraduatecollege` scope. Add an `.npmrc` to your project that routes the scope to GitHub Packages and everything else to the public registry:

```ini
registry=https://registry.npmjs.org/
@uazgraduatecollege:registry=https://npm.pkg.github.com/
```

Authentication to GitHub Packages needs a token with the `read:packages` scope. Configure it outside the project's `.npmrc`, so no secrets are committed or read from environment variables in the file.

Then install:

```sh
npm install @uazgraduatecollege/s3publisher
```

## Usage

```js
import S3Publisher from '@uazgraduatecollege/s3publisher'

const publisher = new S3Publisher({
  bucket: 'my-bucket',
  keyPrefix: 'releases/1.0.0',
  exclusions: ['.map']
})

publisher.publish('./dist', (err, data) => {
  if (err) throw err
  if (data) console.log('Uploaded ' + data.s3file)
})
```

`publish` walks the directory tree and uploads each file. The callback is called **once per uploaded file**, not once when all uploads finish. Each call receives `data.s3file`, the `s3://` URI of that file. Errors are passed as the first argument. If the directory is empty, the callback is called once with no error and no data. There is no single completion callback, so count the uploads yourself if you need to know when everything is done (see `example.js`).

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `bucket` | string | — (required) | Target bucket name. Must follow S3 naming rules: 3–63 characters, lowercase letters, digits, dots, and hyphens. |
| `keyPrefix` | string | `''` | Path prefix for uploaded keys. Must be relative and must not contain `..`. |
| `exclusions` | array of strings | `[]` | File extensions to skip, including the leading dot (e.g. `['.map']`). |
| `preserveSourceDir` | boolean | `false` | When `true`, keeps the source directory name in the uploaded key path. When `false`, uploads the directory's contents directly under `keyPrefix`. |
| `acl` | string | none | Optional S3 ACL to apply to each object, e.g. `'public-read'`. |
| `s3Client` | object | `new S3()` | Optional `@aws-sdk/client-s3` `S3` instance. Defaults to the standard AWS credential chain. |

Invalid options throw when the publisher is constructed.

## Example

`example.js` uploads the fixtures in `test/foo` to either a live bucket or the local mock:

```sh
pnpm install
node example.js
```

By default it uploads to a local s3rver mock and needs no AWS credentials. To upload to a real bucket, set these environment variables:

- `AWS_S3_BUCKET` — target bucket name (required for live upload)
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` — AWS credentials
- `AWS_KEY_PREFIX_PATH` — optional key prefix (default: `testS3Publisher/foo`)

The example reads `.env` files via `dotenv`.

## Development

```sh
pnpm install --frozen-lockfile
pnpm test
```

`pnpm test` runs ESLint and then the Mocha test suite against the s3rver mock. See [AGENTS.md](AGENTS.md) for project conventions.

## Releasing

Releases are created by pushing a bare semver tag (no `v` prefix), for example `1.0.4`, `1.0.4-alpha1`, `1.0.4-beta.2`, or `1.0.4-rc1`. The release workflow:

- publishes the package to GitHub Packages, using the tag as the version;
- publishes prereleases under the `alpha`, `beta`, or `rc` dist-tag, so `npm install` still installs the latest stable version;
- creates a GitHub Release, marked as a prerelease when the tag has a suffix, only after publishing succeeds.

See [AGENTS.md](AGENTS.md) for details, including how to recover from a partially failed release.
