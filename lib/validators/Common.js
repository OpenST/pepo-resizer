const BigNumber = require('bignumber.js');

const rootPrefix = '../..',
  basicHelper = require(rootPrefix + '/helpers/basic');

/**
 * CommonValidator
 * @constructor
 */
class CommonValidator {
  constructor() {}

  /**
   * Is string valid ?
   *
   * @return {Boolean}
   */
  static validateString(variable) {
    return typeof variable === 'string';
  }

  /**
   * Check if variable is object
   *
   * @param {object} variable
   *
   * @return {boolean}
   */
  static validateObject(variable) {
    if (CommonValidator.isVarNull(variable) || typeof variable !== 'object') {
      return false;
    }

    for (let prop in variable) {
      try {
        if (Object.prototype.hasOwnProperty.call(variable, prop)) return true;
      } catch (error) {
        return false;
      }
    }

    return false;
  }

  /**
   *
   * Is var integer ?
   *
   * @return {Boolean}
   *
   */
  static validateInteger(variable) {
    try {
      let variableInBn = new BigNumber(String(variable));
      // Variable is integer and its length is less than 37 digits
      if (variableInBn.isInteger() && variableInBn.toString(10).length <= 37) {
        return true;
      }
    } catch (e) {}

    return false;
  }

  /**
   * Is integer non zero
   *
   * @param {String/Number} variable
   *
   * @return {boolean}
   */
  static validateNonZeroInteger(variable) {
    const oThis = this;

    if (oThis.validateInteger(variable)) {
      return Number(variable) > 0;
    }
    return false;
  }

  /**
   * Is var null ?
   *
   * @param {Object/String/Integer/Boolean} variable
   *
   * @return {Boolean}
   */
  static isVarNull(variable) {
    return typeof variable === 'undefined' || variable == null;
  }

  /**
   * Validate API validateTransactionStatusArray
   *
   * @param {array<string>} array
   *
   * @returns {boolean}
   */
  static validateStringArray(array) {
    if (Array.isArray(array)) {
      for (let index = 0; index < array.length; index++) {
        if (!CommonValidator.validateString(array[index])) {
          return false;
        }
      }

      return true;
    }

    return false;
  }
}

module.exports = CommonValidator;
