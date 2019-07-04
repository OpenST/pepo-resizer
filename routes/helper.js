/**
 * Route helper class.
 *
 * @module routes/helper
 */

const rootPrefix = '..',
  ApiParamsValidator = require(rootPrefix + '/lib/validators/ApiParams'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/response');
/**
 * Class for routes helper.
 *
 * @class RoutesHelper
 */
class RoutesHelper {
  /**
   * Perform
   *
   * @param req
   * @param res
   * @param next
   * @param serviceGetter : in case of getting from ic, this is the getter name. else it is relative path in app root folder
   * @param errorCode
   * @param afterValidationCallback
   * @param onServiceSuccess
   * @param onServiceFailure
   *
   * @return {Promise<T>}
   */
  static perform(
    req,
    res,
    next,
    serviceGetter,
    errorCode,
    afterValidationCallback,
    onServiceSuccess,
    onServiceFailure
  ) {
    const oThis = this,
      errorConfig = basicHelper.fetchErrorConfig(req.decodedParams.apiVersion);

    return oThis
      .asyncPerform(req, res, next, serviceGetter, afterValidationCallback, onServiceSuccess, onServiceFailure)
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)) {
          error.renderResponse(res, errorConfig);
        } else {
          const errorObject = responseHelper.error({
            internal_error_identifier: `unhandled_catch_response:r_h:${errorCode}`,
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
          logger.error(errorCode, 'Something went wrong', error);

          responseHelper
            .error({
              internal_error_identifier: errorCode,
              api_error_identifier: 'unhandled_catch_response',
              debug_options: {}
            })
            .renderResponse(res, errorConfig);
        }
      });
  }

  /**
   * Async Perform
   *
   * @param req
   * @param res
   * @param next
   * @param serviceGetter
   * @param afterValidationCallback
   * @param onServiceSuccess
   * @param onServiceFailure
   *
   * @return {Promise<*>}
   */
  static async asyncPerform(
    req,
    res,
    next,
    serviceGetter,
    afterValidationCallback,
    onServiceSuccess,
    onServiceFailure
  ) {
    req.decodedParams = req.decodedParams || {};

    const oThis = this,
      errorConfig = basicHelper.fetchErrorConfig(req.decodedParams.apiVersion);

    const apiParamsValidatorRsp = await new ApiParamsValidator({
      api_name: req.decodedParams.apiName,
      api_version: req.decodedParams.apiVersion,
      api_params: req.decodedParams
    }).perform();

    req.serviceParams = apiParamsValidatorRsp.data.sanitisedApiParams;

    if (afterValidationCallback) {
      req.serviceParams = await afterValidationCallback(req.serviceParams);
    }

    let handleResponse = async function(response) {
      if (response.isSuccess() && onServiceSuccess) {
        // if required, this function could reformat data as per API version requirements.
        // NOTE: This method should modify response.data
        await onServiceSuccess(response);
      }

      if (response.isFailure() && onServiceFailure) {
        await onServiceFailure(response);
      }

      response.renderResponse(res, errorConfig);
    };

    let Service;

    Service = require(rootPrefix + serviceGetter);

    return new Service(req.serviceParams).perform().then(handleResponse);
  }
}

module.exports = RoutesHelper;
