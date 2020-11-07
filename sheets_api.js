const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';

console.log("Sheets API connecting...");

const auth = authorize(callback);
module.exports.sheets = google.sheets({version: 'v4', auth});

function authorize(callback) {
  const oAuth2Client = new google.auth.OAuth2(process.env.CLIENT_ID,
    process.env.CLIENT_SECRET, process.env.REDIRECT_URI);

  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) {
      return getNewToken(oAuth2Client, callback);
    }
    oAuth2Client.setCredentials(JSON.parse(token));
    callback();
  });
  return oAuth2Client;
}

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'online',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        return console.error('Error while trying to retrieve access token: ', err);
      }
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) {
          return console.error(err);
        }
        console.log('Token stored to ', TOKEN_PATH);
      });
      callback();
    });
  });
}

function callback() {
  console.log("Sheets API connected.");
}
