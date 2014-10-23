var request = require('request');
var _ = require('lodash');
var async = require('async');
var table = require('text-table');
var config = require('./config.json');
var slack = require('./slack');


exports.gitbot = function (req, res, next) {
  var gitbot = {
    username : 'gitbot',
    icon_emoji : ':octocat:'
  };

  var username = config.github.username;
  var token = config.github.token;
  var teams = config.github.teams;

  buildList(username, token, teams, function (error, lists) {
    if (error) { return next(error); }

    res.status(200).send(lists);
    // slack.send(slackTeam, slackToken, gitbot, function (error, response) {
    //   if (error) { return next(error); }

    //   if (response.statusCode !== 200) {
    //     res.status(response.statusCode).end();
    //   }

    //   next();
    // });
  });
};

function buildList (username, token, teams, callback) {
  var tasks = [];

  // iterate over teams
  _.each(teams, function (team, i) {
    var owner = team.owner;
    var teamName = team.name;
    var repos = team.repos;
    var contributors = team.contributors

    // queue up repo requests
    _.each(repos, function (repo, j) {
      tasks.push(getPulls(username, token, teamName, owner, repo, contributors));
    });
  });

  async.parallel(tasks, function (error, result) {
    if (error) { return callback(error); }

    var tables = [];

    // divide results into team groups and sort by open PRs
    var groups = _(result).sortBy('teamTotal').groupBy(function (pr) {
      return pr.teamName;
    }).value();


    for (var name in groups) {
      if (!groups.hasOwnProperty(name)) { continue; }
      tables.push(makeTable(name, groups[name].reverse()));
    }
    tables = tables.join('\n\n');

    callback(null, tables);
  });


  function makeTable (teamName, pullRequests) {
    var tableArr = [ ['*' + teamName + '* PRs'] ];

    _.each(pullRequests, function (pr, i) {
      var col0 = pr.teamTotal + ' (' + pr.total + ')';
      var col1 = '<https://github.com/' + pr.owner + '/' + pr.repo + '/pulls|' + pr.repo + '>'

      // bold open team PR count, and add two spaces
      // since formatting characters will be removed
      if (pr.teamTotal > 0) {
        col0 = '*' + col0 + '*  ';
      }

      tableArr.push([
        col0, col1
      ]);
    });

    var t = table(tableArr, {
      align: ['l', 'l'],
      hsep: ' '
    });

    return t;
  }
}

// list and format PRs
function getPulls (username, token, teamName, owner, repo, contributors) {
  return function (callback) {
    githubPulls(username, token, owner, repo, function (error, body) {
      var prs = {
        teamName : teamName,
        owner : owner,
        repo : repo
      };
      var teamPrs;

      // if a repo does respond correctly, just skip it rather than stopping
      if (error || !body) {
        console.error(error);
        prs.total = 'ERROR';

      } else {
        // filter out PRs that belong to contributors
        teamPrs = _.filter(body, function (e, i) {
          return _.contains(contributors, e.user.login);
        });

        pr.teamTotal = teamPrs.length;
        pr.total = body.length;
      }

      callback(null, prs);
    });
  };
}


// github api call -- retrieves list of pull requests from given repo
function githubPulls (username, token, owner, repo, callback) {
  request({
    uri : 'https://api.github.com/repos/' + owner + '/' + repo + '/pulls',
    method : 'GET',
    json : true,
    headers : {
      'User-Agent' : username,
      'Authorization' : 'token ' + token
    }
  }, function (error, response, body) {
    if (error) {
      return callback(error);
    } else if (response.statusCode !== 200) {
      return callback(new Error(body));
    }

    callback(null, body);
  });
}


