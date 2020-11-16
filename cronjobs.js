const sheets = require("./sheets_api.js").sheets;
const client = require("./discord_api.js").client;
const Errors = require('./errors.js');
const Tools = require('./tools.js');

const COUR_MARTIALE = "773882975707463710";
const GENERAL = "672432242382995457";

const WAIT_DISCORD_CHECK = 1000*60*60;
const TWO_DAYS = 1000*60*60*24*2;

const NO_DISCORD_RANGE = 'joueurs!F4:G';

function discord_check(channel) {
  setTimeout(discord_check, WAIT_DISCORD_CHECK, channel);
  sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: NO_DISCORD_RANGE,
  }, (err, res) => {
    if (err) return Errors.unknown(channel, err);

    const data = res.data.values;
    if (!data) {
      return;
    }
    for (let i = 0; i < data.length; ++i) {
      if (Date.now() - Date.parse(data[i][1]) > TWO_DAYS) {
        channel.send(`${data[i][0]} n'est toujours pas sur Discord après 48h. Date d'ajout : ${data[i][1]}.`);
      } else {
        break
      }
    }
  });
}

function init_crons() {
  discord_check(client.channels.cache.get(COUR_MARTIALE));
}

function wait_first_message(silent=true) {
  if (client.channels.cache.size === 0) {
    if (!silent) {
      console.log("Cron jobs: awaiting client...");
    }
    setTimeout(wait_first_message, 1000);
  } else {
    console.log("Cron jobs: initiating...");
    init_crons();
    console.log("Cron jobs: initiated.");
  }
}

module.exports.run = function () {
  wait_first_message(silent=false);
}

