'use strict';

/**
 * Entry point for AWS Lambda Service
 *
 * @module index
 */

const rootPrefix = '.',
  apiName = require(rootPrefix + '/lib/globalConstant/apiName'),
  apiVersions = require(rootPrefix + '/lib/globalConstant/apiVersions'),
  ApiParamsValidator = require(rootPrefix + '/lib/validators/ApiParams'),
  sanitizer = require(rootPrefix + '/helpers/sanitizer'),
  routeHelper = require(rootPrefix + '/routes/helper');
class Executor {
  /**
   * @param {Object} event
   *
   * @constructor
   **/
  constructor(event) {
    const oThis = this;
    oThis.event = event;
  }

  /**
   * Get Resource and Parameters for the resource
   *
   * @return Object
   **/
  getResourceAndParamsForAction() {
    const oThis = this;

    let actionParams = {
      req: {
        decodedParams: {}
      }
    };
    actionParams.req.decodedParams = sanitizer.sanitizeParams(oThis.event);
    Object.assign(actionParams.req.decodedParams, { apiVersion: apiVersions.internal });

    if (oThis.event.resource === 'resize-image') {
      actionParams.serviceToUse = '/app/services/ResizeAndUpload';
      actionParams.errorCode = 'r_it_1';
      actionParams.req.decodedParams.apiName = apiName.resizeAndUpload;
    } else if (oThis.event.resource === 'compress-video') {
      actionParams.serviceToUse = '/app/services/CompressVideo';
      actionParams.errorCode = 'r_it_2';
      actionParams.req.decodedParams.apiName = apiName.compressVideo;
    } else if (oThis.event.resource === 'extract-video-thumbnail') {
      actionParams.serviceToUse = '/app/services/CreateThumbnail';
      actionParams.errorCode = 'r_it_3';
      actionParams.req.decodedParams.apiName = apiName.createVideoThumbnail;
    }

    return actionParams;
  }

  /**
   * perform
   *
   * @return promise
   **/
  async perform() {
    const oThis = this;

    let actionParams = oThis.getResourceAndParamsForAction();

    console.log('actionParams: ', actionParams);

    return routeHelper.perform(
      actionParams.req,
      { isLambda: true },
      null,
      actionParams.serviceToUse,
      actionParams.errorCode,
      null,
      null,
      null
    );
  }
}

exports.handler = async (event) => {
  console.log('event: ', event);

  let executor = new Executor(event);
  let responseBody = await executor.perform();

  // console.log('responseBody: ', responseBody);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(responseBody)
  };
};
