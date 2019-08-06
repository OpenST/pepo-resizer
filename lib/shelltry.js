const shell = require('shelljs');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

class Shelltry {
  async perform(arr) {
    const oThis = this;

    let failedFor = [];
    for (let index in arr) {
      let item = arr[index];
      let distFolderPath = '/Users/pankaj/simpleTokenWorkspace/pepo-resizer/tempFolder/temp' + index;
      if (shell.exec('bash create-vod-hls.sh ' + item + ' ' + distFolderPath).code !== 0) {
        shell.echo('Error: Video Failed');
        failedFor.push(item);
        continue;
      }

      await oThis._uploadFile(distFolderPath, item);
    }
  }

  async _uploadFile(distFolderPath, item) {
    let uploadDetails = {
      bucket: 'uassets.stagingpepo.com',
      acl: 'public-read',
      region: 'us-east-1'
    };
    let AWSS3 = new AWS.S3({
      accessKeyId: process.env.PR_S3_AWS_ACCESS_KEY,
      secretAccessKey: process.env.PR_S3_AWS_SECRET_KEY,
      region: uploadDetails.region
    });
    return new Promise(function(onResolve, onReject) {
      console.log('Uploading started');
      fs.readdir(distFolderPath, async function(err, files) {
        let uploadPromises = [];
        let a = item
          .split('/')
          .pop()
          .split('-');
        let filePath = a[0] + '-' + a[1];
        for (const fileName of files) {
          let uploadParams = {
            Bucket: uploadDetails.bucket,
            Key: 'pepo-staging1000/ua/videos/' + filePath + '-hls-new/' + fileName,
            ACL: uploadDetails.acl,
            Body: fs.createReadStream(distFolderPath + '/' + fileName),
            CacheControl: 'max-age=18000000',
            ContentType: ''
          };
          if (path.extname(fileName) == '.m3u8') {
            uploadParams.ContentType = 'audio/mpegurl';
          }
          uploadPromises.push(AWSS3.putObject(uploadParams).promise());
        }
        await Promise.all(uploadPromises);
        console.log('Uploading completed for full folder');
        onResolve();
      });
    });
  }
}

module.exports = new Shelltry();
