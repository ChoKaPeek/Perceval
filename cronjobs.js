const sheets = require("./sheets_api.js").sheets;
const client = require("./discord_api.js").client;
const Errors = require('./errors.js');
const War = require('./war.js');
const Tools = require('./tools.js');

const COUR_MARTIALE = "773882975707463710";
const GENERAL = "672432242382995457";

const WAIT_DISCORD_CHECK = 1000*60*60;
const WAIT_WAR_CHECKS = [1000*60*60*24, 1000*60*60*12, 1000*60*60*6, 1000*60*60*3,
  1000*60*60*1, 1000*60*30, 1000*60*15, 0]
const TWO_DAYS = 1000*60*60*24*2;

const NO_DISCORD_RANGE = 'joueurs!F4:G';

const war_jobs = [];

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

function ping_war(channel, remain_t) {
  let msg = "";
  const mentionList = War.getMentionList(channel.id);

  if (remain_t === 0) {
    msg = "La guerre est terminée.\n";
    if (mentionList.length !== 0) {
      msg += `Les joueurs ${mentionList.join(", ")} n'ont pas pris part à la guerre.`;
    }
  } else {
    msg = `La guerre se terminera dans ${Tools.getRemainingTimeString(remain_t)}.`;
    if (mentionList.length !== 0) {
      msg += `
${War.getMentionList(channel.id).join(", ")}, n'oubliez pas votre combat !
Une fois effectué tapez \`/war done\`, ou \`/war bye\` si vous n'êtes pas matchés.`;
    }
  }

  channel.send(msg);
}

module.exports.run = function () {
  wait_first_message(silent=false);
}

module.exports.stop_war = function () {
  if (war_jobs.length === 0) {
    return false;
  }
  war_jobs.map((j) => clearTimeout(j));
  war_jobs.length = 0;
  return true;
}

module.exports.register_war_pings = function (channel, remain_t=-1) {
  module.exports.stop_war();
  if (remain_t === -1) {
    remain_t = WAIT_WAR_CHECKS[0];
  }

  ping_war(channel, remain_t);
  WAIT_WAR_CHECKS.slice(1).filter((w) => w < remain_t)
    .map((w) => war_jobs.push(setTimeout(ping_war, remain_t - w, channel, w)));
}
