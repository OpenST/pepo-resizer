'use strict';

const fs = require('fs'),
  request = require('request'),
  sharp = require('sharp');

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/response'),
  apiVersions = require(rootPrefix + '/lib/globalConstant/apiVersions'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  uploadBodyToS3 = require(rootPrefix + '/lib/s3/UploadBody'),
  basicHelper = require(rootPrefix + '/helpers/basic');

const errorConfig = basicHelper.fetchErrorConfig(apiVersions.internal);

class ResizeAndUpload {
  /**
   * constructor
   *
   * @param {String} params.source_url - Source image to be uploaded
   *
   * @param {Object} params.resize_details - Details of resize
   * @param {Object} params.resize_details.width - resize width
   * @param {Object} params.resize_details.height - resize height
   * @param {Object} params.resize_details.file_path - path where resized image to be saved
   * @param {Object} params.resize_details.content_type - content_type if resized image
   * @param {Object} params.resize_details.s3_url - complete path where resized image found
   *
   * @param {String} params.upload_details - basic upload details
   * @param {String} params.upload_details.bucket - bucket where resized image to be saved
   * @param {String} params.upload_details.acl - image permissions
   * @param {String} params.upload_details.region - s3 region where resized image to be saved
   *
   */
  constructor(params) {
    const oThis = this;

    oThis.sourceImageUrl = params.source_url;
    oThis.resizeImagesDetails = params.resize_details;
    oThis.uploadDetails = params.upload_details;
    oThis.timeOut = params.timeout || 10000;

    oThis.responseImageDetails = {};
    oThis.originalImgBlob = null;
  }

  /**
   * perform
   *
   * @returns {Promise}
   */
  perform() {
    const oThis = this;

    return oThis._asyncPerform().catch(function(err) {
      if (responseHelper.isCustomResult(err)) {
        return err;
      }
      logger.error(' In catch block of services/Base.js', err);
      //TODO: error mail
      return responseHelper.error({
        internal_error_identifier: 'a_s_rau_1',
        api_error_identifier: 'something_went_wrong',
        debug_options: { error: err.toString() },
        error_config: errorConfig
      });
    });
  }

  /**
   * async perform
   *
   * @returns {Promise}
   * @private
   *
   */
  async _asyncPerform() {
    const oThis = this;

    await oThis._validateAndSanitizeParams();

    await oThis._downloadSourceImage();

    // let path = '/Users/alpeshmodi/Documents/pepo/pepo-resizer/tmp.jpeg';
    // fs.writeFile(path, oThis.originalImgBlob, function(err) {
    //   if (err) {
    //     console.log('image write error.');
    //     console.log(err);
    //   }
    // });

    await oThis._resizeAndSaveImages();

    return responseHelper.successWithData(oThis.responseImageDetails);
  }

  /**
   *
   * @returns {Promise}
   * @private
   */
  async _validateAndSanitizeParams() {
    return responseHelper.successWithData({});
  }

  /**
   * Download image from source.
   *
   * @returns {Promise}
   * @private
   */
  async _downloadSourceImage() {
    const oThis = this;

    logger.info('[%s] Start downloading image: from', oThis.sourceImageUrl);
    return new Promise(async function(onResolve, onReject) {
      let options = {
        url: oThis.sourceImageUrl,
        headers: {
          //"User-Agent": config.getHttpUserAgent(),
          Accept: 'image/*'
        },
        maxRedirects: 3,
        timeout: oThis.timeOut,
        encoding: null
      };

      request(options, function(error, response, body) {
        if (error) {
          return onReject(
            responseHelper.error({
              internal_error_identifier: 'a_s_rau_2',
              api_error_identifier: 'source_image_invalid',
              debug_options: { error: error }
            })
          );
        } else {
          let statusCode = response.statusCode;
          if (![200, 304].includes(statusCode)) {
            onReject(
              responseHelper.error({
                internal_error_identifier: 'a_s_rau_3',
                api_error_identifier: 'source_image_invalid',
                debug_options: { httpStatusCode: statusCode, errorData: response }
              })
            );
          }

          let contentType = response.headers['content-type'];
          if (
            !contentType ||
            !contentType.match(/^image\/(jpeg|pjpeg|jpg|png|bmp|gif|x-windows-bmp|x-icon|tiff|x-tiff|webp)/i)
          ) {
            onReject(
              responseHelper.error({
                internal_error_identifier: 'a_s_rau_4',
                api_error_identifier: 'source_image_invalid',
                debug_options: { httpStatusCode: statusCode, errorData: response }
              })
            );
          }

          oThis.originalImgBlob = body;

          return onResolve(responseHelper.successWithData({}));
        }
      });
    });
  }

  /**
   * resize and save images
   *
   * @returns {Promise}
   * @private
   */
  async _resizeAndSaveImages() {
    const oThis = this,
      promiseArray = [];

    let sharpObj = sharp(oThis.originalImgBlob);
    oThis.originalImageMeta = await sharpObj.metadata();

    for (let key in oThis.resizeImagesDetails) {
      promiseArray.push(
        oThis._resizeAndSave(key, oThis.resizeImagesDetails[key]).catch(function(err) {
          console.log('image resizeAndSave error............');
          console.log(err);
        })
      );
    }
    return Promise.all(promiseArray);
  }

  /**
   * resize and save images
   *
   * @returns {Promise}
   * @private
   */
  _resizeAndSave(imgKey, resizeDetails) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      let s3FilePath = resizeDetails['file_path'],
        contentType = resizeDetails['content_type'],
        width = isNaN(resizeDetails['width']) ? null : Number(resizeDetails['width']),
        height = isNaN(resizeDetails['height']) ? null : Number(resizeDetails['height']),
        resizeImageObj = null;

      if (!contentType || !s3FilePath) {
        return onResolve();
      }
      if (!width && !height) {
        resizeImageObj = await sharp(oThis.originalImgBlob);
      } else {
        if ((width && width > oThis.originalImageMeta.width) || (height && height > oThis.originalImageMeta.height)) {
          return onResolve();
        }
        resizeImageObj = await sharp(oThis.originalImgBlob).resize({ width: width, height: height, fit: 'inside' });
      }

      let resizedImageBlob = await resizeImageObj.toBuffer();
      let imageMeta = await sharp(resizedImageBlob).metadata();

      await uploadBodyToS3.perform({
        bucket: oThis.uploadDetails['bucket'],
        acl: oThis.uploadDetails['acl'],
        s3Region: oThis.uploadDetails['region'],
        contentType: contentType,
        filePath: s3FilePath,
        body: resizedImageBlob
      });

      oThis.responseImageDetails[imgKey] = {
        width: imageMeta.width,
        height: imageMeta.height,
        size: imageMeta.size,
        url: resizeDetails.s3_url
      };

      // let path = `/Users/alpeshmodi/Documents/pepo/pepo-resizer/${imgKey}.jpeg`;
      // fs.writeFile(path, resizedImageBlob, function(err) {
      //   if (err) {
      //     console.log('image write error.');
      //     console.log(err);
      //   } else {
      //     console.log('image writen.');
      //   }
      // });
      return onResolve();
    });
  }
}

module.exports = ResizeAndUpload;
