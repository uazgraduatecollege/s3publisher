'use strict'

import { S3 } from '@aws-sdk/client-s3'
import { fileTypeFromFile } from 'file-type'
import { readdir, createReadStream, lstatSync } from 'fs'
import path from 'path'

/* eslint-disable-next-line */
const _awsPutFile = Symbol('awsPutFile')

class S3Publisher {
  /**
   * constructor
   *
   * @params - Parameters object
   * @params.bucket string The name of the S3 bucket where files will be synced
   * @params.exclusions array A list of file extensions to be excluded when uploading
   * @params.keyPrefix string A directory path to be created in the remote bucket
   * @params.preserveSourceTree boolean Whether
   * @params.s3Client object Optional custom S3 client instance
   * @params.acl string Optional S3 ACL value (e.g. 'public-read'). Omitted by default.
   */
  constructor (params) {
    // params must be passed
    if (typeof params === 'undefined') {
      throw new Error('S3Publisher must be instantiated with a params object')

      // params must include at least the 'bucket' parameter
    } else if (typeof params.bucket === 'undefined') {
      throw new Error('S3Publisher must be instantiated with the bucket parameter')

      // the 'bucket' param must be a non-empty string
    } else if (typeof params.bucket === 'string' && params.bucket.length === 0) {
      throw new Error('S3Publisher must be instantiated with a valid bucket name')

      // the 'bucket' param must conform to S3 naming rules
    } else if (params.bucket.length < 3 || params.bucket.length > 63 ||
        !/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(params.bucket)) {
      throw new Error('S3Publisher must be instantiated with a valid bucket name')

      // good-to-go
    } else {
      this.params = {}
      this.params.bucket = params.bucket

      if (params.exclusions !== undefined && params.exclusions !== null) {
        if (!Array.isArray(params.exclusions)) {
          throw new Error('exclusions must be an array')
        }
      }
      this.params.exclusions = params.exclusions || []

      if (params.keyPrefix !== undefined && params.keyPrefix !== null) {
        if (typeof params.keyPrefix !== 'string') {
          throw new Error('keyPrefix must be a string')
        }
      }
      this.params.keyPrefix = params.keyPrefix || ''

      // validate keyPrefix against path traversal
      if (this.params.keyPrefix) {
        if (path.isAbsolute(this.params.keyPrefix)) {
          throw new Error('keyPrefix must not be an absolute path')
        }
        const segments = this.params.keyPrefix.split(path.sep)
        if (segments.includes('..')) {
          throw new Error('keyPrefix must not contain path traversal sequences')
        }
      }

      if (params.preserveSourceDir !== undefined && params.preserveSourceDir !== null) {
        if (typeof params.preserveSourceDir !== 'boolean') {
          throw new Error('preserveSourceDir must be a boolean')
        }
      }
      this.params.preserveSourceDir = params.preserveSourceDir || false

      if (params.acl !== undefined && params.acl !== null) {
        if (typeof params.acl !== 'string') {
          throw new Error('acl must be a string')
        }
      }
      this.params.acl = params.acl

      if (params.s3Client !== undefined && params.s3Client !== null) {
        if (typeof params.s3Client !== 'object') {
          throw new Error('s3Client must be an object')
        }
      }
      this.s3 = params.s3Client || new S3()
    }
  }

  [_awsPutFile] (params, cb) {
    const putParams = {
      Bucket: params.bucket,
      Key: params.remoteFilepath,
      Body: createReadStream(params.localFilepath),
      ContentType: params.mimeType
    }
    if (this.params.acl) {
      putParams.ACL = this.params.acl
    }
    this.s3.putObject(putParams, (err, data) => {
      if (err) {
        return cb(err)
      } else {
        const s3file = `s3://${putParams.Bucket}/${putParams.Key}`
        data.s3file = s3file
        cb(null, data)
      }
    })
  }
}

S3Publisher.prototype.publish = function publish (aDir, cycle, cb) {
  // keeps track of recursion
  let recursionCycle = 0

  // remove trailing slash (/) from aDir
  aDir = aDir.replace(/\/+$/, '')

  // preserve the original path as an object parameter
  if (typeof this.origDir === 'undefined') {
    this.origDir = aDir
  }

  // update the recursion cycle
  if (typeof cycle === 'number') {
    recursionCycle = cycle
  }

  // preserve backwards compatibility for
  // apps that already use s3publisher
  if (typeof cycle === 'function') {
    cb = cycle
  }

  // process dir contents
  readdir(aDir, (err, files) => {
    if (err) {
      return cb(err)
    }

    let pending = files.length
    let called = false

    const finish = (err, data) => {
      if (called) return
      if (err) {
        called = true
        return cb(err)
      }
      if (--pending === 0) {
        called = true
        cb(null, data)
      }
    }

    for (const nextFile of files) {
      const thisFilepath = path.join(aDir, nextFile)
      let nextStats
      try {
        nextStats = lstatSync(thisFilepath)
      } catch (err) {
        finish()
        continue
      }

      // recursively upload files in child directories
      if (nextStats.isDirectory()) {
        this.publish(thisFilepath, recursionCycle + 1, finish)
      }

      // determine content type & upload files
      if (nextStats.isFile()) {
        let mimeType = 'application/octet-stream'
        const fileExt = path.extname(thisFilepath)
        let ftDetected = null

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

          case '.map':
            mimeType = 'text/javascript'
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
            ftDetected = fileTypeFromFile(thisFilepath)
            if (ftDetected !== null && typeof ftDetected !== 'undefined') {
              mimeType = ftDetected.mime
            } else {
              mimeType = 'application/octet-stream'
            }
        }

        // proceed with upload if file extension is not excluded
        if (this.params.exclusions.indexOf(fileExt) === -1) {
          // assemble the s3 file path
          let remoteFilepath

          // preserve source dir tree
          if (this.params.preserveSourceDir) {
            remoteFilepath = path.join(this.params.keyPrefix, aDir, nextFile)

            // handle subdirectory paths
          } else if (cycle > 0) {
            const origPathElems = this.origDir.split(path.sep)
            const dirPathElems = aDir.split(path.sep)
            const outPathElems = []

            for (let i = 0; i < dirPathElems.length; i++) {
              const nextPathElem = dirPathElems[i]

              if (origPathElems.indexOf(nextPathElem) === -1) {
                outPathElems.push(nextPathElem)
              }
            }

            const outPath = outPathElems.join(path.sep)
            remoteFilepath = path.join(this.params.keyPrefix, outPath, nextFile)

            // handle root dir files
          } else {
            remoteFilepath = path.join(this.params.keyPrefix, nextFile)
          }

          // assemble the putObject parameters
          const putParams = {
            bucket: this.params.bucket,
            remoteFilepath,
            localFilepath: thisFilepath,
            mimeType
          }

          this[_awsPutFile](putParams, finish)
        } else {
          finish()
        }
      }

      // skip symlinks and other special files
      if (!nextStats.isDirectory() && !nextStats.isFile()) {
        finish()
      }
    }

    if (pending === 0) cb(null)
  })
}

export default S3Publisher
