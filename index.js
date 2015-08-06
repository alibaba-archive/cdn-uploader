'use strict'
/*
 * cdn-uploader
 * https://github.com/teambition/cdn-uploader
 *
 * Copyright (c) 2015 Teambition
 * Licensed under the MIT license.
 */
var ftp = require('vinyl-ftp')
var merge2 = require('merge2')
var through = require('through2')

module.exports = function cdnUploader (remoteFolder, ftps) {
  if (!remoteFolder || typeof remoteFolder !== 'string') throw new Error('remoteFolder required!')
  if (!Array.isArray(ftps)) throw new Error('ftps required!')

  var uploaderStreams = ftps.map(function (options) {
    if (!options || !options.host) throw new Error(String(options) + ' error!')
    return ftp.create(options).dest(options.remoteFolder || remoteFolder)
  })

  return through.obj(function (file, encoding, next) {
    if (!file.isNull()) {
      uploaderStreams.forEach(function (stream) {
        stream.push(file)
      })
      this.push(file)
    }
    return next()
  }, function (callback) {
    merge2(uploaderStreams).on('end', callback)
    uploaderStreams.forEach(function (stream) {
      stream.end()
    })
  })
}
