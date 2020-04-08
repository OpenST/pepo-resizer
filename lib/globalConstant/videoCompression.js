/**
 * Module to get API names.
 *
 * @module lib/globalConstant/apiName
 */

/**
 * Class to get API names.
 *
 * @class ApiName
 */
class VideoCompression {
  get externalResolution() {
    return 'external';
  }

  get waterMarkFileName() {
    return 'https://d3attjoi5jlede.cloudfront.net/images/video-watermark.png';
  }
}

module.exports = new VideoCompression();
