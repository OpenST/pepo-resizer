const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const fs = require('fs');
const Ffmpeg = require('fluent-ffmpeg');
Ffmpeg.setFfmpegPath(ffmpegPath);
Ffmpeg.setFfprobePath(ffprobePath);

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/response'),
  apiVersions = require(rootPrefix + '/lib/globalConstant/apiVersions'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  uploadBodyToS3 = require(rootPrefix + '/lib/s3/UploadBody'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  basicHelper = require(rootPrefix + '/helpers/basic');

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
   * @param {Object} params.compression_data.file_path - path where resized image to be saved
   * @param {Object} params.compression_data.content_type - content_type if resized image
   * @param {Object} params.compression_data.s3_url - complete path where resized image found
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
        ._compressAndUpload(oThis.compressionSizes[size])
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

  // async trial(){
  //   const oThis = this;
  //
  //   let outStream  = fs.createWriteStream('/Users/pankaj/Downloads/resized.mp4');
  //
  //   let command = new Ffmpeg({source: oThis.sourceUrl,
  //     timeout: 120})
  //     .withOptions(
  //       ['-c:v libx264', '-preset slow',
  //         '-crf 28',
  //         '-ss 00:00:00', '-t 00:00:30']
  //     ).outputOptions("-movflags faststart")
  //     .format('mp4')
  //     .size('540x960')
  //     .on('start', function(commandLine) {
  //       console.log('Spawned FFmpeg with command: ' + commandLine);
  //     }).on('codecData', function(data) {
  //       console.log('Input is ' + data.audio + ' audio with ' + data.video + ' video');
  //     }).on('progress', function(progress) {
  //       console.log('Processing: ' + (Math.floor(progress.frames/10)) + '% done');
  //     }).on('error', function(err) {
  //       console.log('Cannot process video: ' + err.message);
  //     }).on('end', function() {
  //       console.log('Processing finished successfully');
  //     }).on('data', function(chunk) {
  //     console.log('ffmpeg just wrote ' + chunk.length + ' bytes');
  //     }).saveToFile("/Users/pankaj/Downloads/resized.mp4");
  //
  //   // let ffstream = command.pipe(outStream, { end: true });
  //   // ffstream.on('data', function(chunk) {
  //   //   console.log('ffmpeg just wrote ' + chunk.length + ' bytes');
  //   // });
  //   // command.saveToFile("/Users/pankaj/Downloads/resized.mp4");
  // }

  /**
   * Compress video to given size and upload it to s3
   *
   * @param compressionSize
   * @returns {Promise<any>}
   * @private
   */
  _compressAndUpload(compressionSize) {
    const oThis = this,
      sizeToCompress = compressionSize.width + 'x?',
      fileName = coreConstants.videoTempPath + sizeToCompress + '-' + oThis.sourceUrl.split('/').pop();

    return new Promise(function(onResolve, onReject) {
      let command = new Ffmpeg({
        source: oThis.sourceUrl,
        timeout: 240
      })
        .withOptions(['-c:v libx264', '-preset slow', '-crf 28', '-ss 00:00:00', '-t 00:00:30'])
        .outputOptions('-movflags faststart')
        .size(sizeToCompress)
        .on('start', function(commandLine) {
          logger.info('Spawned FFmpeg with command: ', commandLine);
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
          let promises = [];
          // upload file
          promises.push(oThis._uploadFile(fileName, compressionSize.content_type, compressionSize.file_path));
          // fetch dimensions
          promises.push(oThis._fetchVideoDimensions(fileName));

          Promise.all(promises).then(function(responses) {
            let resp = {};
            if (responses[0].isSuccess()) {
              resp.url = compressionSize.s3_url;
            } else {
              return onResolve(responses[0]);
            }
            if (responses[1].isSuccess()) {
              const stats = fs.statSync(fileName);
              resp.size = stats.size;
              resp.width = responses[1].data.width;
              resp.height = responses[1].data.height;
            }
            fs.unlinkSync(fileName);
            return onResolve(responseHelper.successWithData(resp));
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
   * Upload File to S3
   *
   * @param videoFile
   * @param contentType
   * @param filePath
   * @returns {Promise<result|T|*>}
   * @private
   */
  async _uploadFile(videoFile, contentType, filePath) {
    const oThis = this;

    logger.info('Uploading file: ', filePath);
    await uploadBodyToS3
      .perform({
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
