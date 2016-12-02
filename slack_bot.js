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
                bot.botkit.log('TOP\n\n\n\n', event);
    var stamp = event.item.ts.split('.').join('');

    if (event.reaction==='heart') {
      var birbCollection = collection.child(stamp);

      birbCollection.once('value', function(snapshot) {
        var birb = 1;

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
              birbScore: birb,
              birbs: new Array.push(event.user)
            });
          });
        } else if (snapshot.val().birbs.includes(event.user)) {
          // new user can't vote
          return;
        } else {
          birbCollection.child("/score").transaction(function(score) {
            score = score + birb;
            return score;
          });
        }
      });
    }
  });

  // botkitController.hears(['report'], ['direct_message', 'direct_mention'], function(bot, message) {
  //   bot.reply(message, "Let me make sure everyone's dude status has been set.");

  //   function assignDude(status, val) {
  //     collection.child('members/' + val.id).once('value', function(snapshot) {
  //       collection.child('members/' + val.id).update({dudeStatus: status});
  //       bot.reply(message, 'OK! I will update my dossier for ' + '<@' + val.id + '>');
  //     });
  //   }

  //   function askDude(val, convo) {
  //     convo.ask('Is ' + '<@' + val.id + '>' + ' a dude?', [
  //       {
  //         pattern: bot.utterances.yes,
  //         callback: function(response, convo) {
  //           assignDude(true, val);
  //           convo.next();
  //         }
  //       },
  //       {
  //         pattern: bot.utterances.no,
  //         callback: function(response, convo) {
  //           assignDude(false, val);
  //           convo.next();
  //         }
  //       },
  //       {
  //         default: true,
  //         callback: function(response,convo) {
  //           convo.say("No problem! I'll ask again and you can just say " + '<@' + val.id + '>' + ' is not a dude.');
  //           convo.repeat();
  //           convo.next();
  //         }
  //       }
  //     ]);
  //     convo.next();
  //   }

  //   function getReport(convo) {
  //     function getTotals(status) {

  //       var indTotal = 0;

  //       collection.child('members').orderByChild('dudeStatus')
  //       .equalTo(status).on('value', function(snapshot) {
  //         if (snapshot.val()) {
  //           var dudes = Object.keys(snapshot.val()).map(function(key) {
  //             return snapshot.val()[key];
  //           });

  //           dudes.forEach(function(usr, i, arr) {
  //             indTotal += usr.score
  //           });
  //         }
  //       });
  //       return indTotal;
  //     }

  //     var dudeTotal = getTotals(true);
  //     var notDudeTotal = getTotals(false);
  //     var percent = (notDudeTotal !== 0) ? Math.trunc((dudeTotal / (dudeTotal + notDudeTotal)) * 100) : 0;

  //     collection.child('totals').update(
  //       {
  //         dudeTotal: dudeTotal,
  //         notDudeTotal: notDudeTotal,
  //         percentageDude: percent
  //       }
  //     );

  //     collection.child('totals').once('value').then(function(snapshot) {
  //       if ((dudeTotal && notDudeTotal) === 0) {
  //         bot.reply(message, 'Not enough talking has gone on! Maybe try again later.');
  //       } else {
  //         bot.reply(message, "All dude statuses are in!");


  //         bot.botkit.log('report total log', dudeTotal + notDudeTotal);
  //         bot.botkit.log('report result log', percent);

  //         bot.reply(message, 'Dudes have talked:\n' + percent + '% of the time');
  //       }
  //     });
  //   }


  //   function talkedToday(convo) {
  //     function checkDude(snapshot) {
  //       async.everySeries(snapshot.val(), function(val, cb, err) {
  //         if (val.dudeStatus === 0) {
  //           askDude(val, convo);
  //         } else {
  //           cb(null, !err);
  //         }
  //       }, function(err) {
  //         if (err) {
  //           bot.reply(message, 'Something went wrong. Try again?');
  //         } else {
  //           getReport(convo);
  //           convo.stop();
  //           collection.child('members').off('value', checkDude);
  //         }
  //       });
  //     }

  //     collection.child('members').on('value', checkDude);
  //   }

    // bot.startConversation(message, function(err, convo) {
    //   talkedToday(convo);
    // })

  // });

}

if (!process.env.TOKEN) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

connectToDb();
