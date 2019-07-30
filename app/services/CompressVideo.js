// const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const Ffmpeg = require('fluent-ffmpeg');
// Ffmpeg.setFfmpegPath(ffmpegPath);

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/response'),
  apiVersions = require(rootPrefix + '/lib/globalConstant/apiVersions'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  uploadBodyToS3 = require(rootPrefix + '/lib/s3/UploadBody'),
  basicHelper = require(rootPrefix + '/helpers/basic');

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
          console.log(response);
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
      fileName = sizeToCompress + '-' + oThis.sourceUrl.split('/').pop();

    return new Promise(function(onResolve, onReject) {
      let command = new Ffmpeg({
        source: oThis.sourceUrl,
        timeout: 240
      })
        .withOptions(['-c:v libx264', '-preset slow', '-crf 28', '-ss 00:00:00', '-t 00:00:30'])
        .outputOptions('-movflags faststart')
        .size(sizeToCompress)
        .on('start', function(commandLine) {
          logger.info('Compression start for size: ', sizeToCompress);
          logger.info('Spawned FFmpeg with command: ', commandLine);
        })
        .on('codecData', function(data) {
          console.log('Input is ' + data.audio + ' audio with ' + data.video + ' video');
        })
        .on('progress', function(progress) {
          console.log('Processing: ' + Math.floor(progress.frames / 10) + '% done');
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
          logger.info('Uploading file: ', compressionSize.s3_url);
          uploadBodyToS3
            .perform({
              bucket: oThis.uploadDetails['bucket'],
              acl: oThis.uploadDetails['acl'],
              s3Region: oThis.uploadDetails['region'],
              contentType: compressionSize.content_type,
              filePath: compressionSize.file_path,
              body: fs.createReadStream(fileName)
            })
            .then(function(resp) {
              fs.unlinkSync(fileName);
              return onResolve(responseHelper.successWithData({ url: compressionSize.s3_url }));
            })
            .catch(function(err) {
              return onResolve(
                responseHelper.error({
                  internal_error_identifier: 'a_s_cv_2',
                  api_error_identifier: 'upload_failed',
                  debug_options: err
                })
              );
            });
        })
        .saveToFile(fileName);
    });
  }
}

module.exports = CompressVideo;
