'use strict'
/*
 * cdn-uploader upyun-slot
 * https://github.com/teambition/cdn-uploader
 *
 * Copyright (c) 2016 Teambition
 * Licensed under the MIT license.
 */

var http = require('http')
var path = require('path')
var crypto = require('crypto')
var gutil = require('gulp-util')

var md5sum = function (data) {
  var hash = crypto.createHash('md5')
  hash.update(data)
  return hash.digest('hex')
}

var signature = function (options, cdn_config) {
  var md5_password = md5sum(cdn_config.password)
  var payload = [ options.method, encodeURI(options.path), options.headers.Date,
                  options.headers['Content-Length'], md5_password ].join('&')
  return 'UpYun ' + cdn_config.operator + ':' + md5sum(payload)
}

var UPYunStream = function (cdn_config, config) {
  // Check and reconfigure cdn_config
  if (!cdn_config || !(cdn_config.host || cdn_config.api_host) ||
      !cdn_config.operator || !cdn_config.password || !cdn_config.bucket) {
    throw new Error(String(cdn_config) + ' error!')
  }
  cdn_config.api_host = cdn_config.api_host || cdn_config.host

  // Define properties
  this.host = cdn_config.api_host
  this.config = config
  this.cdn_config = cdn_config
  this.statistics = { uploaded: 0, cache_hit: 0, failed: 0 }
  this.id = cdn_config.api_host + ':' + cdn_config.operator + ':' +
            cdn_config.bucket + ':' + cdn_config.remote_folder

  // Prepare cache
  if (!(this.id in config.cache_object)) { config.cache_object[this.id] = {} }
}

UPYunStream.prototype.write = function (file, callback) {
  // Ignore directory for http upload
  if (file.isDirectory()) { return callback() }

  // Skip upload when hit cache
  if (this.config.cache &&
      file.path in this.config.cache_object[this.id] &&
      md5sum(file.contents) === this.config.cache_object[this.id][file.path].md5) {
    // gutil.log('Cache hit: ' + file.relative)
    ++this.statistics.cache_hit
    return callback()
  }

  // HTTP request options
  var options = {
    hostname: this.cdn_config.api_host,
    method: 'PUT',
    path: path.normalize('/' + this.cdn_config.bucket + '/' + this.cdn_config.remote_folder + '/' + file.relative),
    headers: {
      'Date': new Date().toUTCString(),
      'Content-MD5': md5sum(file.contents),
      'Content-Length': Buffer.byteLength(file.contents).toString()
    }
  }
  options.headers.Authorization = signature(options, this.cdn_config)

  // Start http request
  var req = http.request(options, function (res) {
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

module.exports = function (cdn_config, config) {
  return new UPYunStream(cdn_config, config)
}
