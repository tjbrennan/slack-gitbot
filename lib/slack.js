var request = require('request');

module.exports.send = incomingHook;

// incoming hook is needed to include attachments

// slack incoming hook handler
function incomingHook (tokens, body, callback) {
  if (!tokens || !body) {
    return callback(new Error('Invalid arguments provided for Slack incoming webhook.'));
  }

  var uri = 'https://hooks.slack.com/services/' + tokens.join('/');
  var payload;

  if (body.payload) {
    payload = body.payload;
  } else {
    payload = body;
  }

  payload = JSON.stringify(payload);

  // bot must be POSTed as stringified JSON
  request({
    uri : uri,
    method : 'POST',
    form : {
      payload : payload
    }
  }, function (error, response, body) {
    if (error) { return callback(error); }

    callback(null, response);
  });
}