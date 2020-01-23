const express = require('express');

const rootPrefix = '../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/response'),
  apiName = require(rootPrefix + '/lib/globalConstant/apiName'),
  apiVersions = require(rootPrefix + '/lib/globalConstant/apiVersions'),
  routeHelper = require(rootPrefix + '/routes/helper');

const router = express.Router(),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.internal);

// Routes are used for local testing by bringing up a express server.
/* Elb health checker request */
router.post('/image/resize', function(req, res, next) {
  req.decodedParams.apiName = apiName.resizeAndUpload;

  Promise.resolve(routeHelper.perform(req, res, next, '/app/services/ResizeAndUpload', 'r_it_r_1', null, null, null));
});

router.post('/video/compress', function(req, res, next) {
  req.decodedParams.apiName = apiName.compressVideo;

  Promise.resolve(routeHelper.perform(req, res, next, '/app/services/CompressVideo', 'r_it_r_2', null, null, null));
});

router.post('/video/merge-video-segments', function(req, res, next) {
  req.decodedParams.apiName = apiName.mergeVideoSegments;

  Promise.resolve(
    routeHelper.perform(req, res, next, '/app/services/MergeVideoSegments', 'r_it_r_3', null, null, null)
  );
});

router.post('/video/extract-thumbnail', function(req, res, next) {
  req.decodedParams.apiName = apiName.createVideoThumbnail;

  Promise.resolve(routeHelper.perform(req, res, next, '/app/services/CreateThumbnail', 'r_it_r_4', null, null, null));
});

module.exports = router;
