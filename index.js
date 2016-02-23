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
var through = require('through2')

var defaultOptions = {
  cache: '.cdnUploaderCache'
}

module.exports = function cdnUploader (remoteFolder, ftpList, options) {
  if (!remoteFolder || typeof remoteFolder !== 'string') throw new Error('remoteFolder required!')
  if (!ftpList) throw new Error('ftps required!')
  if (!Array.isArray(ftpList)) ftpList = [ftpList]

  var config = Object.assign({}, defaultOptions, options)

  if (config.cache) {   // Prepare cache
    var cacheFd = fs.openSync(config.cache, 'a+')
    var cachedConent = fs.readFileSync(cacheFd, { encoding: 'utf-8' })
    try {
      var cachedObject = JSON.parse(cachedConent)
    } catch (e) {
      var cachedObject = {}
    }
  }

  var uploaderStreams = ftpList.map(function (ftpConfig) {
    if (!ftpConfig || !ftpConfig.host) throw new Error(String(ftpConfig) + ' error!')
    ftpConfig.log = ftpConfig.log || log(ftpConfig.host)

    var integrityChecker = function (file, remote, cb) {
      if (!remote ||
          file.stat.mtime > remote.ftp.date ||
          file.stat.size !== remote.ftp.size) {
        checker.failed = true
        console.log('File', file.path, 'was corrupted')
      } else if (config.cache) {
        cachedObject[file.path] = { mtime: file.stat.mtime, size: file.stat.size }
      }
      cb(null, false)
    }

    var conn = ftp.create(ftpConfig)
    var ftpFolder = ftpConfig.remoteFolder || remoteFolder
    var checker = conn.filter(ftpFolder, integrityChecker)
    var uploader = conn.dest(ftpFolder)

    uploader.on('data', function (chunk) { checker.write(chunk) })
    uploader.once('finish', function () { checker.end() })

    return { uploader: uploader, checker: checker, uploaded: 0 }
  })

  var pending = uploaderStreams.length

  return through.obj(function (file, encoding, cb) {
    uploaderStreams.forEach(function (stream) {
      if (config.cache &&
          file.path in cachedObject &&
          file.stat.size === cachedObject[file.path].size &&
          new Date(file.stat.mtime).valueOf() ===
          new Date(cachedObject[file.path].mtime).valueOf()) {
        console.log('Cache hit: ' + file.path)
        return
      }
      ++stream.uploaded
      stream.uploader.write(file)
    })
    cb(null, file)
  }, function (cb) {
    var failed = false
    uploaderStreams.forEach(function (stream) {
      stream.checker.once('finish', function () {
        if (stream.checker.failed) { failed = true }
        if (!--pending) {
          if (config.cache) {
            fs.writeFileSync(cacheFd, JSON.stringify(cachedObject, null, '  '))
            fs.closeSync(cacheFd)
          }
          setTimeout(function () {
            cb(failed ? new Error('File corrupted during upload, please try again') : null)
          }, 500)
        }
      })
      stream.uploader.on('data', function () {
        if(!--stream.uploaded) { stream.uploader.end() }
      })
    })
  })
}

function log (host) {
  return function (action, message) {
    if (/UP/.test(action)) console.log(host, action.trim(), message)
  }
}
