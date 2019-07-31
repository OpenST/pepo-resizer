// Lambda Handler

const rootPrefix = '.',
  routeHelper = require(rootPrefix + '/routes/helper');

exports.handler = async (event) => {
  console.log('event: ', event);

  let req = {};

  let resp = await routeHelper.perform(req, {}, null, '/app/services/CompressVideo', 'r_it_2', null, null, null);

  const response = {
    statusCode: 200,
    data: resp
  };

  return response;
};
