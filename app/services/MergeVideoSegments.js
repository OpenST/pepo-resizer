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

const contentType = 'video/mp4';

/**
 * Class to merge video segments.
 *
 * @class MergeVideoSegments
 */
class MergeVideoSegments {
  /**
   * Constructor to merge video segments.
   *
   * @param {array} params.segment_urls - Array of segment videos url
   * @param {string} params.merged_video_s3_url - url where merged video to be uploaded.
   * @param {object} params.upload_details - basic upload details
   * @param {string} params.upload_details.bucket - bucket where merged video to be saved
   * @param {string} params.upload_details.acl - video permissions
   * @param {string} params.upload_details.region - s3 region where merged video to be saved
   *
   * @constructor
   */
  constructor(params) {
    const oThis = this;

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
   * Merge videos and upload to S3.
   *
   * @returns {Promise<any>}
   * @private
   */
  _mergeAndUpload() {
    const oThis = this;

    const mergedVideoS3UrlPartsArray = oThis.mergedVideoS3Url.split('.');

    // Pop will remove last element.
    mergedVideoS3UrlPartsArray.pop();
    // All compress videos are mp4 format.
    mergedVideoS3UrlPartsArray.push('mp4');
    oThis.mergedVideoS3Url = mergedVideoS3UrlPartsArray.join('.');

    const fileName = coreConstants.tempFilePath + oThis.mergedVideoS3Url.split('/').pop();

    return new Promise(function(onResolve, onReject) {
      let ffmpegObj = new Ffmpeg();

      for (let index = 0; index < oThis.segmentUrls.length; index++) {
        ffmpegObj = ffmpegObj.input(`async:${oThis.segmentUrls[index]}`);
      }

      ffmpegObj
        .outputOptions('-movflags faststart')
        .withOptions('-protocol_whitelist file,https,tcp,tls,crypto,async')
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
