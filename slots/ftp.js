'use strict'
/*
 * cdn-uploader ftp-slot
 * https://github.com/teambition/cdn-uploader
 *
 * Copyright (c) 2016 Teambition
 * Licensed under the MIT license.
 */

var ftp = require('vinyl-ftp')
var crypto = require('crypto')
var gutil = require('gulp-util')

var md5sum = function (data) {
  var hash = crypto.createHash('md5')
  hash.update(data)
  return hash.digest('hex')
}

var log = function (host) {
  return function (action, message) {
    if (/UP/.test(action)) gutil.log(host, action.trim(), message)
  }
}

var FTPStream = function (ftp_config, config) {
  // Check and configure ftp_config used in ftp.create()
  if (!ftp_config || !ftp_config.host || !ftp_config.password) {
    throw new Error(String(ftp_config) + ' error!')
  }
  ftp_config.log = ftp_config.log || log(ftp_config.host)

  // Prepare global cache
  var ftp_folder = ftp_config.remote_folder
  this.id = ftp_config.host + ':' + ftp_config.user + ':' + ftp_folder
  if (!(this.id in config.cache_object)) { config.cache_object[this.id] = {} }

  // Define properties
  this.host = ftp_config.host
  this.config = config
  this.ftp_config = ftp_config
  this.statistics = { uploaded: 0, cache_hit: 0, failed: 0 }
  var internal_pipe = this.internal_pipe = []

  // Integrity checker for ftp->conn.filter()
  var integrityChecker = function (file, remote, cb) {
    if (!remote || file.stat.size !== remote.ftp.size) {
      ++this.statistics.failed
      gutil.log(gutil.colors.red(ftp_config.host, ': File', (remote || file).path, 'was corrupted'))
    } else if (config.cache) {
      config.cache_object[this.id][file.path] = { md5: md5sum(file.contents) }
    }
    cb(null, false)
  }.bind(this)

  // Core FTP streams
  var conn = ftp.create(ftp_config)
  this.ftp = {
    conn: conn,
    uploader: conn.dest(ftp_folder),
    checker: conn.filter(ftp_folder, integrityChecker)
  }

  // All data received from uploader will be stored in internal_pipe for checker use
  this.ftp.uploader.on('data', function (chunk) { internal_pipe.push(chunk) })
}

FTPStream.prototype.write = function (file, callback) {
  if (this.config.cache &&
      file.path in this.config.cache_object[this.id] &&
      md5sum(file.contents) === this.config.cache_object[this.id][file.path].md5) {
    // gutil.log('Cache hit: ' + file.relative)
    ++this.statistics.cache_hit
    return callback()
  }
  ++this.statistics.uploaded
  this.ftp.uploader.write(file, callback)
}

FTPStream.prototype.flush = function (callback) {
  // After uploader upload all files, use checker check all files in internal_pipe
  this.ftp.uploader.once('end', function () {
    gutil.log(this.ftp_config.host, 'upload done, starting integrity check...')
    while (this.internal_pipe.length) {
      this.ftp.checker.write(this.internal_pipe.shift())
    }
    this.ftp.checker.resume()
    this.ftp.checker.end()
  }.bind(this))

  this.ftp.checker.once('end', callback)

  this.ftp.uploader.end()
}

module.exports = function (cdn_config, config) {
  return new FTPStream(cdn_config, config)
}
