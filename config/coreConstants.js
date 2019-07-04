class CoreConstants {
  /**
   * Constructor for core constants
   *
   * @constructor
   */
  constructor() {}

  get environment() {
    return process.env.PR_ENVIRONMENT;
  }

  get DEBUG_ENABLED() {
    return process.env.PR_DEBUG_ENABLED;
  }

  get INTERNAL_API_SECRET_KEY() {
    return process.env.INTERNAL_API_SECRET_KEY;
  }
}

module.exports = new CoreConstants();
