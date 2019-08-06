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

    // let resource = oThis.event.resource;
    // let queryParams = oThis.event.queryStringParameters;
    // let body = oThis.event.body;
    // let httpMethod = oThis.event.httpMethod;
    //

    // console.log('Event: ', oThis.event);
    // console.log('body: ', oThis.body);
    // if (body && typeof body === 'string') {
    //   body = JSON.parse(body);
    // }

    let actionParams = {
      req: {
        decodedParams: {}
      }
    };
    Object.assign(actionParams.req.decodedParams, oThis.event, { apiVersion: apiVersions.internal });

    if (oThis.event.resource === 'resize-image') {
      actionParams.serviceToUse = '/app/services/resizeAndUpload';
      actionParams.errorCode = 'r_it_1';
      actionParams.req.decodedParams.apiName = apiName.resizeAndUpload;
    } else if (oThis.event.resource === 'compress-video') {
      actionParams.serviceToUse = '/app/services/CompressVideo';
      actionParams.errorCode = 'r_it_2';
      actionParams.req.decodedParams.apiName = apiName.compressVideo;
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
