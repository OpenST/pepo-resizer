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
   * @param {Object} events
   *
   * @constructor
   **/
  constructor(events) {
    const oThis = this;
    oThis.events = events;
  }

  /**
   * perform
   *
   * @return promise
   **/
  async perform() {
    const oThis = this;

    let req = {};

    return Promise.resolve(
      routeHelper.perform(req, {}, null, '/app/services/CompressVideo', 'r_it_2', null, null, null)
    );
  }
}

exports.handler = async (event) => {
  console.log('event: ', event);

  let executor = new Executor(event);
  let response = await executor.perform();
  response.statusCode = 200;

  return response;
};
