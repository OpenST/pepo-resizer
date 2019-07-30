/**
 * Module to define signatures for internal route api parameters.
 *
 * @module config/apiParams/internal/signature
 */

const rootPrefix = '../..',
  apiName = require(rootPrefix + '/lib/globalConstant/apiName');

// Declare variables.
const signature = {
  resizeAndUpload: {
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
  compressVideo: {
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
  }
};

module.exports = signature;
