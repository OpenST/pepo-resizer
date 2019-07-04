/**
 * Standard response formatter
 *
 * @module lib/formatter/response
 */
const OSTBase = require('@ostdotcom/base'),
  responseHelper = new OSTBase.responseHelper({
    module_name: 'imageResizer'
  });

module.exports = responseHelper;
