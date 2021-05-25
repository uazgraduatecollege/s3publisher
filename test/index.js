/* eslint-disable */
'use strict'

const AWS = require('aws-sdk')
const expect = require('chai').expect
const fs = require('fs')
const s3 = new AWS.S3()
const S3Publisher = require('../index')

let testPublisher = new S3Publisher({
  keyPrefix: 'testS3Publisher',
  bucket: process.env.AWS_S3_BUCKET,
  exclusions: ['.map']
})
let testDir0 = './test/foo' // test dir
let testDir1 = './test/empty' // empty
let testDir2 = './test/nil' // doesn't exist

describe('S3Publisher', () => {
  before((done) => {
    if (!fs.existsSync(testDir1)) {
      fs.mkdirSync(testDir1)
    }
    done()
  })

  after((done) => {
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

  describe('publish', () => {
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

    it('Does not upload files that match defined exclusions', (done) => {
      s3.getObject(
        {
          Bucket: process.env.AWS_S3_BUCKET,
          Key: '/testS3Publisher/script.js.map'
        }, (err, data) => {
          expect(err).to.have.property('statusCode')
          expect(err.statusCode).to.be(404)
      })
      done()
    })

    it('Uploads all files in a directory tree', (done) => {
      testPublisher.publish(testDir0, (err, data) => {
        expect(data).to.be.an('object')
        expect(data).to.have.propery('ETag')
        expect(data).to.have.propery('s3file')
      })

      const files = [
        '/testS3Publisher/JSON.json',
        '/testS3Publisher/YAML.yaml',
        '/testS3Publisher/YAML.yml',
        '/testS3Publisher/comma.csv',
        '/testS3Publisher/generic',
        '/testS3Publisher/markdown.md',
        '/testS3Publisher/script.js',
        '/testS3Publisher/style.css',
        '/testS3Publisher/text.txt',
        '/testS3Publisher/bar/JSON.json',
        '/testS3Publisher/bar/YAML.yaml',
        '/testS3Publisher/bar/YAML.yml',
        '/testS3Publisher/bar/comma.csv',
        '/testS3Publisher/bar/generic',
        '/testS3Publisher/bar/markdown.md',
        '/testS3Publisher/bar/script.js',
        '/testS3Publisher/bar/style.css',
        '/testS3Publisher/bar/text.txt',
      ]

      const excluded = [
        '/testS3Publisher/script.js.map',
        '/testS3Publisher/bar/script.js.map'
      ]

      s3.listObjectsV2(
        {
          Bucket: process.env.AWS_S3_BUCKET,
          Prefix: 'testS3Publisher'
        }, (err, data) => {
        expect(data).to.have.property('Contents')

        for (let i = 0; i < files.length; i++) {
          let nextRemote = data.Contents[i]
          expect(i).to.have.property('Key')
          let inFileList = files.includes(i.Key)
          expect(inFileList).to.be.true
        }
      })
      done()
    })

    it('Preserves the complete source tree if specified', (done) => {
      let fullSourcePublisher = new S3Publisher({
        keyPrefix: 'testS3Publisher',
        bucket: process.env.AWS_S3_BUCKET,
        preserveSourceDir: true
      })
      const files = [
        '/testS3Publisher/test/foo/JSON.json',
        '/testS3Publisher/test/foo/YAML.yaml',
        '/testS3Publisher/test/foo/YAML.yml',
        '/testS3Publisher/test/foo/comma.csv',
        '/testS3Publisher/test/foo/generic',
        '/testS3Publisher/test/foo/markdown.md',
        '/testS3Publisher/test/foo/script.js',
        '/testS3Publisher/test/foo/script.js.map',
        '/testS3Publisher/test/foo/style.css',
        '/testS3Publisher/test/foo/text.txt',
        '/testS3Publisher/test/foo/bar/JSON.json',
        '/testS3Publisher/test/foo/bar/YAML.yaml',
        '/testS3Publisher/test/foo/bar/YAML.yml',
        '/testS3Publisher/test/foo/bar/comma.csv',
        '/testS3Publisher/test/foo/bar/generic',
        '/testS3Publisher/test/foo/bar/markdown.md',
        '/testS3Publisher/test/foo/bar/script.js',
        '/testS3Publisher/test/foo/bar/script.js.map',
        '/testS3Publisher/test/foo/bar/style.css',
        '/testS3Publisher/test/foo/bar/text.txt',
      ]

      fullSourcePublisher.publish(testDir0, (err, data) => {
        expect(data).to.be.an('object')
        expect(data).to.have.propery('ETag')
        expect(data).to.have.propery('s3file')
      })

      s3.listObjectsV2(
        {
          Bucket: process.env.AWS_S3_BUCKET,
          Prefix: 'testS3Publisher'
        }, (err, data) => {

        expect(data).to.have.property('Contents')

        for (let i = 0; i < files.length; i++) {
          let nextRemote = data.Contents[i]
          expect(i).to.have.property('Key')
          let inFileList = files.includes(i.Key)
          expect(inFileList).to.be.true
        }
      })
      done()
    })
  })
})
