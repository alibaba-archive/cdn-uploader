interface FtpOptions {
  slot?: 'ftp'
  host: string
  user: string
  password: string
}

interface UPYUNOptions {
  slot: 'upyun'
  api_host: string
  operator: string
  bucket: string
  password: string
}

type CDNOptions = FtpOptions | UPYUNOptions

declare var uploader: (remoteFolder: string, cdnList: CDNOptions[]) => NodeJS.ReadWriteStream

export = uploader
