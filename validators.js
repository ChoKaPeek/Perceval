const sheets = require("./sheets_api.js").sheets;
const Errors = require("./errors.js");
const Tools = require("./tools.js");

const COUR_MARTIALE = "773882975707463710";

module.exports.authorized = function (message) {
  return message.channel.id === COUR_MARTIALE;
}

module.exports.exists = function (name, range, should_exist=true) {
  return new Promise((resolve, reject) => {
    return sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range
    }, (err, res) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        return reject({callback: Errors.unknown});
      }
      const exists = !!res.data.values.flat().filter((c) => c === name).length
      if (exists === should_exist) {
        return resolve(Tools.findIndex(name, res.data.values));
      }

      if (should_exist) {
        reject({callback: Errors.missing_player, args: [name]})
      } else {
        reject({callback: Errors.player_exists, args: [name]})
      }
    });
  });
}
