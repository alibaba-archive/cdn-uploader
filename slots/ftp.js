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

var FTPStream = function (ftpConfig, config) {
  // Check and configure ftpConfig used in ftp.create()
  if (!ftpConfig || !ftpConfig.host || !ftpConfig.password) {
    throw new Error(String(ftpConfig) + ' error!')
  }
  ftpConfig.log = ftpConfig.log || log(ftpConfig.host)

  // Prepare global cache
  var ftpFolder = ftpConfig.remote_folder
  this.id = ftpConfig.host + ':' + ftpConfig.user + ':' + ftpFolder
  if (!(this.id in config.cache_object)) { config.cache_object[this.id] = {} }

  // Define properties
  this.host = ftpConfig.host
  this.config = config
  this.ftpConfig = ftpConfig
  this.statistics = { uploaded: 0, cache_hit: 0, failed: 0 }
  var internalPipe = this.internalPipe = []

  // Integrity checker for ftp->conn.filter()
  var integrityChecker = function (file, remote, cb) {
    if (!remote || file.stat.size !== remote.ftp.size) {
      ++this.statistics.failed
      gutil.log(gutil.colors.red(ftpConfig.host, ': File', (remote || file).path, 'was corrupted'))
    } else if (config.cache) {
      config.cache_object[this.id][file.path] = { md5: md5sum(file.contents) }
    }
    cb(null, false)
  }.bind(this)

  // Core FTP streams
  var conn = ftp.create(ftpConfig)
  this.ftp = {
    conn: conn,
    uploader: conn.dest(ftpFolder),
    checker: conn.filter(ftpFolder, integrityChecker)
  }

  // All data received from uploader will be stored in internalPipe for checker use
  this.ftp.uploader.on('data', function (chunk) { internalPipe.push(chunk) })
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
  // After uploader upload all files, use checker check all files in internalPipe
  this.ftp.uploader.once('end', function () {
    gutil.log(this.ftpConfig.host, 'upload done, starting integrity check...')
    while (this.internalPipe.length) {
      this.ftp.checker.write(this.internalPipe.shift())
    }
    this.ftp.checker.resume()
    this.ftp.checker.end()
  }.bind(this))

  this.ftp.checker.once('end', callback)

  this.ftp.uploader.end()
}

module.exports = function (cdnConfig, config) {
  return new FTPStream(cdnConfig, config)
}
