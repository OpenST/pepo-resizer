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
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  videoCompressionConstants = require(rootPrefix + '/lib/globalConstant/videoCompression');

const waterMarkFileName = videoCompressionConstants.waterMarkFileName;

/**
 * Class to compress video
 *
 */
class CompressVideo {
  /**
   * constructor
   *
   * @param {String} params.source_url - Source image to be uploaded
   *
   * @param {Object} params.compression_data - Details of compression
   * @param {Object} params.compression_data.width - resize width
   * @param {Object} params.compression_data.height - resize height
   * @param {Object} params.compression_data.file_path - path where resized video to be saved
   * @param {Object} params.compression_data.content_type - content_type if resized video
   * @param {Object} params.compression_data.s3_url - complete path where resized video found
   *
   * @param {Object} params.upload_details - basic upload details
   * @param {String} params.upload_details.bucket - bucket where resized video to be saved
   * @param {String} params.upload_details.acl - video permissions
   * @param {String} params.upload_details.region - s3 region where resized video to be saved
   *
   */
  constructor(params) {
    const oThis = this;
    oThis.sourceUrl = params.source_url;
    oThis.compressionSizes = params.compression_data;
    oThis.uploadDetails = params.upload_details;
    oThis.compressedData = {};
    oThis.compressionErrors = {};
  }

  async perform() {
    const oThis = this;

    let promises = [];
    for (let size in oThis.compressionSizes) {
      let compressPromise = oThis
        ._compressAndUpload(oThis.compressionSizes[size], size)
        .then(function(response) {
          if (response.isSuccess()) {
            oThis.compressedData[size] = response.data;
          } else {
            oThis.compressionErrors[size] = response.error;
            logger.error('Error while compressing: ', response.error);
          }
        })
        .catch(function(err) {
          oThis.compressionErrors[size] = err;
          logger.error('Exception while compressing: ', err);
        });

      promises.push(compressPromise);
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    return responseHelper.successWithData({
      compressedData: oThis.compressedData,
      compressionErrors: oThis.compressionErrors
    });
  }

  /**
   * Compress video to given size and upload it to s3
   *
   * @param compressionSize
   * @param size
   * @returns {Promise<any>}
   * @private
   */
  _compressAndUpload(compressionSize, size) {
    const oThis = this,
      complexFiltersArray = [
        `[0:v]scale=w=${compressionSize.width}:h=trunc(ow/a/2)*2[bg]`,
        { filter: 'overlay', options: { x: 80, y: 80 }, inputs: ['bg', '1:v'] }
      ];

    const filenamePart = oThis.sourceUrl.split('/').pop(),
      filenamePartArr = filenamePart.split('.');

    // All compress videos are mp4 format.
    // pop will remove last element
    filenamePartArr.pop();
    filenamePartArr.push('mp4');

    let sizeToCompress = '';
    let fileName = '';

    return new Promise(function(onResolve, onReject) {
      let command = '';
      if (size === videoCompressionConstants.externalResolution) {
        sizeToCompress = compressionSize.width + 'external?';
        fileName = coreConstants.tempFilePath + sizeToCompress + '-' + filenamePart;
        command = new Ffmpeg({
          source: oThis.sourceUrl,
          timeout: 240
        })
          .input(waterMarkFileName)
          .withOptions(['-c:v libx264', '-preset slow', '-crf 28', '-ss 00:00:00', '-t 00:00:30'])
          .outputOptions('-movflags faststart')
          .complexFilter(complexFiltersArray);
      } else {
        sizeToCompress = compressionSize.width + 'x?';
        fileName = coreConstants.tempFilePath + sizeToCompress + '-' + filenamePart;
        command = new Ffmpeg({
          source: oThis.sourceUrl,
          timeout: 240
        })
          .withOptions(['-c:v libx264', '-preset slow', '-crf 28', '-ss 00:00:00', '-t 00:00:30'])
          .outputOptions('-movflags faststart')
          .size(sizeToCompress);
      }
      command
        .on('start', function(commandLine) {
          logger.info('Spawned FFmpeg with command: ', commandLine);
          // return onResolve(responseHelper.successWithData({}));
        })
        .on('error', function(err) {
          logger.info('Compression failed for size: ', sizeToCompress, err);
          return onResolve(
            responseHelper.error({
              internal_error_identifier: 'a_s_cv_1',
              api_error_identifier: 'invalid',
              debug_options: err
            })
          );
        })
        .on('end', function() {
          logger.info('Compression completed for size: ', sizeToCompress);
          let dimensionsResp = null;
          oThis._fetchVideoDimensions(fileName).then(function(response) {
            if (response.isSuccess()) {
              const stats = fs.statSync(fileName);
              dimensionsResp = dimensionsResp || {};
              dimensionsResp.size = stats.size;
              dimensionsResp.width = response.data.width;
              dimensionsResp.height = response.data.height;
            }
            oThis
              ._uploadFile(fileName, compressionSize.content_type, compressionSize.file_path, dimensionsResp)
              .then(function(resp) {
                if (resp.isSuccess()) {
                  dimensionsResp = dimensionsResp || {};
                  dimensionsResp.url = compressionSize.s3_url;
                } else {
                  return onResolve(resp);
                }
                fs.unlinkSync(fileName);
                return onResolve(responseHelper.successWithData(dimensionsResp));
              });
          });
        })
        .saveToFile(fileName);
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

module.exports = CompressVideo;
