# S3Publisher

S3Publisher is a utility for deploying static files to AWS S3.
Intended primarily for use in CI/CD tasks, eg. publishing a tagged release using gulp.

## Usage

See `example.js` for a working example. Run it with:

    node example.js

By default, the example uploads to a local [s3rver](https://www.npmjs.com/package/s3rver)
mock (no AWS credentials required). To upload to a real S3 bucket, set `AWS_S3_BUCKET` and
standard AWS credential env vars (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).

