'use strict'
/*
 * cdn-uploader
 * https://github.com/teambition/cdn-uploader
 *
 * Copyright (c) 2015 Teambition
 * Licensed under the MIT license.
 */
var ftp = require('vinyl-ftp')
var through = require('through2')

module.exports = function cdnUploader (remoteFolder, ftps) {
  if (!remoteFolder || typeof remoteFolder !== 'string') throw new Error('remoteFolder required!')
  if (!Array.isArray(ftps)) throw new Error('ftps required!')

  var uploaderStreams = ftps.map(function (options) {
    if (!options || !options.host) throw new Error(String(options) + ' error!')
    options.log = options.log || log(options.host)
    return ftp.create(options).dest(options.remoteFolder || remoteFolder)
  })
  var pending = uploaderStreams.length

  return through.obj(function (file, encoding, next) {
    uploaderStreams.forEach(function (stream) {
      stream.write(file)
    })
    this.push(file)
    return next()
  }, function (callback) {
    uploaderStreams.forEach(function (stream) {
      stream.once('finish', function () {
        if (!--pending) setTimeout(callback, 500)
      })
      stream.end()
    })
  })
}

function log (host) {
  return function (action, message) {
    if (/UP/.test(action)) console.log(host, action.trim(), message)
  }
}
