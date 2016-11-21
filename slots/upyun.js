'use strict'
/*
 * cdn-uploader upyun-slot
 * https://github.com/teambition/cdn-uploader
 *
 * Copyright (c) 2016 Teambition
 * Licensed under the MIT license.
 */

var path = require('path')
var https = require('https')
var crypto = require('crypto')
var gutil = require('gulp-util')

var md5sum = function (data) {
  var hash = crypto.createHash('md5')
  hash.update(data)
  return hash.digest('hex')
}

var signature = function (options, cdnConfig) {
  var md5Password = md5sum(cdnConfig.password)
  var payload = [ options.method, encodeURI(options.path), options.headers.Date,
                  options.headers['Content-Length'], md5Password ].join('&')
  return 'UpYun ' + cdnConfig.operator + ':' + md5sum(payload)
}

var UPYunStream = function (cdnConfig, config) {
  // Check and reconfigure cdnConfig
  if (!cdnConfig || !(cdnConfig.host || cdnConfig.api_host) ||
      !cdnConfig.operator || !cdnConfig.password || !cdnConfig.bucket) {
    throw new Error(String(cdnConfig) + ' error!')
  }
  cdnConfig.api_host = cdnConfig.api_host || cdnConfig.host

  // Define properties
  this.host = cdnConfig.api_host
  this.config = config
  this.cdnConfig = cdnConfig
  this.statistics = { uploaded: 0, cache_hit: 0, failed: 0 }
  this.id = cdnConfig.api_host + ':' + cdnConfig.operator + ':' +
            cdnConfig.bucket + ':' + cdnConfig.remote_folder

  // Prepare cache
  if (!(this.id in config.cache_object)) { config.cache_object[this.id] = {} }
}

UPYunStream.prototype.write = function (file, callback) {
  // Ignore directory for https upload
  if (file.isDirectory()) { return callback() }

  // Skip upload when hit cache
  if (this.config.cache &&
      file.path in this.config.cache_object[this.id] &&
      md5sum(file.contents) === this.config.cache_object[this.id][file.path].md5) {
    // gutil.log('Cache hit: ' + file.relative)
    ++this.statistics.cache_hit
    return callback()
  }

  // HTTPs request options
  var options = {
    hostname: this.cdnConfig.api_host,
    method: 'PUT',
    path: path.normalize('/' + this.cdnConfig.bucket + '/' + this.cdnConfig.remote_folder + '/' + file.relative),
    headers: {
      'Date': new Date().toUTCString(),
      'Content-MD5': md5sum(file.contents),
      'Content-Length': Buffer.byteLength(file.contents).toString()
    }
  }
  options.headers.Authorization = signature(options, this.cdnConfig)

  // Start https request
  var req = https.request(options, function (res) {
    if (res.statusCode === 200) {
      ++this.statistics.uploaded
      this.config.cache_object[this.id][file.path] = { md5: md5sum(file.contents) }
    } else {
      ++this.statistics.failed
      gutil.log(gutil.colors.red(this.host, file.relative, 'upload failed, http error:', res.statusCode))
    }
    res.on('end', callback)
    res.resume()
  }.bind(this))

  req.on('error', function () {
    ++this.statistics.failed
    callback()
  }.bind(this))

  gutil.log(this.host, 'Uploading', gutil.colors.bold(file.relative))
  req.write(file.contents)
  req.end()
}

UPYunStream.prototype.flush = function (callback) {
  callback()
}

module.exports = function (cdnConfig, config) {
  return new UPYunStream(cdnConfig, config)
}
