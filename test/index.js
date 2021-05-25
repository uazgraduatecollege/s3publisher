/* eslint-disable */
'use strict'

const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const expect = require('chai').expect
const fs = require('fs')
const S3Publisher = require('../index')

let testPublisher = new S3Publisher({
  keyPrefix: 'testS3Publisher',
  bucket: process.env.AWS_S3_BUCKET,
  exclusions: ['.map']
})
let testDir0 = './test/foo' // test dir
let testDir1 = './test/empty' // empty
let testDir2 = './test/nil' // doesn't exist

// make sure the remote path is clear
const cleanRemote = () => {
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
  before((done) => {
    // start with a clean remote path
    cleanRemote()

    // create an empty dir to test
    if (!fs.existsSync(testDir1)) {
      fs.mkdirSync(testDir1)
    }

    done()
  })

  after((done) => {
    // cleanup remote path
    cleanRemote()

    // remove the empty dir
    if (fs.existsSync(testDir1)) {
      fs.rmdirSync(testDir1)
    }

    done()
  })

  it('Should error if not instantiated with a params object', (done) => {
    expect(function () { new S3Publisher() }).to.throw(Error)
    done()
  })

  it('Should error if not instantiated with a bucket parameter', (done) => {
    expect(function () { new S3Publisher({}) }).to.throw(Error)
    done()
  })

  it('It instantiates a valid object when when required parameters are passed to the constructor', (done) => {
    expect(testPublisher).to.be.an.instanceof(S3Publisher)
    done()
  })

  describe('S3Publisher.publish()', () => {
    it('Returns an error if the source directory does not exist', (done) => {
      testPublisher.publish(testDir2, (err, data) => {
        expect(err).to.be.an('Error')
        expect(data).to.be.undefined
      })
      done()
    })

    it('Does not bork when encountering an empty directory', (done) => {
      testPublisher.publish(testDir1, (err, data) => {
        expect(err).to.be.null
      })
      done()
    })

    it('Uploads all files in a directory tree', async () => {
      testPublisher.publish(testDir0, (err, data) => {
        expect(data).to.be.an('object')
        expect(data).to.have.property('ETag')
        expect(data).to.have.property('s3file')
      })

      const objectList = await s3.listObjectsV2(
        {
          Bucket: process.env.AWS_S3_BUCKET,
          Prefix: 'testS3Publisher'
        }
      ).promise()
      expect(objectList).to.have.property('Contents')
      expect(objectList).to.have.property('KeyCount')
      expect(objectList.KeyCount).to.equal(objectList.Contents.length)
      expect(objectList.KeyCount).to.be.gt(0)
    }).timeout(10000)

    it('Does not upload files that match defined exclusions', (done) => {
      s3.getObject(
        {
          Bucket: process.env.AWS_S3_BUCKET,
          Key: '/testS3Publisher/script.js.map'
        }, (err, data) => {
          expect(err).to.have.property('statusCode')
          expect(err.statusCode).to.equal(404)
      })

      done()
    }).timeout(10000)

    it('Preserves the complete source tree when preserveSourceDir is specified', async () => {
      let fullSourcePublisher = new S3Publisher({
        keyPrefix: 'testS3Publisher',
        bucket: process.env.AWS_S3_BUCKET,
        preserveSourceDir: true
      })

      fullSourcePublisher.publish(testDir0, (err, data) => {
        expect(data).to.be.an('object')
        expect(data).to.have.property('ETag')
        expect(data).to.have.property('s3file')
      })

      const objectList = await s3.listObjectsV2(
        {
          Bucket: process.env.AWS_S3_BUCKET,
          Prefix: 'testS3Publisher/test'
        }
      ).promise()

      expect(objectList).to.have.property('Contents')
      expect(objectList).to.have.property('KeyCount')
      expect(objectList.KeyCount).to.equal(objectList.Contents.length)
      expect(objectList.KeyCount).to.be.gt(0)
    }).timeout(10000)
  })
})
