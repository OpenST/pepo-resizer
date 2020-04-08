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
    return 'https://s3.amazonaws.com/wa.pepo.com/images/WatermarkVideo.png';
  }
}

module.exports = new VideoCompression();
