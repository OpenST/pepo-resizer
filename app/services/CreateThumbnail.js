const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const fs = require('fs');
const Ffmpeg = require('fluent-ffmpeg');
Ffmpeg.setFfmpegPath(ffmpegPath);
Ffmpeg.setFfprobePath(ffprobePath);

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/response'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  uploadBodyToS3 = require(rootPrefix + '/lib/s3/UploadBody'),
  coreConstants = require(rootPrefix + '/config/coreConstants');

/**
 * Class to compress video
 *
 */
class CompressVideo {
  /**
   * constructor
   *
   * @param {String} params.video_source_url - Source video to used
   *
   * @param {object} params.thumbnail_details
   * @param {object} params.thumbnail_details.file_path - path where thumbnail uploaded
   * @param {object} params.thumbnail_details.content_type - content_type if thumbnail uploaded
   *
   * @param {Object} params.upload_details - basic upload details
   * @param {String} params.upload_details.bucket - bucket where resized video to be saved
   * @param {String} params.upload_details.acl - video permissions
   * @param {String} params.upload_details.region - s3 region where resized video to be saved
   *
   */
  constructor(params) {
    const oThis = this;
    oThis.videoSourceUrl = params.video_source_url;
    oThis.thumbnailDetails = params.thumbnail_details;
    oThis.uploadDetails = params.upload_details;

    oThis.contentType = oThis.thumbnailDetails.content_type || 'image/jpeg';
  }

  async perform() {
    const oThis = this;

    let promises = [];
    let compressPromise = oThis
      ._takeScreenshotAndUpload()
      .then(function(response) {
        if (response.isSuccess()) {
          logger.win('jit gaye...');
        } else {
          logger.error('Error while compressing: ', response.error);
        }
      })
      .catch(function(err) {
        logger.error('Exception while compressing: ', err);
      });

    promises.push(compressPromise);

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    return responseHelper.successWithData({});
  }

  /**
   * Compress video to given size and upload it to s3
   *
   * @returns {Promise<any>}
   * @private
   */
  _takeScreenshotAndUpload() {
    const oThis = this,
      fileName = 'tempTh-alpesh.jpg',
      localFilePath = coreConstants.tempFilePath + fileName;

    return new Promise(function(onResolve, onReject) {
      let command = new Ffmpeg({
        source: oThis.videoSourceUrl,
        timeout: 240
      })
        .on('start', function(commandLine) {
          logger.info('Spawned FFmpeg with command: ', commandLine);
        })
        .on('end', async function() {
          console.log('11screenshots were saved', Date.now());
          await oThis._uploadFile(localFilePath, oThis.contentType, oThis.thumbnailDetails.file_path);
          onResolve(responseHelper.successWithData({}));
        })
        .on('error', function(err) {
          logger.info('Thumbnail creation failed for file: ', oThis.videoSourceUrl, ':::ERROR:::', err);
          return onResolve(
            responseHelper.error({
              internal_error_identifier: 'a_s_ct_1',
              api_error_identifier: 'invalid',
              debug_options: err
            })
          );
        })
        .takeScreenshots(
          {
            count: 1,
            timemarks: ['00:00:01.000'],
            filename: fileName
          },
          coreConstants.tempFilePath
        );
    });
  }

  /**
   * Upload file to S3
   *
   * @param videoFile
   * @param contentType
   * @param filePath
   * @param metaData
   * @returns {Promise<*|result>}
   * @private
   */
  async _uploadFile(file, contentType, filePath) {
    const oThis = this;

    logger.info('Uploading file: ', filePath);
    await uploadBodyToS3
      .perform({
        bucket: oThis.uploadDetails['bucket'],
        acl: oThis.uploadDetails['acl'],
        s3Region: oThis.uploadDetails['region'],
        contentType: contentType,
        filePath: filePath,
        body: fs.createReadStream(file)
      })
      .catch(function(err) {
        return responseHelper.error({
          internal_error_identifier: 'a_s_ct_2',
          api_error_identifier: 'upload_failed',
          debug_options: err
        });
      });

    return responseHelper.successWithData({});
  }
}

module.exports = CompressVideo;
