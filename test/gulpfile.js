var cdnUploader = require('../index')
var gulp = require('gulp')

var CDNs = [{
  host: 'v0.ftp.upyun.com',
  api_host: 'v0.api.upyun.com',
  user: process.env.UPYUN_TEST_USER,
  operator: process.env.UPYUN_TEST_OPERATOR,
  bucket: process.env.UPYUN_TEST_BUCKET,
  password: process.env.UPYUN_TEST_PASSWD
}]

var errorExit = function (e) {
  console.log(e)
  exit(1)
}

gulp.task('ftp-upload', function () {
  return gulp.src('upload/**')
    .pipe(cdnUploader('/cdn-uploader-ftp-test/', CDNs))
    .on('error', errorExit)
})

gulp.task('upyun-upload', function () {
  CDNs[0].slot = 'upyun'
  return gulp.src('upload/**')
    .pipe(cdnUploader('/cdn-uploader-upyun-test/', CDNs))
    .on('error', errorExit)
})
