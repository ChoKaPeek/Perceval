const sheets = require("./sheets_api.js").sheets;
const Errors = require("./errors.js");

const CELL_SIZE = 13;

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

module.exports.show = function (message) {
  sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'Visualisation!B3:H22',
  }, (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
      return Errors.unknown(message);
    }
    const rows = res.data.values;
    const str_table = [];
    rows.map((row) => {
      str_line = [];
      for (let j = 0; j < row.length; ++j) {
        if (j && row[j - 1].length > CELL_SIZE) {
          str_line.push(row[j].padEnd(2*CELL_SIZE - row[j - 1].length, " "));
        }
        else {
          str_line.push(row[j].padEnd(CELL_SIZE, " "));
        }
      }
      str_line.push("\n");
      str_table.push(str_line.join(""));
    });
    if (!str_table.length) {
      return Errors.unknown(message);
    }
    message.reply("```" + str_table.join("") + "```");
  });
}
