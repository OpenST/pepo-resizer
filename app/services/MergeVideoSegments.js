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

const mergedVideoSize = '720X1280',
  contentType = 'video/mp4';

/**
 * Class to compress video
 *
 */
class MergeVideoSegments {
  /**
   * constructor
   *
   * @param {Array} params.segment_urls - Array of segment videos url
   * @param {String} params.merged_video_s3_url - url where merged video to be uploaded.
   *
   * @param {Object} params.upload_details - basic upload details
   * @param {String} params.upload_details.bucket - bucket where merged video to be saved
   * @param {String} params.upload_details.acl - video permissions
   * @param {String} params.upload_details.region - s3 region where merged video to be saved
   *
   */
  constructor(params) {
    const oThis = this;
    console.log('input parameters --------------------------------------- ', params);
    oThis.segmentUrls = params.segment_urls;
    oThis.mergedVideoS3Url = params.merged_video_s3_url;
    oThis.uploadDetails = params.upload_details;
  }

  async perform() {
    const oThis = this;

    await oThis
      ._mergeAndUpload()
      .then(function(response) {
        if (response.isSuccess()) {
          logger.step('Video merged and uploaded to ', oThis.mergedVideoS3Url);
        } else {
          logger.error('Error while merging: ', response.error);
        }
      })
      .catch(function(err) {
        logger.error('Exception while merging: ', err);
      });

    return responseHelper.successWithData({});
  }

  /**
   * Compress video to given size and upload it to s3
   *
   * @returns {Promise<any>}
   * @private
   */
  _mergeAndUpload() {
    const oThis = this,
      mergedVideoS3UrlPartsArry = oThis.mergedVideoS3Url.split('.');

    // All compress videos are mp4 format.
    // pop will remove last element
    mergedVideoS3UrlPartsArry.pop();
    mergedVideoS3UrlPartsArry.push('mp4');
    oThis.mergedVideoS3Url = oThis.mergedVideoS3Url.join('.');

    const fileName = coreConstants.tempFilePath + oThis.mergedVideoS3Url.split('/').pop();

    return new Promise(function(onResolve, onReject) {
      let ffmpegObj = new Ffmpeg();

      for (let index = 0; index < oThis.segmentUrls.length; index++) {
        ffmpegObj = ffmpegObj.input(oThis.segmentUrls[index]);
      }

      ffmpegObj
        .outputOptions('-movflags faststart')
        .on('start', function(commandLine) {
          logger.info('Spawned FFmpeg with command: ', commandLine);
        })
        .on('end', function() {
          logger.info('Merging completed for file: ', oThis.mergedVideoS3Url);
          let dimensionsResp = null;
          oThis._fetchVideoDimensions(fileName).then(function(response) {
            if (response.isSuccess()) {
              const stats = fs.statSync(fileName);
              dimensionsResp = dimensionsResp || {};
              dimensionsResp.size = stats.size;
              dimensionsResp.width = response.data.width;
              dimensionsResp.height = response.data.height;
            }
            oThis._uploadFile(fileName, contentType, oThis.mergedVideoS3Url, dimensionsResp).then(function(resp) {
              if (resp.isSuccess()) {
                logger.step('Uploaded successfully to the path ', oThis.mergedVideoS3Url);
              } else {
                logger.error('merged upload Failed ', resp);
                return onResolve(resp);
              }
              fs.unlinkSync(fileName);
              return onResolve(responseHelper.successWithData());
            });
          });
        })
        .on('error', function(err) {
          logger.error('an error happened: ' + err);
        })
        .mergeToFile(fileName);
    });
  }

  /**
   * Fetch dimensions of video
   *
   * @param videoFile
   * @returns {Promise<any>}
   * @private
   */
  _fetchVideoDimensions(videoFile) {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      // Find dimensions of video
      Ffmpeg.ffprobe(videoFile, function(err, data) {
        let dimensions = { width: 0, height: 0 };
        if (data && data.streams && data.streams[0]) {
          dimensions.width = data.streams[0].width;
          dimensions.height = data.streams[0].height;
        }
        onResolve(responseHelper.successWithData(dimensions));
      });
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
  async _uploadFile(videoFile, contentType, filePath, metaData) {
    const oThis = this;

    logger.info('Uploading file: ', filePath);
    await uploadBodyToS3
      .perform({
        metaData: metaData,
        bucket: oThis.uploadDetails['bucket'],
        acl: oThis.uploadDetails['acl'],
        s3Region: oThis.uploadDetails['region'],
        contentType: contentType,
        filePath: filePath,
        body: fs.createReadStream(videoFile)
      })
      .catch(function(err) {
        return responseHelper.error({
          internal_error_identifier: 'a_s_cv_2',
          api_error_identifier: 'upload_failed',
          debug_options: err
        });
      });

    return responseHelper.successWithData({});
  }
}

module.exports = MergeVideoSegments;
