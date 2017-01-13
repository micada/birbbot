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

var collection = firebase.database().ref(today);

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

    if (event.reaction==='birb') {
      const birbCollection = collection.child(stamp);
      const birbGiver = {};
      birbGiver[event.user] = true;

      birbCollection.once('value', function(snapshot) {

        if (snapshot.val() === null ) {
          bot.api.channels.history({
            channel: event.item.channel,
            latest: event.item.ts,
            count: 1,
            inclusive: 1
          }, function(err, response) {
            bot.botkit.log('WHY\n\n\n\n', response);
            birbCollection.set({
              id: response.latest,
              text: response.messages[0].text,
              user: response.messages[0].user,
              birbScore: 1,
              birbs: birbGiver
            });
          });
        }

        birbCollection.transaction(function(birb) {
          if (birb) {
            if (birb.birbs && birb.birbs[event.user]) {
              birb.birbScore--;
              birb.birbs[event.user] = null;
            } else {
              (birb.birbScore===0) ? birb.birbScore = 1 : birb.birbScore++;
              if (!birb.birbs) {
                birb.birbs = {};
              }
              birb.birbs[event.user] = true;
            }
          }
          return birb;
        });

      });
    }
  });

  botkitController.hears('report',['direct_mention','mention'], function(bot, message) {
    collection.once('value', function(snapshot) {
      var birbVotes = new Array();
      for (var val in snapshot.val()) {
        birbVotes.push(snapshot.val()[val]);
      }
      birbVotes.sort(function(a,b) {return b.birbScore - a.birbScore} );
      var topBirb = birbVotes[0];
      bot.reply(message,'The top Birbed message today so far is ' + topBirb.text + ' by ' + '<@' + topBirb.user+ '>!')
    });
  });
}

if (!process.env.TOKEN) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

connectToDb();
