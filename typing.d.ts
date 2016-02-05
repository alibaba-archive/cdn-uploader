interface FtpOptions {
  host: string
  user: string
  password: string
}

declare var uploader: (remoteFolder: string, ftpList: FtpOptions[]) => NodeJS.ReadWriteStream

export = uploader
