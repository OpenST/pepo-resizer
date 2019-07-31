'use strict';

/**
 * Entry point for AWS Lambda Service
 *
 * @module index
 */

const rootPrefix = '.',
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

    let resource = oThis.event.resource;
    let queryParams = oThis.event.queryStringParameters;

    let serviceToUse;
    if (resource === '/compress-video') {
      serviceToUse = '/app/services/CompressVideo';
    }

    console.log('queryParams: ', queryParams);
    console.log('serviceToUse: ', serviceToUse);

    return {
      params: queryParams,
      serviceToUse: serviceToUse
    };
  }

  /**
   * perform
   *
   * @return promise
   **/
  async perform() {
    const oThis = this;

    let reqData = oThis.getResourceAndParamsForAction();

    console.log('reqData: ', reqData);

    return reqData;
  }
}

exports.handler = async (event) => {
  console.log('event: ', event);

  let executor = new Executor(event);
  let response = await executor.perform();

  console.log('response: ', response);

  return {
    statusCode: 200,
    headers: {
      'x-pepo-header': 't123'
    },
    body: JSON.stringify(response)
  };
};
