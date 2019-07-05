'use strict';

const fs = require('fs'),
  request = require('request'),
  sharp = require('sharp');

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/response'),
  apiVersions = require(rootPrefix + '/lib/globalConstant/apiVersions'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  HttpRequest = require(rootPrefix + '/lib/HttpRequest'),
  basicHelper = require(rootPrefix + '/helpers/basic');

const errorConfig = basicHelper.fetchErrorConfig(apiVersions.internal);

class ResizeAndUpload {
  constructor(params) {
    const oThis = this;

    oThis.sourceImageUrl = params.source_url;
    oThis.resizeImagesDetails = params.resize_details;
    oThis.timeOut = params.timeout || 10000;

    oThis.responseImageDetails = {};
    oThis.originalImgBlob = null;
  }

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

  async _asyncPerform() {
    const oThis = this;

    await oThis._validateAndSanitizeParams();

    await oThis._downloadSourceImage();

    let path = '/Users/alpeshmodi/Documents/pepo/pepo-resizer/tmp.jpeg';
    fs.writeFile(path, oThis.originalImgBlob, function(err) {
      if (err) {
        console.log('image write error.');
        console.log(err);
      }
    });

    await oThis.resizeAndSaveImages();

    return responseHelper.successWithData(oThis.responseImageDetails);
  }

  async _validateAndSanitizeParams() {
    return responseHelper.successWithData({});
  }

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
              internal_error_identifier: 'l_a_s_rau_5',
              api_error_identifier: 'something_went_wrong',
              debug_options: { error: error }
            })
          );
        } else {
          let statusCode = response.statusCode;
          if (![200, 304].includes(statusCode)) {
            onReject(
              responseHelper.error({
                internal_error_identifier: 'l_a_s_rau_1',
                api_error_identifier: 'something_went_wrong',
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
                internal_error_identifier: 'l_a_s_rau_4',
                api_error_identifier: 'something_went_wrong',
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

  async resizeAndSaveImages() {
    const oThis = this;

    let sharpObj = sharp(oThis.originalImgBlob);
    oThis.originalImageMeta = await sharpObj.metadata();
    console.log(oThis.originalImageMeta);

    for (let imageSize in oThis.resizeImagesDetails) {
      await oThis.resizeAndSave(imageSize);
    }
  }

  resizeAndSave(imageSize) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      let resizeDetails = oThis.resizeImagesDetails[imageSize],
        s3PostUrl = resizeDetails['post_url'],
        s3PostFields = resizeDetails['post_fields'],
        s3PostParams = {},
        resizeImageObj = null;

      if (imageSize == 'original') {
        resizeImageObj = await sharp(oThis.originalImgBlob);
      } else {
        let imageDimentions = imageSize.split('x'),
          width = isNaN(imageDimentions[0]) ? null : Number(imageDimentions[0]),
          height = isNaN(imageDimentions[1]) ? null : Number(imageDimentions[1]);

        console.log('--------------', width, height);
        if ((width && width > oThis.originalImageMeta.width) || (height && height > oThis.originalImageMeta.height)) {
          return onResolve();
        }
        resizeImageObj = await sharp(oThis.originalImgBlob).resize({ width: width, height: height });
      }

      let resizedImageBlob = await resizeImageObj.toBuffer();
      let imageMeta = await sharp(resizedImageBlob).metadata();

      for (let i = 0; i < s3PostFields.length; i++) {
        let postField = s3PostFields[i];
        s3PostParams[postField.key] = postField.value;
      }
      s3PostParams['file'] = resizedImageBlob;
      console.log('-------------s3PostParams---------', s3PostParams);
      let httpResp = await new HttpRequest({
        resource: s3PostUrl,
        header: { 'Content-Type': 'application/form-data' }
      }).post(s3PostParams);

      console.log('-------------httpResp---------');
      console.log(httpResp);
      oThis.responseImageDetails[imageSize] = {
        width: imageMeta.width,
        height: imageMeta.height,
        size: imageMeta.size,
        url: resizeDetails.s3_url
      };

      let path = `/Users/alpeshmodi/Documents/pepo/pepo-resizer/${imageSize}.jpeg`;
      fs.writeFile(path, resizedImageBlob, function(err) {
        if (err) {
          console.log('image write error.');
          console.log(err);
        } else {
          console.log('image writen.');
        }
        return onResolve();
      });
    });
  }
}

module.exports = ResizeAndUpload;
