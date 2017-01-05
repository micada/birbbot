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

  // collection.remove();

  var botkitController = botkit.slackbot({
    debug: true
  });

  botkitController.spawn({
    token: process.env.TOKEN
  }).startRTM();


  botkitController.on('reaction_added', function(bot, event) {
    bot.botkit.log('TOP\n\n\n\n', event.user);
    const stamp = event.item.ts.split('.').join('');

    if (event.reaction==='heart') {
      const birbCollection = collection.child(stamp);
      const birbGiver = event.user;

      birbCollection.once('value', function(snapshot) {

        if (snapshot.val() === null ) {
          bot.api.channels.history({
            channel: event.item.channel,
            latest: event.item.ts,
            count: 1,
            inclusive: 1
          }, function(err, response) {
            bot.botkit.log('WHY\n\n\n\n', response);
            birbCollection.update({
              id: response.latest,
              text: response.messages[0].text,
              user: response.messages[0].user,
              birbScore: 1,
              birbs: [
                {event.user : true}
              ]
            });
          });
        }

        birbCollection.transaction(function(birb) {
          if (birb) {
            if (birb.birbs && birb.birbs[event.user]) {
              birb.birbScore--;
              birb.birbs[event.user] = null;
            } else {
              birb.birbScore++;
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

  botkitController.on('reaction_removed', function(bot, event) {
    bot.botkit.log('TOP\n\n\n\n', event.user);
    var stamp = event.item.ts.split('.').join('');

    if (event.reaction==='heart') {
      var birbCollection = collection.child(stamp);

      birbCollection.once('value', function(snapshot) {

        bot.botkit.log('SNAP\n\n\n\n\n\n\nSHOT\n\n\n\n+++++++++++++++', snapshot.val().birbs);
        var birbGivers = snapshot.val().birbs.indexOf(event.user);
        if (birbGivers > -1) {
          birbCollection.child("/score").transaction(function(score) {
            score = score - 1;
            return score;
          });
          birbCollection.update({
            birbs: snapshot.val().birbs.splice(birbGivers, 1)
          });
        }
      });
    }
  });
}

if (!process.env.TOKEN) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

connectToDb();
