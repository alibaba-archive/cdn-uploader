'use strict'
/*
 * cdn-uploader
 * https://github.com/teambition/cdn-uploader
 *
 * Copyright (c) 2016 Teambition
 * Licensed under the MIT license.
 */

var fs = require('fs')
var ftp = require('vinyl-ftp')
var crypto = require('crypto')
var through = require('through2')

var defaultOptions = {
  cache: '.cdnUploaderCache'
}

var md5 = function (data) {
  var hash = crypto.createHash('md5')
  hash.update(data)
  return hash.digest('hex')
}

module.exports = function cdnUploader (remoteFolder, ftpList, options) {
  if (!remoteFolder || typeof remoteFolder !== 'string') throw new Error('remoteFolder required!')
  if (!ftpList) throw new Error('ftps required!')
  if (!Array.isArray(ftpList)) ftpList = [ftpList]

  var config = {}
  for (var attrd in defaultOptions) { config[attrd] = defaultOptions[attrd] }
  for (var attr in options) { config[attr] = options[attr] }

  var cachedObject = null
  if (config.cache) {   // Prepare cache
    fs.closeSync(fs.openSync(config.cache, 'a+'))
    var cachedConent = fs.readFileSync(config.cache, { encoding: 'utf-8' })
    try {
      cachedObject = JSON.parse(cachedConent)
    } catch (e) {
      cachedObject = {}
    }
  }

  var uploaderStreams = ftpList.map(function (ftpConfig) {
    if (!ftpConfig || !ftpConfig.host) throw new Error(String(ftpConfig) + ' error!')
    ftpConfig.log = ftpConfig.log || log(ftpConfig.host)

    var ftpFolder = ftpConfig.remoteFolder || remoteFolder
    var id = ftpConfig.host + '>' + ftpConfig.user + '<' + ftpFolder
    if (!(id in cachedObject)) { cachedObject[id] = {} }

    var integrityChecker = function (file, remote, cb) {
      if (!remote || file.stat.size !== remote.ftp.size) {
        ++stream.failed
        console.log(ftpConfig.host + ':', 'File', (remote || file).path, 'was corrupted')
      } else if (config.cache) {
        cachedObject[id][file.path] = { md5: md5(file.contents) }
      }
      cb(null, false)
    }

    var conn = ftp.create(ftpConfig)
    var uploader = conn.dest(ftpFolder)
    var checker = conn.filter(ftpFolder, integrityChecker)
    var stream = { uploader: uploader, checker: checker, buffer: [], id: id,
                   failed: 0, uploaded: 0, hit: 0, host: ftpConfig.host }

    uploader.on('data', function (chunk) { stream.buffer.push(chunk) })

    return stream
  })

  var pending = uploaderStreams.length

  return through.obj(function (file, encoding, cb) {
    uploaderStreams.forEach(function (stream) {
      if (config.cache &&
          file.path in cachedObject[stream.id] &&
          md5(file.contents) === cachedObject[stream.id][file.path].md5) {
        // console.log('Cache hit: ' + file.path)
        ++stream.hit
        return
      }
      ++stream.uploaded
      stream.uploader.write(file)
    })
    cb(null, file)
  }, function (cb) {
    uploaderStreams.forEach(function (stream) {
      stream.uploader.once('end', function () {
        setTimeout(function () {
          while (stream.buffer.length) {
            stream.checker.write(stream.buffer.shift())
          }
          stream.checker.resume()
          stream.checker.end()
        }, 2000)
      })

      var failed = false
      stream.checker.once('end', function () {
        console.log('Host:', stream.host, 'Uploaded:', stream.uploaded,
                    'Cache Hit:', stream.hit, 'Failed:', stream.failed)
        if (stream.failed) { failed = true }
        if (!--pending) {
          if (config.cache) {
            fs.writeFileSync(config.cache, JSON.stringify(cachedObject, null, '  '))
          }
          cb(failed ? new Error('Some file corrupted during upload') : null)
        }
      })
      stream.uploader.end()
    })
  })
}

function log (host) {
  return function (action, message) {
    if (/UP/.test(action)) console.log(host, action.trim(), message)
  }
}
