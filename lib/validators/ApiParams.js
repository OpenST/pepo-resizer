const rootPrefix = '../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/response'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  internalSignature = require(rootPrefix + '/config/apiParams/signature'),
  CommonValidators = require(rootPrefix + '/lib/validators/Common'),
  apiVersions = require(rootPrefix + '/lib/globalConstant/apiVersions');

class ApiParamsValidator {
  /**
   *
   * @constructor
   *
   * @param {Object} params
   * @param {boolean} params.api_name - human readable name of API Fired - used for finding the mandatory and optional params
   * @param {boolean} params.api_version - API Version
   * @param {Object} params.api_params - object containing Params sent in request
   */
  constructor(params) {
    const oThis = this;

    oThis.apiName = params.api_name;
    oThis.apiVersion = params.api_version;
    oThis.apiParams = params.api_params;

    oThis.paramsConfig = null;
    oThis.sanitisedApiParams = {};
    oThis.paramErrors = [];
    oThis.dynamicErrorConfig = {};
  }

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  async perform() {
    const oThis = this;

    await oThis._fetchParamsConfig();

    await oThis._validateMandatoryParams();

    await oThis._checkOptionalParams();

    return oThis._responseData();
  }

  /**
   * Fetch Params Config for an API
   *
   * @private
   *
   * Sets oThis.paramsConfig
   *
   * @return {Promise<result>}
   */
  async _fetchParamsConfig() {
    const oThis = this;

    let versionConfig = {};

    if (oThis.apiVersion === apiVersions.internal) {
      versionConfig = internalSignature;
    } else {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_v_ap_2',
          api_error_identifier: 'invalid_api_version',
          debug_options: {}
        })
      );
    }

    oThis.paramsConfig = versionConfig[oThis.apiName];

    if (!oThis.paramsConfig) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_v_ap_3',
          api_error_identifier: 'invalid_api_name',
          debug_options: {}
        })
      );
    }

    return responseHelper.successWithData({});
  }

  /**
   * Fetch Config for an API
   *
   * @private
   *
   * @return {result}
   */
  async _validateMandatoryParams() {
    const oThis = this,
      mandatoryKeys = oThis.paramsConfig.mandatory || [];

    for (let index = 0; index < mandatoryKeys.length; index++) {
      let whiteListedKeyConfig = mandatoryKeys[index],
        whiteListedKeyName = whiteListedKeyConfig.parameter;

      if (
        Object.prototype.hasOwnProperty.call(oThis.apiParams, whiteListedKeyName) &&
        !CommonValidators.isVarNull(oThis.apiParams[whiteListedKeyName])
      ) {
        // Validate value as per method name passed in config
        oThis._validateValue({ keyName: whiteListedKeyName, keyConfig: whiteListedKeyConfig });
      } else {
        oThis.paramErrors.push(`missing_${whiteListedKeyName}`);
        oThis.dynamicErrorConfig[`missing_${whiteListedKeyName}`] = {
          parameter: whiteListedKeyName,
          code: 'missing',
          message:
            'Required parameter ' +
            whiteListedKeyName +
            ' is missing. Please inspect for what is being sent, rectify and re-submit.'
        };
      }
    }
    return Promise.resolve(responseHelper.successWithData({}));
  }

  /**
   * Check optional params
   *
   * @private
   *
   * @return {result}
   */
  async _checkOptionalParams() {
    const oThis = this,
      optionalKeysConfig = oThis.paramsConfig.optional || [];

    for (let i = 0; i < optionalKeysConfig.length; i++) {
      let optionalKeyConfig = optionalKeysConfig[i],
        optionalKeyName = optionalKeyConfig.parameter;

      if (
        Object.prototype.hasOwnProperty.call(oThis.apiParams, optionalKeyName) &&
        !CommonValidators.isVarNull(oThis.apiParams[optionalKeyName])
      ) {
        //validate value as per method name passed in config
        oThis._validateValue({ keyName: optionalKeyName, keyConfig: optionalKeyConfig });
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }

  /**
   * Validate param value with the validator config
   *
   * @private
   *
   * @return {result}
   */
  async _validateValue(params) {
    const oThis = this,
      keyName = params.keyName,
      keyConfig = params.keyConfig;

    //validate value as per method name passed in config
    let valueToValidate = oThis.apiParams[keyName],
      validatorMethodNames = keyConfig.validatorMethods,
      isValueValid = null;

    for (let i = 0; i < validatorMethodNames.length; i++) {
      const validatorMethodName = validatorMethodNames[i],
        validatorMethodInstance = CommonValidators[validatorMethodName];

      isValueValid = null;

      if (!validatorMethodInstance) {
        isValueValid = false;
        logger.error(`${validatorMethodName} does not exist.`);
      } else {
        isValueValid = validatorMethodInstance.apply(CommonValidators, [valueToValidate]);
      }

      if (!isValueValid) {
        oThis.paramErrors.push(`invalid_${keyName}`);
        oThis.dynamicErrorConfig[`invalid_${keyName}`] = {
          parameter: keyName,
          code: 'invalid',
          message:
            'Invalid parameter ' +
            keyName +
            '.  Please ensure the input is well formed or visit https://dev.ost.com/platform/docs/api for details on accepted datatypes for API parameters.'
        };
        return false;
      }
    }

    oThis.sanitisedApiParams[keyName] = valueToValidate;
    return true;
  }

  /**
   * Api Params Validation Response
   *
   * @private
   *
   * @return {result}
   */
  async _responseData() {
    const oThis = this;

    if (oThis.paramErrors.length > 0) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 'v_ap_rd_1',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: oThis.paramErrors,
          error_config: basicHelper.fetchErrorConfig(oThis.apiVersion, oThis.dynamicErrorConfig),
          debug_options: {}
        })
      );
    } else {
      return responseHelper.successWithData({ sanitisedApiParams: oThis.sanitisedApiParams });
    }
  }
}

module.exports = ApiParamsValidator;
