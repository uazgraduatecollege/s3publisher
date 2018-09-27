/* eslint-disable */
'use strict'

const AWS = require('aws-sdk')
const expect = require('chai').expect
const fs = require('fs')
const s3 = new AWS.S3()
const S3Publisher = require('../index')

let testPublisher = new S3Publisher({
  keyPrefix: 'testS3Publisher',
  bucket: process.env.AWS_S3_BUCKET
})
let testDir0 = './test/dir0'
let testDir1 = './test/dir1' // empty
let testDir2 = './test/dir2' // doesn't exist
let testDir00 = './test/dir0/dir00' // empty

describe('S3Publisher', () => {
  before((done) => {
    fs.mkdirSync(testDir1)
    fs.mkdirSync(testDir00)
    done()
  })

  after((done) => {
    fs.rmdirSync(testDir1)
    fs.rmdirSync(testDir00)
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

    it('Uploads all files in a directory', (done) => {
      testPublisher.publish(testDir0, (err, data) => {
        expect(data).to.be.an('object')
        expect(data).to.have.propery('ETag')
        expect(data).to.have.propery('s3file')
      })
      done()
    })

    it('Does not bork when encountering an empty directory', (done) => {
      testPublisher.publish(testDir1, (err, data) => {
        expect(err).to.be.null
      })
      done()
    })
  })
})
