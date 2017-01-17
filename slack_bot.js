'use strict';

var firebase = require("firebase");
var async = require('async');
var moment = require('moment-timezone');
var escapeStringRegexp = require('escape-string-regexp');
var botkit = require('botkit');
require('dotenv').config();

var today = moment().format().substr(0,10);

var config = {
  apiKey: process.env.FB_API,
  authDomain: process.env.FB_AUTH,
  databaseURL: process.env.FB_URL
};

firebase.initializeApp(config);

var collection = firebase.database().ref(today + 'emoji');

function connectToDb() {
  startBot(collection);
}

function startBot() {

  var botkitController = botkit.slackbot({
    debug: true
  });

  botkitController.spawn({
    token: process.env.TOKEN
  }).startRTM();


  botkitController.on(['reaction_added', 'reaction_removed'], function(bot, event) {
    const stamp = event.item.ts.split('.').join('');

    const reactionCollection = collection.child(stamp);
    const reactors = {};
    reactors[event.user] = true;
    const reactions = {};
    reactions[event.reaction] = {score: 1, reactors}

    reactionCollection.once('value', function(snapshot) {

      if (snapshot.val() === null ) {
        bot.api.channels.history({
          channel: event.item.channel,
          latest: event.item.ts,
          count: 1,
          inclusive: 1
        }, function(err, response) {
          reactionCollection.set({
            id: response.latest.split('.').join(''),
            text: response.messages[0].text,
            user: response.messages[0].user,
            reactions
          });
        });
      } else {
        reactionCollection.child('/reactions/' + event.reaction).transaction(function(emoji) {
          if (emoji) {
            if (emoji.reactors && emoji.reactors[event.user]) {
              emoji.score--;
              emoji.reactors[event.user] = null;
            } else {
              (emoji.score===0) ? emoji.score = 1 : emoji.score++;
              if (!emoji.reactors) {
                emoji.reactors = {};
              }
              emoji.reactors[event.user] = true;
            }
          } else {
            emoji = {score: 1, reactors};
          }
          return emoji;
        });
      }
    });
  });

  botkitController.hears('report',['direct_mention','mention'], function(bot, message) {
    collection.once('value', function(snapshot) {
      var emojiVotes = new Array();
      var emojiReact = new Map();

      for (var val in snapshot.val()) {
        emojiVotes.push(snapshot.val()[val]);
      }
      emojiVotes.forEach(function(elem, i, arr) {
        for (var key in elem.reactions) {
          if (Object.prototype.hasOwnProperty.call(elem.reactions, key)) {
            emojiReact.has(key) ? emojiReact.set(key, emojiReact.get(key) + elem.reactions[key].score) : emojiReact.set(key, elem.reactions[key].score);
          }
        }
      });


      bot.startConversation(message, function(err, convo) {

        convo.say('Happy to report!');

        var emojiReport = Array.from(new Set(emojiReact.keys())).join('*, *');
        convo.say('The emojis used today were: *' + emojiReport + "*.");

        var emojiResult = Array.from(emojiReact);
        emojiResult.sort(function(a, b) {return b[1] - a[1]});

        var i;
        for (i = emojiResult.length - 1; i >= 0; i -= 1) {
          if (emojiResult[i][1] !== emojiResult[0][1]) {
            emojiResult.splice(i, 1);
          }
        }
        if (emojiResult.length === 1) {
          convo.say('The top emoji today was: *' + emojiResult[0][0] + "*.");
        } else {
          convo.say('The top emojis today were: *' + emojiResult.join('* and *').replace(/([,]|\d)/gi, '') + "*.");
        }

        convo.ask('Which emoji would you like a top report on?', function(response, convo) {
          var request = response.text.toLowerCase();
          if (emojiReport.indexOf(request) === -1) {
            convo.say('Sorry, I didn\'t understand that. Is that in the emoji list for today? Let\'s try again.');
            convo.repeat();
            convo.next();
          } else {
            var messages = new Array;
            emojiVotes.forEach(function(elem, i, arr) {
              for (var key in elem.reactions) {
                if (Object.prototype.hasOwnProperty.call(elem.reactions, key)) {
                  if (request === key) {
                    messages.push([elem, elem.reactions[key].score]);
                  }
                }
              }
            });
            messages.sort(function(a, b) {return b[1] - a[1]});
            convo.say('The top ' + request + '\'d message today was: ' + messages[0][0].text + ' by <@' + messages[0][0].user + '>.');
          }
          convo.next();
        });
      });
    });
  });
}

if (!process.env.TOKEN) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

connectToDb();
