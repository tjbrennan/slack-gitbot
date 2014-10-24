var request = require('request');
var _ = require('lodash');
var async = require('async');
var config = require('./config.json');
var slack = require('./slack');


module.exports = function (req, res, next) {
  var gitbot = config.slack.bot || { name : 'gitbot', icon_emoji : ':octocat:' };

  if (!gitbot.channel) {
    gitbot.channel = req.body.channel_id || '';
  }

  var directive = req.body.text && req.body.text.replace(req.body.trigger_word, '');

  var flags = {
    all : false,
  }

  switch (true) {
    case /all/.test(directive):
      flags.all = true;
      break;

    case /(.\S+)\/(.\S+)/.test(directive):
      // todo: enable ability to query single repo
      flags.single = directive.trim();
      break;

    case /help/.test(directive):
      // todo: send user suggestions

    default:
      break;
  }

  var username = config.github.username;
  var token = config.github.token;
  var teams = config.github.teams;

  async.map(teams, iterator, function (error, results) {
    if (error) { return next(error); }

    // make attachments if incoming hook tokens have been provided
    if (config.slack.incomingWebhook) {
      gitbot.text = '*PULL REQUESTS*';
      gitbot.attachments = [];

      _.each(results, function (group, i) {
        gitbot.attachments.push(makeAttachment(group, flags));
      });

      slack.send(config.slack.incomingWebhook, gitbot, function (error, response) {
        if (error) { return next(error); }

        if (response.statusCode === 200) {
          return res.status(200).end();
        } else {
          next(new Error(response.body));
        }
      });

    } else {
      var tables = [];

      _.each(results, function (group, i) {
        tables.push(makeTable(group));
      });

      tables.join('\n\n');

      gitbot.text = tables;
      return res.status(200).send(gitbot);
    }
  });


  function iterator (team, callback) {
    var teamGroup = {
      teamName : team.name,
      repoOwner : team.owner,
      color : team.color,
      repos : []
    }

    var tasks = [];

    _.each(team.repos, function (repo, i) {
      tasks.push(getPulls(username, token, team.owner, repo, team.contributors));
    });

    async.parallel(tasks, function (error, result) {
      if (error) {
        return callback(error);
      }

      teamGroup.repos = result;

      callback(null, teamGroup);
    });
  }

};

function makeAttachment (group, flags) {
  var attachment = {
    pretext : group.teamName,
    fallback : makeTable(_.sortBy(group.repos, 'teamTotal').reverse()),
    color : group.color || 'good',
    fields : []
  };

  var open = [];
  var closed = [];

  _.each(group.repos, function (repo, i) {
    if (repo.teamTotal) {
      open.push(repo);
    } else {
      closed.push(repo);
    }
  });

  attachment.fields.push({
    short : false,
    value : _(open).sortBy('teamTotal').reverse().map(function (repo) {
              return repo.string;
            }).join('\n')
  });

  if (flags.all) {
    attachment.fields.push({
      short : false,
      value : _(closed).sortBy('total').reverse().map(function (repo) {
                return repo.string;
              }).join('\n')
    });
  }

  return attachment;
}

function makeTable (group) {
  var table = ['*' + group.teamName + ' PRs*'];
  _.each(_.sortBy(group.repos, 'teamTotal').reverse(), function (pr, i) {
    table.push(pr.string);
  });

  table = table.join('\n');

  return table;
}

function formatLine (pr) {
  var col0 = pr.teamTotal + ' (' + pr.total + ')';
  var col1 = '<https://github.com/' + pr.owner + '/' + pr.repo + '/pulls|' + pr.repo + '>';

  return col0 + '\t' + col1;
}

// list and format PRs
function getPulls (username, token, owner, repo, contributors) {
  return function (callback) {
    githubPulls(username, token, owner, repo, function (error, body) {
      var prs = {
        owner : owner,
        repo : repo
      };
      var teamPrs;

      // if a repo does respond correctly, just skip it rather than stopping
      if (error || !body) {
        console.error(error);
        prs.teamTotal = prs.total = 'ERR';

      } else {
        // filter out PRs that belong to contributors
        teamPrs = _.filter(body, function (e, i) {
          return _.contains(contributors, e.user.login);
        });

        prs.teamTotal = teamPrs.length;
        prs.total = body.length;
      }

      prs.string = formatLine(prs);

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


