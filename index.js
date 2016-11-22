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

var default_options = {
  cache: '.cdnUploaderCache'
}

module.exports =
function cdnUploader (remote_folder, cdn_list, options) {
  if (!remote_folder || typeof remote_folder !== 'string') {
    throw new Error('First arg remote_folder is required!')
  }
  if (!cdn_list) throw new Error('Second arg cdn_list is required!')
  if (!Array.isArray(cdn_list)) cdn_list = [ cdn_list ]

  var config = {}
  for (var attrd in default_options) { config[attrd] = default_options[attrd] }
  for (var attr in options) { config[attr] = options[attr] }

  if (config.cache) {   // Prepare cache
    fs.closeSync(fs.openSync(config.cache, 'a+'))
    var cached_content = fs.readFileSync(config.cache, { encoding: 'utf-8' })
    try {
      config.cache_object = JSON.parse(cached_content)
    } catch (e) {
      config.cache_object = {}
    }
  }

  var upload_streams = cdn_list.map(function (cdn_config) {
    cdn_config.remote_folder = cdn_config.remote_folder || remote_folder
    switch (cdn_config.slot && cdn_config.slot.toLowerCase()) {
      case 'upyun':
        return slots.ypyun(cdn_config, config)
      case 'ftp':
      default:
        return slots.ftp(cdn_config, config)
    }
  })

  return through.obj(function (file, encoding, cb) {
    var counter = 0
    var callback = function () { if (!--counter) { cb(null, file) } }
    upload_streams.forEach(function (stream) {
      ++counter
      stream.write(file, callback)
    })
  }, function (cb) {
    var failed_flag = false
    var pending = upload_streams.length
    upload_streams.forEach(function (stream) {
      stream.flush(function () {
        gutil.log(gutil.colors.bold('Host:', stream.host),
                  gutil.colors.green('Uploaded:', stream.statistics.uploaded),
                  gutil.colors.blue('Cache Hit:', stream.statistics.cache_hit),
                  gutil.colors.red('Failed:', stream.statistics.failed))
        failed_flag = failed_flag || stream.statistics.failed
        if (!--pending) {   // True when all CDN done uploading...
          if (config.cache) {
            fs.writeFileSync(config.cache, JSON.stringify(config.cache_object, null, '  '))
          }
          cb(failed_flag ? new Error('Some files corrupted during upload...') : null)
        }
      })
    })
  })
}
