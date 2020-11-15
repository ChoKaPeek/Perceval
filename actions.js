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
    - /repent <name>: Absout les péchés d'un joueur
    - /quest <number>: Enregistre un gain de <number> floren par l'auteur du message
    - /show: Affiche les données
    - /gauntlet <action>: Actions disponibles :
        - blame <name>: Blame un joueur pour un labyrinthe
    - /war <action>: Actions disponibles :
        - start [time]: Démarre une guerre, avec pour temps restant 'time'.
                        Le temps restant est lu sous forme [XXh][XXm][XXs].
                        Il vaut 24 heures par défaut
        - stop: Annule une guerre en cours
        - done [mentions]: Si joueurs mentionnés, marque leur combat effectué.
                           Sinon, c'est le combat de l'auteur
        - bye [mentions]: Si joueurs mentionnés, désactive leurs notifications.
                          Sinon, désactive les notifications de l'auteur
        - blame <name>: Blame un joueur pour une guerre
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

module.exports.blame = function (message, name, war, gauntlet, reply) {
  Validators.exists(name, 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'blames!A:D',
    valueInputOption: "USER_ENTERED",
    insertDataOption: "OVERWRITE",
    resource: {
      values: [
        [name, war, gauntlet, dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")]
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

module.exports.quest = function (message, floren) {
  Validators.exists(message.author.username, 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'quetes!A:C',
    valueInputOption: "USER_ENTERED",
    insertDataOption: "OVERWRITE",
    resource: {
      values: [
        [message.author.username, floren, dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")]
      ]
    }
  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    rangeFormat(message, 'quetes!C:C', `${message.author.username} a gagné ${floren} floren !`);
  }))
  .catch((err) => Errors.handle(message, err));
}

module.exports.startWar = function (message, time=undefined) {
  War.initialize(message.channel);
  Cronjobs.register_war_pings(message.channel, Tools.parseWarTime(time));
}

module.exports.stopWar = function (message) {
  if (!Cronjobs.stop_war()) {
    return Errors.no_war(message);
  }
  message.reply(`La guerre a été correctement annulée.`);
}

module.exports.doneWar = function (message, args) {
  const ids = Array.from(message.mentions.users.keys());
  if (ids.length) {
    if (args.length !== ids.length + 1)
      return Errors.bad_arg(message);
    ids.map((id) => {
      if (!War.done(message.channel.id, id)) {
        Errors.not_war_listed(message, message.mentions.users.get(id).username);
      } else {
        message.reply(`Le combat de ${message.mentions.users.get(id).username} est validé.`);
      }
    });
  } else {
    if (args.length > 1)
      return Errors.bad_arg(message);
    if (!War.done(message.channel.id, message.author.id)) {
      return Errors.not_war_listed(message);
    }
    message.reply("Merci pour ta bravoure, soldat !");
  }
}

module.exports.byeWar = function (message, args) {
  const ids = Array.from(message.mentions.users.keys());
  if (ids.length) {
    if (args.length !== ids.length + 1)
      return Errors.bad_arg(message);
    ids.map((id) => {
      if (!War.done(message.channel.id, id)) {
        Errors.not_war_listed(message, message.mentions.users.get(id).username);
      } else {
        message.reply(`Les notifications de ${message.mentions.users.get(id).username} sont annulées.`);
      }
    });
  } else {
    if (args.length > 1)
      return Errors.bad_arg(message);
    if (!War.done(message.channel.id, message.author.id)) {
      return Errors.not_war_listed(message);
    }
    message.reply("Ne t'en fais pas, ton tour viendra !");
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
