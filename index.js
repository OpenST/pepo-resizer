'use strict';

/**
 * Entry point for AWS Lambda Service
 *
 * @module index
 */

const rootPrefix = '.',
  apiName = require(rootPrefix + '/lib/globalConstant/apiName'),
  apiVersions = require(rootPrefix + '/lib/globalConstant/apiVersions'),
  ApiParamsValidator = require(rootPrefix + '/lib/validators/ApiParams');

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

    let resource = oThis.event.resource;
    let queryParams = oThis.event.queryStringParameters;
    let body = oThis.event.body;
    let httpMethod = oThis.event.httpMethod;

    let serviceToUse;
    if (resource === '/compress-video') {
      serviceToUse = '/app/services/CompressVideo';
    } else if (resource === '/resize-image') {
      serviceToUse = '/app/services/resizeAndUpload';
    }

    if (body && typeof body === 'string') {
      body = JSON.parse(body);
    }

    return {
      params: queryParams,
      serviceToUse: serviceToUse,
      body: body
    };
  }

  async handleResponse(response) {
    if (response.isFailure() && onServiceFailure) {
      await onServiceFailure(response);
    }

    response.renderResponse(res, errorConfig);
  }

  /**
   * perform
   *
   * @return promise
   **/
  async perform() {
    const oThis = this;

    let reqData = oThis.getResourceAndParamsForAction();

    const apiParamsValidatorRsp = await new ApiParamsValidator({
      api_name: apiName.compressVideo,
      api_version: apiVersions.internal,
      api_params: reqData.body
    }).perform();

    let serviceParams = apiParamsValidatorRsp.data.sanitisedApiParams;

    console.log('serviceParams: ', serviceParams);

    let Service = require(rootPrefix + reqData.serviceToUse);

    return new Service(serviceParams).perform();

    // return reqData;
  }
}

exports.handler = async (event) => {
  console.log('event: ', event);

  let executor = new Executor(event);
  let responseBody = await executor.perform();

  console.log('response: ', response);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(responseBody)
  };
};
