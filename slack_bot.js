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
    reactions[event.reaction] = {id: event.reaction, score: 1, reactors}

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
            emoji = {id: event.reaction, score: 1, reactors};
          }
          return emoji;
        });
      }
    });
  });

  botkitController.hears('report',['direct_mention','mention'], function(bot, message) {
    collection.once('value', function(snapshot) {
      var emojiVotes = new Array();
      var emojiReact = new Array();

      for (var val in snapshot.val()) {
        emojiVotes.push(snapshot.val()[val]);
      }
      emojiVotes.forEach(function(elem, i, arr) {
        // bot.reply(message, "HELLOOOOOO \n\n\n OOOOOOOOO" + elem);
        // elem.reactions.forEach(function(elem, i, arr) {
          for (var key in elem.reactions) {
            if (Object.prototype.hasOwnProperty.call(elem.reactions, key)) {
              var val = elem.reactions[key];
              // bot.reply(message, "HELLOOOOOO \n\n\n OOOOOOOOO" + key + val.score);
              emojiReact.push({name : key, score : val.score});
            }
          }
        // Object.keys(elem.reactions).forEach(function(elem, i, arr) {
        // });
        });
      // });

      var emojiResults = Array.from(new Set(emojiReact));

      bot.reply(message, "HELLOOOOOO \n\n\n OOOOOOOOO" + emojiReact);

      bot.startConversation(message, function(err, convo) {
        convo.say('Happy to report!');
        convo.say('The emojis used today were: *' + emojiResults.join('*, *') + "*.");
        convo.ask('Which emoji would you like a top report on?', function(response, convo) {
          convo.say(response.text);
          convo.next();
        }
        //   [
        //   {
        //     pattern: bot.utterances.yes,
        //     callback: function(response, convo) {
        //       convo.say('Bye!');
        //       convo.next();
        //       setTimeout(function() {
        //         process.exit();
        //       },3000);
        //     }
        //   },
        //   {
        //     pattern: bot.utterances.no,
        //     default: true,
        //     callback: function(response, convo) {
        //       convo.say('*Phew!*');
        //       convo.next();
        //     }
        //   }
        // ]
        );
      });
    });
  });
}

if (!process.env.TOKEN) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

connectToDb();
