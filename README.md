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
  slot: 'upyun',
  api_host: 'v0.api.upyun.com',
  operator: 'operator',
  bucket: 'bucket',
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

### cdnUploader(remoteFolder, cdnList, options)
- `remoteFolder`: {String}, FTP folder
- `cdnList`: {Array}, one or more CDN options, could be [FTP options](https://github.com/morris/vinyl-ftp#ftpcreate-config-) or plugin specific options
- `options`: {Object}, options of cdn-uploader, keys include:
  - `cache`: Cached file list path, set `false` to disable cache mechanism, default to `.cdnUploaderCache`

Return a through stream.

## Plugins
You can set `slot` in CDN options to enable the corresponding plugins.
FTP plugin is used as default plugin when `slot` is not set or not valid.

### UPYUN
UPYUN plugin use the [UPYUN HTTP REST API](http://docs.upyun.com/api/rest_api/) to upload files.

You should set `slot: upyun` in CDN options to enable this plugin.
Besides, field `api_host`, `operator`, `bucket` and `password` are also required.

## License

MIT © [Teambition](http://teambition.com)

[npm-url]: https://npmjs.org/package/cdn-uploader
[npm-image]: http://img.shields.io/npm/v/cdn-uploader.svg

[travis-url]: https://travis-ci.org/teambition/cdn-uploader
[travis-image]: http://img.shields.io/travis/teambition/cdn-uploader.svg
