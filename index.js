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

module.exports = function cdnUploader (remoteFolder, ftpList) {
  if (!remoteFolder || typeof remoteFolder !== 'string') throw new Error('remoteFolder required!')
  if (!ftpList) throw new Error('ftps required!')
  if (!Array.isArray(ftpList)) ftpList = [ftpList]

  var uploaderStreams = ftpList.map(function (config) {
    if (!config || !config.host) throw new Error(String(config) + ' error!')
    config.log = config.log || log(config.host)
    return ftp.create(config).dest(config.remoteFolder || remoteFolder)
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
