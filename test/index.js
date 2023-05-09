/* eslint-disable */
'use strict'

import { S3 } from '@aws-sdk/client-s3'
import S3Publisher from '../index.js'
import { mkdir, rmdir, stat } from 'fs'
import { expect } from 'chai'

const s3 = new S3()

let testPublisher = new S3Publisher({
  bucket: process.env.AWS_S3_BUCKET,
  exclusions: ['.map'],
  keyPrefix: 'testS3Publisher'
})
let testDir0 = './test/foo' // test dir & files
let testDir1 = './test/empty' // empty
let testDir2 = './test/nil' // doesn't exist

// make sure the remote path is clear
const cleanRemote = async () => {
  s3.listObjectsV2(
    {
      Bucket: process.env.AWS_S3_BUCKET,
      Prefix: 'testS3Publisher'
    }, (err, data) => {
      if (err) {
        console.error(err)
      }

      if (data.Contents.length > 0) {
        s3.deleteObjects({
          Bucket: process.env.AWS_S3_BUCKET,
          Delete: {
            Objects: data.Contents.map(({ Key }) => ({ Key }))
          }
        }, (delErr, delData) => {
          if (delErr) {
            console.error(delErr)
          }
        })
      }
    }
  )
}

describe('S3Publisher', () => {
  before(async () => {
    // start with a clean remote path
    await cleanRemote()

    // create an empty dir to test
    await stat(testDir1, (err, stats) => {
      if (err) {
        mkdir(testDir1, (err) => {
          if (err) {
            console.error(err)
          }
        })
      }
    })
  })

  after(async () => {
    // cleanup remote path
    await cleanRemote()

    // remove the empty dir
    await stat(testDir1, (err, stats) => {
      if (stats.isDirectory()) {
        rmdir(testDir1, (err) => {
          if (err) {
            console.error(err)
          }
        })
      }
    })
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
      await testPublisher.publish(testDir0, (err, data) => {
        expect(err).to.be.null
        expect(data).to.be.an('object')
        expect(data).to.have.property('ETag')
        expect(data).to.have.property('s3file')
      })
      await s3.getObject({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: 'testS3Publisher/script.js.map'
      }, (err, data) => {
        expect(data).to.be.null
      })
    })

    it('Uploads all files in a directory tree', async () => {
      // cleanup remote path
      await cleanRemote()
      await testPublisher.publish(testDir0, (err, data) => {
        expect(err).to.be.null
        expect(data).to.be.an('object')
        expect(data).to.have.property('ETag')
        expect(data).to.have.property('s3file')
      })
      await s3.listObjectsV2(
        {
          Bucket: process.env.AWS_S3_BUCKET,
          Prefix: 'testS3Publisher'
        }, (err, data) => {
          expect(err).to.be.null
          expect(data).to.have.property('Contents')
          expect(data).to.have.property('KeyCount')
          expect(data.KeyCount).to.equal(data.Contents.length)
          expect(data.KeyCount).to.be.gt(0)
        }
      )
    })

    it('Preserves the complete source tree when preserveSourceDir is specified', async () => {
      const fullSourcePublisher = new S3Publisher({
        keyPrefix: 'testS3Publisher',
        bucket: process.env.AWS_S3_BUCKET,
        exclusions: ['.map'],
        preserveSourceDir: true
      })
      // cleanup remote path
      await cleanRemote()
      await fullSourcePublisher.publish(testDir0, (err, data) => {
        expect(err).to.be.null
        expect(data).to.be.an('object')
        expect(data).to.have.property('ETag')
        expect(data).to.have.property('s3file')
      })
      await s3.listObjectsV2({
        Bucket: process.env.AWS_S3_BUCKET,
        Prefix: 'testS3Publisher/test'
      }, (err, data) => {
        expect(err).to.be.null
        expect(data).to.have.property('Contents')
        expect(data).to.have.property('KeyCount')
        expect(data.KeyCount).to.equal(data.Contents.length)
        expect(data.KeyCount).to.be.gt(0)
      })
      await s3.getObject({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: 'testS3Publisher/test/foo/script.js'
      }, (err, data) => {
        expect(err).to.be.null
        expect(data).to.have.property('ETag')
        expect(data).to.have.property('ContentLength')
        expect(data.ContentLength).to.be.gt(0)
        expect(data).to.have.property('ContentType')
        expect(data.ContentType).to.be.a('string')
        expect(data.ContentType).to.equal('text/javascript')
      })
    })
  })
})
