const Tools = require("./tools.js");
const Errors = require("./errors.js");
const sheets = require("./sheets_api.js").sheets;
const levenshtein = require('js-levenshtein');

const MAX_LEV = 3; // max levenshtein distance allowed
const TIER = 10;
const HEADERS = 2;
const SHEET_NAMES = ["Monsters", "Boss", "Raid"];

function create_ranges() {
  const result = [];
  SHEET_NAMES.forEach((sheet) => {
    for (let i = 0; i < TIER; ++i) {
      const col = String.fromCharCode("A".charCodeAt(0) + 2*i);
      result.push(`${sheet}!${col}${HEADERS + 1}:${col}`)
    }
  })
  return result;
}

module.exports.display = function (monster) {
  const preproc_monster = monster.toLowerCase().trim();

  return new Promise((resolve, reject) => {
    return sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.CODEX_SPREADSHEET_ID,
      ranges: create_ranges()
    }, (err, res) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        return reject({callback: Errors.unknown});
      }
      console.log(res.data.valueRanges[0].values);

      let idx = -1;
      let range = "";
      let monster_name = "";
      res.data.valueRanges.some((dic) => {
        if (dic.values !== undefined) {
          const tmp_idx = dic.values.findIndex((e) =>
            levenshtein(e[0].toLowerCase().trim(), preproc_monster) < MAX_LEV);
          if (tmp_idx !== -1) {
            idx = tmp_idx;
            range = dic.range;
            monster_name = dic.values[tmp_idx][0];
            return true;
          }
        }
        return false;
      });

      if (idx !== -1) {
        const split = range.split("!");
        const cell = `${String.fromCharCode(split[1][0].charCodeAt(0) + 1)}${idx + HEADERS + 2}`;
        const new_range = `${split[0]}!${cell}:${cell}`;

        return sheets.spreadsheets.values.get({
          spreadsheetId: process.env.CODEX_SPREADSHEET_ID,
          range: new_range,
          valueRenderOption: "FORMULA"
        }, (err, res) => {
          if (err) {
            console.log('The API returned an error: ' + err);
            return reject({callback: Errors.unknown});
          }
          console.log(res.data);
          if (res.data.values[0][0] === "Link") {
            return resolve({monster: monster_name, url: res.data.values[0][0]});
          }
          return reject({callback: Errors.codex_not_yet, args: [monster_name]});
        });
      }
      return reject({callback: Errors.codex_unknown, args: [monster]});
    });
  });
}
