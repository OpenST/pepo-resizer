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
  downloadToDisk = require(rootPrefix + '/lib/s3/downloadFile'),
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
   * @param {array} params.segment_urls - Array of segment videos url.
   * @param {object} params.upload_details - basic upload details.
   * @param {string} params.upload_details.bucket - bucket where merged video to be saved.
   * @param {string} params.upload_details.acl - video permissions.
   * @param {string} params.upload_details.region - s3 region where merged video to be saved.
   * @param {string} params.upload_details.file_path - s3 relative path where merged video to be uploaded.
   *
   * @constructor
   */
  constructor(params) {
    const oThis = this;

    oThis.segmentUrls = params.segment_urls;
    oThis.uploadDetails = params.upload_details;

    oThis.uploadFilePath = params.upload_details.file_path;

    oThis.errorFilePath = null;
    oThis.localFilePaths = [];
  }

  async perform() {
    const oThis = this;

    await oThis._downloadFilesToDisk();

    await oThis
      ._mergeAndUpload()
      .then(function(response) {
        if (response.isSuccess()) {
          logger.step('Video merged and uploaded to ', oThis.uploadFilePath);
        } else {
          logger.error('Error while merging: ', response.error);
        }
      })
      .catch(async function(err) {
        logger.error('Exception while merging: ', err);
        return oThis._uploadErrorFile();
      });

    return responseHelper.successWithData({});
  }

  /**
   * Download video segments to disk
   *
   * @returns {Promise<void>}
   * @private
   */
  async _downloadFilesToDisk() {
    const oThis = this;

    logger.info('===Downloading files to disk====');

    let promiseArray = [];

    for (let ind = 0; ind < oThis.segmentUrls.length; ind++) {
      let downloadPath = coreConstants.tempFilePath + oThis.segmentUrls[ind].split('/').pop();
      oThis.localFilePaths.push(downloadPath);
      let params = {
        bucket: oThis.uploadDetails['bucket'],
        filePath: oThis.segmentUrls[ind]
          .split('/')
          .splice(3)
          .join('/'),
        downloadPath: downloadPath
      };
      promiseArray.push(downloadToDisk.perform(params));
    }

    await Promise.all(promiseArray);

    logger.info('===Downloading done====');
  }

  /**
   * Merge videos and upload to S3.
   *
   * @returns {Promise<any>}
   * @private
   */
  _mergeAndUpload() {
    const oThis = this;

    const mergedVideoUploadFilePathPartsArray = oThis.uploadFilePath.split('.');

    // Pop will remove last element.
    mergedVideoUploadFilePathPartsArray.pop();
    // All compress videos are mp4 format.
    mergedVideoUploadFilePathPartsArray.push('mp4');
    oThis.uploadFilePath = mergedVideoUploadFilePathPartsArray.join('.');

    const fileName = coreConstants.tempFilePath + oThis.uploadFilePath.split('/').pop();

    return new Promise(function(onResolve, onReject) {
      let ffmpegObj = new Ffmpeg();

      for (let index = 0; index < oThis.localFilePaths.length; index++) {
        ffmpegObj = ffmpegObj.input(`${oThis.localFilePaths[index]}`);
      }

      ffmpegObj
        .withOptions('-protocol_whitelist file,https,tcp,tls,crypto,async')
        .outputOptions('-movflags faststart')
        .on('start', function(commandLine) {
          logger.info('Spawned FFmpeg with command: ', commandLine);
        })
        .on('end', function() {
          logger.info('Merging completed for file: ', oThis.uploadFilePath);
          let dimensionsResp = null;
          oThis._fetchVideoDimensions(fileName).then(function(response) {
            if (response.isSuccess()) {
              const stats = fs.statSync(fileName);
              dimensionsResp = dimensionsResp || {};
              dimensionsResp.size = stats.size;
              dimensionsResp.width = response.data.width;
              dimensionsResp.height = response.data.height;

              oThis._uploadFile(fileName, contentType, oThis.uploadFilePath, dimensionsResp).then(function(resp) {
                if (resp.isSuccess()) {
                  logger.step('Uploaded successfully to the path: ', oThis.uploadFilePath);

                  fs.unlinkSync(fileName); // Can be removed since env is lambda
                  return onResolve(responseHelper.successWithData({}));
                } else {
                  logger.error('Merge and upload failed: ', resp);

                  oThis._uploadErrorFile().then(function() {
                    fs.unlinkSync(fileName); // Can be removed since env is lambda
                    return onResolve(responseHelper.successWithData({}));
                  });
                }
              });
            }
          });
        })
        .on('error', function(err) {
          oThis._uploadErrorFile().then(function() {
            return onResolve(responseHelper.successWithData({}));
          });

          logger.error('An error occurred: ' + err);
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
        bucket: oThis.uploadDetails['bucket'], // user assets bucket
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

  /**
   * Upload error file
   * @returns {Promise<*|result>}
   * @private
   */
  async _uploadErrorFile() {
    const oThis = this;

    // https://dbvoeb7t6hffk.cloudfront.net/pepo-staging1000/ua/videos/1026-34242f1e719a661b57ea7358d4f9ef62-576w.mp4
    // https://dbvoeb7t6hffk.cloudfront.net/pepo-staging1000/logs/1026-34242f1e719a661b57ea7358d4f9ef62-576w-error.txt
    const contentType = 'text/plain',
      fileArray = oThis.uploadFilePath.split('/'),
      fileName = fileArray.pop(),
      splitFileName = fileName.split('.');

    fileArray.pop();
    fileArray.pop();

    splitFileName.pop();
    splitFileName[0] += '-error';
    splitFileName.push('txt');

    let errorFileName = splitFileName.join('.'),
      pathPrefix = fileArray.join('/'),
      uploadPath = pathPrefix + '/logs/' + errorFileName,
      localFilePath = coreConstants.tempFilePath + '/' + errorFileName;

    fs.closeSync(fs.openSync(localFilePath, 'w')); // Touch file

    return oThis._uploadFile(localFilePath, contentType, uploadPath, null);
  }
}

module.exports = MergeVideoSegments;
