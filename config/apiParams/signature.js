/**
 * Module to define signatures for internal route api parameters.
 *
 * @module config/apiParams/internal/signature
 */

const rootPrefix = '../..',
  apiName = require(rootPrefix + '/lib/globalConstant/apiName');

// Declare variables.
const signature = {
  [apiName.resizeAndUpload]: {
    mandatory: [
      {
        parameter: 'source_url',
        validatorMethods: ['validateString']
      },
      {
        parameter: 'upload_details',
        validatorMethods: ['validateObject']
      },
      {
        parameter: 'resize_details',
        validatorMethods: ['validateObject']
      }
    ],
    optional: [
      {
        parameter: 'image_quality',
        validatorMethods: ['validateNonZeroInteger']
      }
    ]
  },
  [apiName.compressVideo]: {
    mandatory: [
      {
        parameter: 'source_url',
        validatorMethods: ['validateString']
      },
      {
        parameter: 'upload_details',
        validatorMethods: ['validateObject']
      },
      {
        parameter: 'compression_data',
        validatorMethods: ['validateObject']
      }
    ],
    optional: []
  },
  [apiName.createVideoThumbnail]: {
    mandatory: [
      {
        parameter: 'video_source_url',
        validatorMethods: ['validateString']
      },
      {
        parameter: 'upload_details',
        validatorMethods: ['validateObject']
      },
      {
        parameter: 'thumbnail_details',
        validatorMethods: ['validateObject']
      }
    ],
    optional: []
  }
};

module.exports = signature;
