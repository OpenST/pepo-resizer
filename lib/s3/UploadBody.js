'use strict';

/**
 * This service upload body to S3 bucket
 *
 * @module lib/s3/UploadBody
 */
const AWS = require('aws-sdk'),
  instanceMap = {},
  cacheControlSeconds = 2 * 365 * 24 * 60 * 60; // cache for 2 years

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/coreConstants');

class UploadBody {
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
   * @param {String} params.body - file content
   * @param {String} params.contentType - file content type
   * @param {String} [params.acl] - file s3 acl
   *
   * @return {Promise}
   *
   */
  perform(params) {
    const oThis = this,
      acl = params.acl || 'public_read',
      AWSS3 = oThis._getS3Instance({
        s3_region: params.s3Region
      });

    const uploadParams = {
      Bucket: params.bucket,
      Key: params.filePath,
      ACL: acl,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: 'max-age=' + cacheControlSeconds
    };

    if (params.metaData) {
      uploadParams.Metadata = { width: params.metaData.width.toString(), height: params.metaData.height.toString() };

      if (params.metaData.duration) {
        uploadParams.Metadata.duration = params.metaData.duration.toString();
      }
    }

    return AWSS3.putObject(uploadParams).promise();
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

module.exports = new UploadBody();
