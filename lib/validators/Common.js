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
   * Is var null ?
   *
   * @param {Object/String/Integer/Boolean} variable
   *
   * @return {Boolean}
   */
  static isVarNull(variable) {
    return typeof variable === 'undefined' || variable == null;
  }

}

module.exports = CommonValidator;
