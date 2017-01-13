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
            id: response.latest,
            text: response.messages[0].text,
            user: response.messages[0].user,
            reactions
          });
        });
      } else {
        reactionCollection.child('/reaction/' + event.reaction).transaction(function(emoji) {
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
      for (var val in snapshot.val()) {
        emojiVotes.push(snapshot.val()[val]);
      }
      emojiVotes.sort(function(a,b) {return (a.score > b.score) ? 1 : ((b.score > a.score) ? -1 : 0);} );
      var topEmoji = emojiVotes[0];
      bot.reply(message,'The top ' + topEmoji.key + '\'d message today so far is ' + topEmoji.text + ' by ' + '<@' + topEmoji.user+ '>!')
    });
  });
}

if (!process.env.TOKEN) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

connectToDb();
