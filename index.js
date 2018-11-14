'use strict'

const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const fs = require('fs')
const fileType = require('file-type')
const path = require('path')
const readChunk = require('read-chunk')

const _awsPutFile = Symbol('awsPutFile')

class S3Publisher {
  constructor (params) {
    if (typeof params === 'undefined') {
      throw new Error('S3Publisher must be instantiated with a params object')
    } else if (typeof params.bucket === 'undefined') {
      throw new Error('S3Publisher must be instantiated with a bucket parameter')
    } else {
      this.params = {}
      this.params.preserveSourceDir = params.preserveSourceDir || false
      this.params.keyPrefix = params.keyPrefix || ''
      this.params.bucket = params.bucket
    }
  }

  [_awsPutFile] (params, cb) {
    let putParams = {
      Bucket: params.bucket,
      Key: params.remoteFilepath,
      Body: fs.readFileSync(params.localFilepath),
      ACL: 'public-read',
      ContentType: params.mimeType
    }
    s3.putObject(putParams, (err, data) => {
      if (err) {
        return cb(err)
      } else {
        let s3file = 's3://' + putParams.Bucket + '/' + putParams.Key
        data.s3file = s3file
        cb(null, data)
      }
    })
  }
}

S3Publisher.prototype.publish = function publish (aDir, cb) {
  fs.readdir(aDir, (err, files) => {
    if (err) {
      return cb(err)
    }

    for (let i in files) {
      let nextFile = files[i]
      let thisFilepath = path.join(aDir, nextFile)
      let nextStats = fs.statSync(thisFilepath)

      // recursively upload files in child directories
      if (nextStats.isDirectory()) {
        this.publish(thisFilepath, (err, data) => {
          if (err) {
            return cb(err)
          } else {
            cb(null, data)
          }
        })
      }

      // determine content type & upload files
      if (nextStats.isFile()) {
        let mimeType = 'application/octet-stream'
        let fileExt = path.extname(thisFilepath)
        switch (fileExt) {
          case '.css':
            mimeType = 'text/css'
            break

          case '.csv':
            mimeType = 'text/csv'
            break

          case '.html':
            mimeType = 'text/html'
            break

          case '.js':
            mimeType = 'text/javascript'
            break

          case '.json':
            mimeType = 'application/json'
            break

          case '.md':
            mimeType = 'text/markdown'
            break

          case '.txt':
            mimeType = 'text/plain'
            break

          case '.yaml':
            mimeType = 'text/x-yaml'
            break

          case '.yml':
            mimeType = 'text/x-yaml'
            break

          default:
            let ftDetected = fileType(readChunk.sync(thisFilepath, 0, 4100))
            if (ftDetected !== null) {
              mimeType = ftDetected.mime
            } else {
              mimeType = 'application/octet-stream'
            }
        }

        // assemble the s3 file path
        let remoteFilepath = path.join(this.params.keyPrefix, nextFile)
        if (this.params.preserveSourceDir) {
          remoteFilepath = path.join(this.params.keyPrefix, aDir, nextFile)
        }

        // assemble the putObject parameters
        let putParams = {
          bucket: this.params.bucket,
          remoteFilepath: remoteFilepath,
          localFilepath: thisFilepath,
          mimeType: mimeType
        }

        this[_awsPutFile](putParams, (err, data) => {
          if (err) {
            return cb(err)
          } else {
            cb(null, data)
          }
        })
      }
    }
  })
}

module.exports = S3Publisher
