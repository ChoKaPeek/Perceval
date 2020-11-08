const dateFormat = require('dateformat');
const sheets = require("./sheets_api.js").sheets;
const Errors = require("./errors.js");
const Tools = require("./tools.js");
const Validators = require("./validators.js");

module.exports.help = function (message) {
  message.reply(`Aide:
    - /add <name>: Ajoute un joueur In-Game sans discord
    - /add-discord <name>: Ajoute un joueur In-Game avec discord
    - /level <name> <level>: Enregistre un nouveau niveau IG pour ce joueur
    - /blame-war <name>: Blame un joueur pour une guerre
    - /blame-gauntlet <name>: Blame un joueur pour un labyrinthe
    - /repent <name>: Absout les péchés d'un joueur
    - /show: Affiche les données
    - /roster: Affiche le roster`);
}

module.exports.show = function (message, range) {
  sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: range,
  }, (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
      return Errors.unknown(message);
    }
    const str_table = Tools.parseTable(res.data.values);
    if (!str_table.length) {
      return Errors.unknown(message);
    }
    message.reply("```" + str_table.join("") + "```");
  });
}

module.exports.add = function (message, args, discord) {
  Validators.not_exists(args[0], 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'joueurs!A:D',
    valueInputOption: "USER_ENTERED",
    insertDataOption: "OVERWRITE",
    resource: {
      values: [
        [args[0], discord, dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")]
      ]
    },

  }, (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
      return Errors.unknown(message);
    }

    sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.SPREADSHEET_ID,
      resource: Tools.rangeDate('joueurs!C:C')
    }, (err, res) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        return Errors.unknown(message);
      }
      message.reply(`${args[0]} a correctement été ajouté(e) !`);
    });
  }))
  .catch((err) => Errors.handle(message, err));
}

module.exports.level = function (message, args) {
  if (isNaN(parseInt(args[1]))) {
    return Errors.bad_arg(message);
  }

  Validators.exists(args[0], 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'niveaux!A:C',
    valueInputOption: "USER_ENTERED",
    insertDataOption: "OVERWRITE",
    resource: {
      values: [
        [args[0], args[1], dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")]
      ]
    },

  }, (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
      return Errors.unknown(message);
    }

    sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.SPREADSHEET_ID,
      resource: Tools.rangeDate('niveaux!C:C')
    }, (err, res) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        return Errors.unknown(message);
      }
      message.reply(`${args[0]} est maintenant niveau ${args[1]} !`);
    });
  }))
  .catch((err) => Errors.handle(message, err));
}

module.exports.blame = function (message, args, war, gauntlet) {
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
    if (err) {
      console.log('The API returned an error: ' + err);
      return Errors.unknown(message);
    }

    sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.SPREADSHEET_ID,
      resource: Tools.rangeDate('blames!D:D')
    }, (err, res) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        return Errors.unknown(message);
      }
      message.reply(`${args[0]} a reçu un blame.`);
    });
  }))
  .catch((err) => Errors.handle(message, err));
}
