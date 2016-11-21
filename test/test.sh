#!/usr/bin/env bash -e

SMALL_FILE_SIZE=200K
MEDIUM_FILE_SIZE=3M
HUGE_FILE_SIZE=10M

SMALL_FILE_COUNT=50
MEDIUM_FILE_COUNT=10
HUGE_FILE_COUNT=2

TEST_FILE_TYPE=( 'small' 'medium' 'huge' )

cd "${0%/*}"

mkdir -p upload

function GenFiles() {
  pushd upload >> /dev/null
  rm -rf *

  echo -n "Generating test binary..."
  for test_type in "${TEST_FILE_TYPE[@]}"
  do
    mkdir -p $test_type
    eval "size=\"\${$(echo -n $test_type | tr 'a-z' 'A-Z')_FILE_SIZE}\""
    eval "count=\"\${$(echo -n $test_type | tr 'a-z' 'A-Z')_FILE_COUNT}\""
    if [ "$(uname)" == "Darwin" ]; then
      size=$(echo -n $size | tr 'A-Z' 'a-z')
    fi

    for counter in $(seq 1 $count)
    do
      filename="$test_type"/"$test_type"_"$counter".bin
      # echo "Generating "$filename"..."
      dd if=/dev/urandom of=$filename bs=$size$unit count=1 > /dev/null 2>&1
    done
  done
  echo -e '\033[32mDone\033[39m'
  popd >> /dev/null
}

function ValidateFiles() {
  pushd upload >> /dev/null

  for file in $(find . -type f)
  do
    echo -n 'Validating '$1'/'$file'...'
    filemd5=$(md5sum $file | awk '{print $1}')
    url='https://dn-test.b0.upaiyun.com/'$1'/'$file
    netmd5=$(curl --silent $url | md5sum | awk '{print $1}')
    if [ $filemd5 != $netmd5 ]; then
      echo -e '\033[31mFailed\033[39m'
      echo "URL: "$url
      echo "Local file md5: "$filemd5
      echo "CDN file md5: "$netmd5
      exit 1
    fi
    echo -e '\033[32mOK\033[39m'
  done

  popd >> /dev/null
}

if [[ $1 == 'all' ]] || [[ $1 == 'ftp' ]]; then
  echo "Testing FTP upload test"
  GenFiles
  gulp ftp-upload
  sleep 10
  ValidateFiles 'cdn-uploader-ftp-test'
  echo -e '\033[32mFTP upload test OK\033[39m'
fi

if [[ $1 == 'all' ]] || [[ $1 == 'upyun' ]]; then
  echo "Testing UPYUN HTTP upload test"
  GenFiles
  gulp upyun-upload
  sleep 10
  ValidateFiles 'cdn-uploader-upyun-test'
  echo -e '\033[32mUPYUN HTTP upload test OK\033[39m'
fi

rm -rf upload
[ -f '.cdnUploaderCache' ] && rm .cdnUploaderCache
