const sheets = require("./sheets_api.js").sheets;
const Errors = require("./errors.js");

module.exports.not_exists = function (name, range) {
  return new Promise((resolve, reject) => {
    return sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range
    }, (err, res) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        return reject({callback: Errors.unknown});
      }
      if (!res.data.values.flat().filter((c) => c === name).length) {
        return resolve();
      }
      reject({callback: Errors.player_exists, args: [name]});
    });
  });
}

module.exports.exists = function (name, range) {
  return new Promise((resolve, reject) => {
    return sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range
    }, (err, res) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        return reject({callback: Errors.unknown});
      }
      if (!res.data.values.flat().filter((c) => c === name).length) {
        return reject({callback: Errors.missing_player, args: [name]});
      }
      resolve();
    });
  });
}
