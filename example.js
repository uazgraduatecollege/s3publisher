'use strict'

/**
 * Example: S3Publisher usage
 *
 * Demonstrates uploading a local directory tree to S3.
 *
 * By default, uploads to a local s3rver mock (no AWS credentials required).
 * To upload to a real S3 bucket, set AWS_S3_BUCKET and standard AWS
 * credential env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
 *
 * Optional env vars:
 *   AWS_KEY_PREFIX_PATH  — custom S3 key prefix (default: testS3Publisher/foo)
 *
 * Run with:  node example.js
 */

import 'dotenv/config'

import path from 'path'
import { readdir, lstatSync } from 'fs'
import { S3 } from '@aws-sdk/client-s3'
import S3Publisher from './index.js'
import S3rver from 's3rver'

const useLiveAWS = typeof process.env.AWS_S3_BUCKET === 'string' && process.env.AWS_S3_BUCKET.length > 0
const BUCKET = useLiveAWS ? process.env.AWS_S3_BUCKET : 'mock-bucket'
const testDir = './test/foo'
const keyPrefix = process.env.AWS_KEY_PREFIX_PATH || path.join('testS3Publisher', 'foo')

const countFiles = (dir) => new Promise((resolve, reject) => {
  readdir(dir, { recursive: true }, (err, files) => {
    if (err) return reject(err)
    resolve(files.filter(f => {
      try { return lstatSync(path.join(dir, f)).isFile() } catch { return false }
    }).length)
  })
})

if (useLiveAWS) {
  const s3 = new S3()
  const myPublisher = new S3Publisher({ bucket: BUCKET, keyPrefix, s3Client: s3 })
  let uploaded = 0
  const total = await countFiles(testDir)
  myPublisher.publish(testDir, (err, data) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    console.log('Uploaded ' + data.s3file)
    if (++uploaded === total) process.exit(0)
  })
} else {
  console.log('No AWS_S3_BUCKET set, using local s3rver mock')
  const s3rver = new S3rver({
    port: 4568,
    address: 'localhost',
    silent: true,
    configureBuckets: [{ name: BUCKET }]
  }).run(async (err) => {
    if (err) throw err
    const s3 = new S3({
      endpoint: 'http://localhost:4568',
      forcePathStyle: true,
      credentials: { accessKeyId: 'S3RVER', secretAccessKey: 'S3RVER' }
    })
    const myPublisher = new S3Publisher({ bucket: BUCKET, keyPrefix, s3Client: s3 })
    let uploaded = 0
    const total = await countFiles(testDir)
    myPublisher.publish(testDir, (err, data) => {
      if (err) {
        console.error(err)
        process.exit(1)
      }
      console.log('Uploaded ' + data.s3file)
      if (++uploaded === total) {
        s3rver.close()
        process.exit(0)
      }
    })
  })
}
