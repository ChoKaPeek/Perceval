const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const {JWT} = require('google-auth-library');
const Const = require("./constants.js");

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';

function authorize(callback) {
    const jwtClient = new JWT({
        email: process.env.SERVICE_ACCOUNT_EMAIL,
        key: process.env.SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
        scopes: SCOPES,
        subject: null,
    });

    jwtClient.authorize(() => callback());

    return jwtClient;
}

function callback() {
  console.log("Sheets API connected.");
}

console.log("Sheets API connecting...");

const auth = authorize(callback);
module.exports.sheets = google.sheets({version: 'v4', auth});

function getID(sheet) {
  if (sheet === "joueurs") {
    return Const.JOUEURS_SID;
  }
  else if (sheet === "niveaux") {
    return Const.NIVEAUX_SID;
  }
  else if (sheet === "blames") {
    return Const.BLAMES_SID;
  }
  return -1;
}

function parseRange(range) {
  const regex = /$?([a-z]+)$?(\d+)/i;
  const parts = range.split('!');
  const cells = parts[1].split(':');
  const [from_raw_az, from_nb] = cells[0].match(regex);
  const [to_raw_az, to_nb] = cells[1].match(regex);
  const from_az = from_raw_az[from_raw_az.length === 1 ? 0 : 1].charCodeAt(0) - 65 + 26 * (from_raw_az[0].charCodeAt(0) - 64);
  const to_az = to_raw_az[to_raw_az.length === 1 ? 0 : 1].charCodeAt(0) - 65 + 26 * (to_raw_az[0].charCodeAt(0) - 64);
  return {
    sheetId: getID(parts[0]),
    startColumnIndex: from_az,
    endColumnIndex: to_az,
    startRowIndex: from_nb,
    endRowIndex: to_nb
  }
}

module.exports.formatDate = function (range, param=null) {
  return {
    repeatCell: {
      range: parseRange(range),
      cell: {
        userEnteredFormat: {
          numberFormat: {
            type: "DATE",
            pattern: "dd/mm/yyyy hh:mm:ss"
          }
        }
      },
      fields: "userEnteredFormat.numberFormat"
    }
  }
}

module.exports.updateCells = function (range, param) {
  return {
    updateCells: {
      range: parseRange(range),
      fields: 'userEnteredValue.stringValue',
      rows: [{
        values: [{
          userEnteredValue: {
            stringValue: param
          }
        }]
      }]
    }
  }
}

module.exports.batchUpdate = function (batch) {
  return sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.SPREADSHEET_ID,
    resource: {
      requests: [batch.map((b) => b.request(b.range, b.param))]
    }
  });
}
