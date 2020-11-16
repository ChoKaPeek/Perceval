const sheets = require("./sheets_api.js").sheets;
const Errors = require("./errors.js");
const Tools = require("./tools.js");

const ROLE_OFFICIER = "672000544071483399";
const WAR_EARTH = "776150841529860176";
const WAR_FIRE = "669886787656744970";

module.exports.war_channel = function(message) {
  return new Promise((resolve, reject) => {
    if (message.channel.id !== WAR_EARTH && message.channel.id !== WAR_FIRE) {
      return reject({callback: Errors.bad_channel});
    }
    return resolve();
  });
}

module.exports.authorized = function (message) {
  return new Promise((resolve, reject) => {
    if (message.channel.type === "dm") {
      return reject({callback: Errors.bad_channel});
    }

    return message.channel.guild.members.fetch()
      .catch((err) => reject(err))
      .then((success) => {
        const member = message.channel.guild.members.cache.get(message.author.id);
        if (!member) {
          return reject({callback: Errors.sync_error});
        }
        if (member.roles.cache.has(ROLE_OFFICIER)) {
          return resolve();
        }
        return reject({callback: Errors.unauthorized});
      });
  });
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
      const lookup_name = name.id ? name.id : name.username;
      const exists = !!res.data.values.flat().filter((c) => c === lookup_name).length;

      if (exists) {
        const idx = Tools.findIndex(lookup_name, res.data.values);
        const username = res.data.values[0][idx[0]];
        if (should_exist) {
          return resolve({username, idx});
        }
        reject({callback: Errors.player_exists, args: [username]});
      } else {
        if (should_exist) {
          return reject({callback: Errors.missing_player, args: [name.username]});
        }
        resolve({next_row: res.data.values[0].length});
      }
    });
  });
}

module.exports.exist = function (names, range, should_exist=true) {
  return new Promise((resolve, reject) => {
    return sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range
    }, (err, res) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        return reject({callback: Errors.unknown});
      }
      const exist = res.data.values.flat().filter((c) => names.includes(c))
      if (should_exist) {
        if (exist.length === names.length) {
          return resolve({idx: Tools.findIndices(names, res.data.values)});
        }
        reject({
          callback: Errors.missing_player,
          args: [names.filter((n) => !exist.includes(n))]
        })
      } else {
        if (exist.length === 0) {
          return resolve({next_row: res.data.values[0].length});
        }
        reject({callback: Errors.player_exists, args: [exist]})
      }
    });
  });
}
