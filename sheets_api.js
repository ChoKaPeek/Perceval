const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const {JWT} = require('google-auth-library');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';

console.log("Sheets API connecting...");

const auth = authorize(callback);
module.exports.sheets = google.sheets({version: 'v4', auth});

function authorize(callback) {
    const jwtClient = new JWT({
        email: process.env.SERVICE_ACCOUNT_EMAIL,
        key: process.env.SERVICE_ACCOUNT_KEY,
        scopes: SCOPES,
        subject: null,
    });

    jwtClient.authorize(() => callback());

    return jwtClient;
}

function callback() {
  console.log("Sheets API connected.");
}
