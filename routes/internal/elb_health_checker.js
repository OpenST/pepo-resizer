const express = require('express');

const rootPrefix = '../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/response'),
  apiVersions = require(rootPrefix + '/lib/globalConstant/apiVersions');

const router = express.Router(),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.internal);

/* Elb health checker request */
router.get('/', function(req, res, next) {
  const performer = function() {
    // 200 OK response needed for ELB Health checker
    if (req.headers['user-agent'] === 'ELB-HealthChecker/2.0') {
      return responseHelper.successWithData({}).renderResponse(res, errorConfig);
    } else {
      return responseHelper
        .error({
          internal_error_identifier: 'r_i_e_h_c_1',
          api_error_identifier: 'resource_not_found',
          debug_options: {}
        })
        .renderResponse(res, errorConfig);
    }
  };

  performer();
});

module.exports = router;
