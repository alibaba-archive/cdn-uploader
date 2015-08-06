cdn-uploader
====
Upload files to one or more CDN through FTP, it is also a gulp plugin.

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

## Usage
```js
var gulp = require('gulp')
var cdnUploader = require('cdn-uploader')
var CDNs = [{
  host: 'v0.ftp.upyun.com',
  user: 'username/bucket',
  password: process.env.CDN_PWD
}, {
  host: 'ftp.keycdn.com'
  user: 'username'
  password: process.env.CDN_PWD
}]

gulp.task('cdn', function () {
  return gulp.src('dist/static/**')
    .pipe(cdnUploader('/static', CDNs))
})
```

export your ftp password to shell:
```sh
export CDN_PWD='ftppassword'
```

## API

```js
var cdnUploader = require('cdn-uploader')
```

### cdnUploader(remoteFolder, ftpList)
- `remoteFolder`: {String}, FTP folder
- `ftpList`: {Array}, one or more FTP options, detail [vinyl-ftp](https://github.com/morris/vinyl-ftp#ftpcreate-config-)

Return a through stream.

## License

MIT © [Teambition](http://teambition.com)

[npm-url]: https://npmjs.org/package/cdn-uploader
[npm-image]: http://img.shields.io/npm/v/cdn-uploader.svg

[travis-url]: https://travis-ci.org/teambition/cdn-uploader
[travis-image]: http://img.shields.io/travis/teambition/cdn-uploader.svg
