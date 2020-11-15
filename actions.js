const dateFormat = require('dateformat');
const sheets = require("./sheets_api.js").sheets;
const Errors = require("./errors.js");
const Tools = require("./tools.js");
const Validators = require("./validators.js");
const Cronjobs = require("./cronjobs.js");
const War = require("./war.js");

module.exports.help = function (message) {
  message.reply(`Aide:
    - /add <name>: Ajoute un joueur In-Game sans discord
    - /add-discord <name>: Ajoute un joueur In-Game avec discord
    - /remove <name>: Retire un joueur de la guilde
    - /level <name> <level>: Enregistre un nouveau niveau IG pour ce joueur
    - /blame-war <name>: Blame un joueur pour une guerre
    - /blame-gauntlet <name>: Blame un joueur pour un labyrinthe
    - /repent <name>: Absout les péchés d'un joueur
    - /show: Affiche les données
    - /war [action]: Actions disponibles:
        - start [time]: Démarre une guerre, avec pour temps restant 'time'.
                        Le temps restant est lu sous forme [XXh][XXm][XXs].
        - stop: Annule une guerre en cours.
        - done: Marque ton combat effectué.
        - bye: Désactive tes notifications si tu n'es pas matché.
    - /roster: Affiche le roster`);
}

module.exports.show = function (message, range) {
  sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: range,
  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    const str_table = Tools.parseTable(res.data.values);
    if (!str_table.length) return Errors.unknown(message);

    let str = "";
    for (let i = 0; i < str_table.length; ++i) {
      if ((str + str_table[i]).length > 1900) {
        message.reply("```" + str + "```");
        str = "";
      }
      str += str_table[i];
    }
    if (str) {
      message.reply("```" + str + "```");
    }
  });
}

module.exports.add = function (message, args, discord) {
  Validators.exists(args[0], 'joueurs!A4:A', false)
  .then((success) => sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'joueurs!A:D',
    valueInputOption: "USER_ENTERED",
    insertDataOption: "OVERWRITE",
    resource: {
      values: [
        [args[0], discord, dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")]
      ]
    }
  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    rangeFormat(message, 'joueurs!C:C', `${args[0]} a correctement été ajouté(e) !`);
  }))
  .catch((err) => {
    // handle case where player exists (don't care if already has discord or
    // not, could be improved)
    if (discord) {
      Validators.exists(args[0], 'joueurs!A4:A')
      .then((success) => sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: `joueurs!B${success[0] + 4}:B${success[0] + 4}`,
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [[discord]]
        },

      }, (err, res) => {
        if (err) return Errors.unknown(message, err);

        message.reply(`${args[0]} est maintenant sur Discord !`);
      }))
      .catch((err) => Errors.handle(message, err));
    } else {
      Errors.handle(message, err);
    }
  });
}

module.exports.remove = function (message, args) {
  Validators.exists(args[0], 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: `joueurs!D${success[0] + 4}:D${success[0] + 4}`,
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [[dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")]]
    },

  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    message.reply(`${args[0]} a été retiré(e) de la guilde.`);
  }))
  .catch((err) => Errors.handle(message, err));
}

module.exports.level = function (message, args) {
  names = args.filter((v, i) => i % 2 === 0)
  levels = args.filter((v, i) => i % 2 === 1)

  if (levels.filter((v) => isNaN(parseInt(v))).length) {
    return Errors.bad_arg(message);
  }

  Validators.exist(names, 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'niveaux!A:C',
    valueInputOption: "USER_ENTERED",
    insertDataOption: "OVERWRITE",
    resource: {
      values: names.map((v, i) => [v, levels[i], dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")])
    },

  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    rangeFormat(message, 'niveaux!C:C', `${names.join(', ')} sont maintenant respectivement niveaux ${levels.join(', ')} !`);
  }))
  .catch((err) => Errors.handle(message, err));
}

module.exports.blame = function (message, args, war, gauntlet, reply) {
  Validators.exists(args[0], 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'blames!A:D',
    valueInputOption: "USER_ENTERED",
    insertDataOption: "OVERWRITE",
    resource: {
      values: [
        [args[0], war, gauntlet, dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")]
      ]
    },

  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    rangeFormat(message, 'blames!D:D', reply);
  }))
  .catch((err) => Errors.handle(message, err));
}

module.exports.repent = function (message, args) {
  Validators.exists(args[0], 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'blames!F4:H'
  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    const data = res.data.values.filter((row) => row[0] === args[0])[0];
    module.exports.blame(message, args, -parseInt(data[1]), -parseInt(data[2]), `${args[0]} a été pardonné(e) !`);
  }))
  .catch((err) => Errors.handle(message, err));
}

module.exports.startWar = function (message, time=undefined) {
  War.initialize(message.channel);
  if (time) {
    let timestamp = 0;
    const h = time.split("h");
    if (h.length === 2) {
      timestamp += 1000 * 60 * 60 * parseInt(h[0].slice(-2), 10);
    }
    const m = time.split("m");
    if (m.length === 2) {
      timestamp += 1000 * 60 * parseInt(m[0].slice(-2), 10);
    }
    const s = time.split("s");
    if (s.length === 2) {
      timestamp += 1000 * parseInt(s[0].slice(-2), 10);
    }
    Cronjobs.register_war_pings(message.channel, timestamp);
  } else {
    Cronjobs.register_war_pings(message.channel);
  }
}

module.exports.stopWar = function (message) {
  if (!Cronjobs.stop_war()) {
    return Errors.no_war(message);
  }
  message.reply(`La guerre a été correctement annulée.`);
}

module.exports.doneWar = function (message) {
  if (!War.done(message.channel.id, message.author.id)) {
    Errors.not_war_listed(message);
  }
}

module.exports.byeWar = function (message) {
  if (!War.done(message.channel.id, message.author.id)) {
    Errors.not_war_listed(message);
  }
}

function rangeFormat(message, range, str) {
  sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.SPREADSHEET_ID,
    resource: Tools.rangeDate(range)
  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    message.reply(str);
  });
}
