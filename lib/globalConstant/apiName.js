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
class ApiName {
  get resizeAndUpload() {
    return 'resizeAndUpload';
  }

  get compressVideo() {
    return 'compressVideo';
  }

  get createVideoThumbnail() {
    return 'createVideoThumbnail';
  }
}

module.exports = new ApiName();
