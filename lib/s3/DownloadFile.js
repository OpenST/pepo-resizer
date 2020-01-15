'use strict';

/**
 * This service to download file from s3 to disk
 *
 * @module lib/s3/DownloadFile
 */
const AWS = require('aws-sdk'),
  instanceMap = {},
  fs = require('fs');

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/response'),
  coreConstants = require(rootPrefix + '/config/coreConstants');

class DownloadFile {
  /**
   * @constructor
   */
  constructor() {}

  /**
   * perform
   *
   * @param {Object} params
   * @param {String} params.bucket - S3 bucket
   * @param {String} params.filePath - S3 path and filename
   * @param {String} params.downloadPath - local path and filename
   *
   * @return {Promise}
   *
   */
  perform(params) {
    const oThis = this;

    let bucket = params.bucket,
      key = params.filePath,
      downloadPath = params.downloadPath;

    fs.closeSync(fs.openSync(downloadPath, 'w'));
    const file = fs.createWriteStream(downloadPath);

    const AWSS3 = oThis._getS3Instance(coreConstants.AWS_REGION);
    const getParams = { Bucket: bucket, Key: key };

    return new Promise(function(onResolve, onReject) {
      AWSS3.getObject(getParams, function(err, res) {
        if (err == null) {
          file.write(res.Body, function(error) {
            if (error) {
              const errObj = responseHelper.error({
                internal_error_identifier: 'l_s3_df_1',
                api_error_identifier: 'something_went_wrong',
                debug_options: { err: error }
              });

              onReject(errObj);
            }

            file.end();
            onResolve(responseHelper.successWithData({}));
          });
        } else {
          const errObj = responseHelper.error({
            internal_error_identifier: 'l_s3_df_2',
            api_error_identifier: 'something_went_wrong',
            debug_options: ''
          });

          onReject(errObj);
        }
      });
    });
  }

  _getS3Instance(config) {
    const oThis = this,
      region = config.s3_region || coreConstants.S3_AWS_REGION,
      accessKey = config.s3_access_key || coreConstants.S3_AWS_ACCESS_KEY,
      secretKey = config.s3_secret_key || coreConstants.S3_AWS_SECRET_KEY,
      instanceKey = `${accessKey}-${region}`;

    if (!instanceMap[instanceKey]) {
      instanceMap[instanceKey] = new AWS.S3({
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
        region: region
      });
    }

    return instanceMap[instanceKey];
  }
}

module.exports = new DownloadFile();
