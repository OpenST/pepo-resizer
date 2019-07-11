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

  get PR_INTERNAL_API_SECRET_KEY() {
    return process.env.PR_INTERNAL_API_SECRET_KEY;
  }

  /**
   * S3 AWS config
   */
  get S3_AWS_ACCESS_KEY() {
    return process.env.PR_S3_AWS_ACCESS_KEY;
  }

  get S3_AWS_SECRET_KEY() {
    return process.env.PR_S3_AWS_SECRET_KEY;
  }

  get S3_AWS_REGION() {
    return process.env.PR_S3_AWS_REGION;
  }
}

module.exports = new CoreConstants();
