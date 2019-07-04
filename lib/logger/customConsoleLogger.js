const OSTBase = require('@ostdotcom/base'),
  Logger = OSTBase.Logger;

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/coreConstants');

// Following is to ensure that INFO logs are printed when debug is off.
let loggerLevel;
if (Number(coreConstants.DEBUG_ENABLED) === 1) {
  loggerLevel = Logger.LOG_LEVELS.DEBUG;
} else {
  loggerLevel = Logger.LOG_LEVELS.INFO;
}

module.exports = new Logger('pepo-api', loggerLevel);
