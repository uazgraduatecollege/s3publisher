'use strict'

const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const fs = require('fs')
const path = require('path')

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
        if (path.extname(thisFilepath) === '.css') {
          mimeType = 'text/css'
        }
        if (path.extname(thisFilepath) === '.csv') {
          mimeType = 'text/csv'
        }
        if (path.extname(thisFilepath) === '.html') {
          mimeType = 'text/html'
        }
        if (path.extname(thisFilepath) === '.js') {
          mimeType = 'text/javascript'
        }
        if (path.extname(thisFilepath) === '.json') {
          mimeType = 'application/json'
        }
        if (path.extname(thisFilepath) === '.md') {
          mimeType = 'text/markdown'
        }
        if (path.extname(thisFilepath) === '.txt') {
          mimeType = 'text/plain'
        }
        if (path.extname(thisFilepath) === '.yaml') {
          mimeType = 'text/x-yaml'
        }
        if (path.extname(thisFilepath) === '.yml') {
          mimeType = 'text/x-yaml'
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
