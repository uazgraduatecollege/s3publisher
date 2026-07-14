/* eslint-disable */
'use strict'

import 'dotenv/config'

import { S3 } from '@aws-sdk/client-s3'
import S3Publisher from '../index.js'
import S3rver from 's3rver'
import { mkdir, rmdir, stat } from 'fs'
import { expect } from 'chai'

const useLiveAWS = typeof process.env.AWS_S3_BUCKET === 'string' && process.env.AWS_S3_BUCKET.length > 0
const BUCKET = useLiveAWS ? process.env.AWS_S3_BUCKET : 'test-bucket'
let s3
let testPublisher
let s3rverInstance

let testDir0 = './test/foo' // test dir & files
let testDir1 = './test/empty' // empty
let testDir2 = './test/nil' // doesn't exist

const publishAsync = (publisher, dir) => new Promise((resolve, reject) => {
  publisher.publish(dir, (err, data) => {
    if (err) return reject(err)
    resolve(data)
  })
})

// make sure the remote path is clear
const cleanRemote = async () => {
  const data = await s3.listObjectsV2({
    Bucket: BUCKET,
    Prefix: 'testS3Publisher'
  })

  if (data.KeyCount > 0) {
    await s3.deleteObjects({
      Bucket: BUCKET,
      Delete: {
        Objects: data.Contents.map(({ Key }) => ({ Key }))
      }
    })
  }
}

describe('S3Publisher', () => {
  before((done) => {
    const setup = () => {
      testPublisher = new S3Publisher({
        bucket: BUCKET,
        exclusions: ['.map'],
        keyPrefix: 'testS3Publisher',
        s3Client: s3
      })

      cleanRemote()
        .then(() => {
          stat(testDir1, (err) => {
            if (err) {
              mkdir(testDir1, (err) => {
                if (err) console.error(err)
                done()
              })
            } else {
              done()
            }
          })
        })
        .catch(done)
    }

    if (useLiveAWS) {
      s3 = new S3()
      setup()
    } else {
      s3rverInstance = new S3rver({
        port: 4568,
        address: 'localhost',
        silent: true,
        configureBuckets: [{ name: BUCKET }]
      }).run((err) => {
        if (err) return done(err)

        s3 = new S3({
          endpoint: 'http://localhost:4568',
          forcePathStyle: true,
          credentials: {
            accessKeyId: 'S3RVER',
            secretAccessKey: 'S3RVER'
          }
        })

        setup()
      })
    }
  })

  after((done) => {
    cleanRemote()
      .then(() => {
        stat(testDir1, (err, stats) => {
          const cleanup = () => {
            if (s3rverInstance) {
              s3rverInstance.close(done)
            } else {
              done()
            }
          }

          if (stats && stats.isDirectory()) {
            rmdir(testDir1, (err) => {
              if (err) console.error(err)
              cleanup()
            })
          } else {
            cleanup()
          }
        })
      })
      .catch(done)
  })

  it('Should error if not instantiated with a params object', async () => {
    await expect(function () { new S3Publisher() }).to.throw(Error)
  })

  it('Should error if not instantiated with a valid bucket parameter', async () => {
    await expect(function () { new S3Publisher({}) }).to.throw(Error)
    await expect(function () { new S3Publisher({ bucket: "" }) }).to.throw(Error)
  })

  it('It instantiates a valid object when when required parameters are passed to the constructor', async () => {
    await expect(testPublisher).to.be.an.instanceof(S3Publisher)
  })

  describe('S3Publisher.publish()', () => {
    it('Returns an error if the source directory does not exist', async () => {
      await testPublisher.publish(testDir2, (err, data) => {
        expect(err).to.be.an('Error')
        expect(data).to.be.undefined
      })
    })

    it('Does not bork when encountering an empty directory', async () => {
      await testPublisher.publish(testDir1, (err, data) => {
        expect(err).to.be.null
      })
    })

    it('Does not upload files that match defined exclusions', async () => {
      // cleanup remote path
      await cleanRemote()
      const data = await publishAsync(testPublisher, testDir0)
      expect(data).to.be.an('object')
      expect(data).to.have.property('ETag')
      expect(data).to.have.property('s3file')
      const obj = await s3.getObject({
        Bucket: BUCKET,
        Key: 'testS3Publisher/script.js.map'
      }).catch(() => null)
      expect(obj).to.be.null
    })

    it('Uploads all files in a directory tree', async () => {
      // cleanup remote path
      await cleanRemote()
      const data = await publishAsync(testPublisher, testDir0)
      expect(data).to.be.an('object')
      expect(data).to.have.property('ETag')
      expect(data).to.have.property('s3file')
      const list = await s3.listObjectsV2({
        Bucket: BUCKET,
        Prefix: 'testS3Publisher'
      })
      expect(list).to.have.property('Contents')
      expect(list).to.have.property('KeyCount')
      expect(list.KeyCount).to.equal(list.Contents.length)
      expect(list.KeyCount).to.be.gt(0)
    })

    it('Preserves the complete source tree when preserveSourceDir is specified', async () => {
      const fullSourcePublisher = new S3Publisher({
        keyPrefix: 'testS3Publisher',
        bucket: BUCKET,
        exclusions: ['.map'],
        preserveSourceDir: true,
        s3Client: s3
      })
      // cleanup remote path
      await cleanRemote()
      const data = await publishAsync(fullSourcePublisher, testDir0)
      expect(data).to.be.an('object')
      expect(data).to.have.property('ETag')
      expect(data).to.have.property('s3file')
      const list = await s3.listObjectsV2({
        Bucket: BUCKET,
        Prefix: 'testS3Publisher/test'
      })
      expect(list).to.have.property('Contents')
      expect(list).to.have.property('KeyCount')
      expect(list.KeyCount).to.equal(list.Contents.length)
      expect(list.KeyCount).to.be.gt(0)
      const obj = await s3.getObject({
        Bucket: BUCKET,
        Key: 'testS3Publisher/test/foo/script.js'
      })
      expect(obj).to.have.property('ETag')
      expect(obj).to.have.property('ContentLength')
      expect(obj.ContentLength).to.be.gt(0)
      expect(obj).to.have.property('ContentType')
      expect(obj.ContentType).to.be.a('string')
      expect(obj.ContentType).to.equal('text/javascript')
    })

    it('Sets the correct content type for each file extension', async () => {
      const noExclPublisher = new S3Publisher({
        bucket: BUCKET,
        keyPrefix: 'testS3Publisher',
        s3Client: s3
      })
      await cleanRemote()
      await publishAsync(noExclPublisher, testDir0)

      const expected = {
        'style.css': 'text/css',
        'comma.csv': 'text/csv',
        'JSON.json': 'application/json',
        'markdown.md': 'text/markdown',
        'script.js': 'text/javascript',
        'script.js.map': 'text/javascript',
        'text.txt': 'text/plain',
        'YAML.yml': 'text/x-yaml',
        'YAML.yaml': 'text/x-yaml',
        'generic': 'application/octet-stream'
      }

      for (const [file, expectedType] of Object.entries(expected)) {
        const obj = await s3.getObject({
          Bucket: BUCKET,
          Key: `testS3Publisher/${file}`
        })
        expect(obj.ContentType).to.equal(expectedType)
      }
    })

    it('Includes the correct s3:// URI in the returned data', async () => {
      await cleanRemote()
      const data = await publishAsync(testPublisher, testDir0)
      expect(data.s3file).to.match(new RegExp(`^s3://${BUCKET}/testS3Publisher/`))
    })

    it('Uploads files to the keyPrefix path without preserving source dir', async () => {
      const prefixPublisher = new S3Publisher({
        bucket: BUCKET,
        keyPrefix: 'myprefix',
        exclusions: ['.map'],
        s3Client: s3
      })
      await cleanRemote()
      await publishAsync(prefixPublisher, testDir0)
      const list = await s3.listObjectsV2({
        Bucket: BUCKET,
        Prefix: 'myprefix'
      })
      expect(list.KeyCount).to.be.gt(0)
      for (const item of list.Contents) {
        expect(item.Key).to.match(/^myprefix\//)
        expect(item.Key).to.not.include('test/foo')
      }
    })

    it('Excludes multiple file extensions', async () => {
      const multiExclPublisher = new S3Publisher({
        bucket: BUCKET,
        keyPrefix: 'testS3Publisher',
        exclusions: ['.map', '.csv'],
        s3Client: s3
      })
      await cleanRemote()
      await publishAsync(multiExclPublisher, testDir0)
      const list = await s3.listObjectsV2({
        Bucket: BUCKET,
        Prefix: 'testS3Publisher'
      })
      for (const item of list.Contents) {
        expect(item.Key).to.not.match(/\.map$/)
        expect(item.Key).to.not.match(/\.csv$/)
      }
    })
  })
})
