/* eslint-disable */
'use strict'

import 'dotenv/config'

import { S3 } from '@aws-sdk/client-s3'
import S3Publisher from '../index.js'
import S3rver from 's3rver'
import { mkdir, rmdir, stat } from 'fs'
import { expect } from 'chai'

const BUCKET = 'test-bucket'
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

      testPublisher = new S3Publisher({
        bucket: BUCKET,
        exclusions: ['.map'],
        keyPrefix: 'testS3Publisher',
        s3Client: s3
      })

      cleanRemote()
        .then(() => {
          // create an empty dir to test
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
    })
  })

  after((done) => {
    cleanRemote()
      .then(() => {
        // remove the empty dir
        stat(testDir1, (err, stats) => {
          if (stats && stats.isDirectory()) {
            rmdir(testDir1, (err) => {
              if (err) console.error(err)
              s3rverInstance.close(done)
            })
          } else {
            s3rverInstance.close(done)
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
  })
})
