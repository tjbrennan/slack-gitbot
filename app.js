var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var gitbot = require('./lib/gitbot');


var app = express();
var port = process.env.PORT || 3000;
var args = process.argv;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended : true
}));


// ensure only authorized slack users may see results
// app.use(function (req, res, next) {
//   next();
// });

// store args
// app.use(function (req, res, next) {
//   res.locals.slackTeam = args[2];
//   res.locals.slackTtoken = args[3];
//   next();
// })

// error handler
app.use(function (err, req, res, next) {
  if (typeof err === 'string') {
    return res.status(200).send(err);
  } else {
    console.error(err);
    return res.status(400).send(err);
  }
});


app.post('/gitbot', gitbot, function (req, res) { res.status(200).end(); });


app.listen(port, function () {
  console.log('Gitbot listening on port ' + port);
});