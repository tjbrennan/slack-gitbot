var request = require('request');

module.exports.send = incomingHook;

// incoming hook is needed to include attachments

// slack incoming hook handler
function incomingHook (team, token, body, callback) {
  var uri = 'https://' + team + '.slack.com/services/hooks/incoming-webhook';
  var payload;

  if (body && body.payload) {
    payload = body.payload
  } else if (body) {
    payload = body;
  } else {
    return callback(new Error('No payload for incoming hook.'));
  }

  payload = JSON.stringify(payload);

  // bot must be POSTed as stringified JSON
  request({
    uri : uri,
    method : 'POST',
    form : {
      payload : payload
    },
    qs : {
      token : token
    }
  }, function (error, response, body) {
    if (error) { return callback(error); }

    callback(null, response);
  });
}