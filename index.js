'use strict'
/*
 * cdn-uploader
 * https://github.com/teambition/cdn-uploader
 *
 * Copyright (c) 2016 Teambition
 * Licensed under the MIT license.
 */

var fs = require('fs')
var gutil = require('gulp-util')
var through = require('through2')

var slots = {
  ftp: require('./slots/ftp'),
  ypyun: require('./slots/upyun')
}

var defaultOptions = {
  cache: '.cdnUploaderCache'
}

module.exports =
function cdnUploader (remoteFolder, cdnList, options) {
  if (!remoteFolder || typeof remoteFolder !== 'string') {
    throw new Error('First arg remoteFolder is required!')
  }
  if (!cdnList) throw new Error('Second arg cdnList is required!')
  if (!Array.isArray(cdnList)) cdnList = [ cdnList ]

  var config = {}
  for (var attrd in defaultOptions) { config[attrd] = defaultOptions[attrd] }
  for (var attr in options) { config[attr] = options[attr] }

  if (config.cache) {   // Prepare cache
    fs.closeSync(fs.openSync(config.cache, 'a+'))
    var cachedContent = fs.readFileSync(config.cache, { encoding: 'utf-8' })
    try {
      config.cache_object = JSON.parse(cachedContent)
    } catch (e) {
      config.cache_object = {}
    }
  }

  var uploadStreams = cdnList.map(function (cdnConfig) {
    cdnConfig.remote_folder = cdnConfig.remoteFolder || remoteFolder
    switch (cdnConfig.slot && cdnConfig.slot.toLowerCase()) {
      case 'upyun':
        return slots.ypyun(cdnConfig, config)
      case 'ftp':
      default:
        return slots.ftp(cdnConfig, config)
    }
  })

  return through.obj(function (file, encoding, cb) {
    var counter = 0
    var callback = function () { if (!--counter) { cb(null, file) } }
    uploadStreams.forEach(function (stream) {
      ++counter
      stream.write(file, callback)
    })
  }, function (cb) {
    var failedFlag = false
    var pending = uploadStreams.length
    uploadStreams.forEach(function (stream) {
      stream.flush(function () {
        gutil.log(gutil.colors.bold('Host:', stream.host),
                  gutil.colors.green('Uploaded:', stream.statistics.uploaded),
                  gutil.colors.blue('Cache Hit:', stream.statistics.cache_hit),
                  gutil.colors.red('Failed:', stream.statistics.failed))
        failedFlag = failedFlag || stream.statistics.failed
        if (!--pending) {   // True when all CDN done uploading...
          if (config.cache) {
            fs.writeFileSync(config.cache, JSON.stringify(config.cache_object, null, '  '))
          }
          cb(failedFlag ? new Error('Some files corrupted during upload...') : null)
        }
      })
    })
  })
}
