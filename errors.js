const client = require("./discord_api.js").client;
const admin = '<@237272256366116867>';

function unknown(message, err=null) {
  if (err) {
    console.log('The API returned an error: ' + err);
  }
  return message.reply(`Désolé, une erreur s'est produite. Contactez ${admin} pour résoudre le problème.`);
}

function unauthorized(message) {
  return message.reply(`Action non authorisée.`);
}

function missing_player(message, name) {
  return message.reply(`Le joueur ${name} n'existe pas dans la base.`);
}

function player_exists(message, name) {
  return message.reply(`Le joueur ${name} existe déjà dans la base.`);
}

function bad_arg(message) {
  return message.reply(`Arguments invalides.`);
}

module.exports = {
  unknown,
  unauthorized,
  missing_player,
  player_exists,
  bad_arg
}

module.exports.handle = function (message, err) {
  if (err.callback) {
    return err.callback(message, ...err.args);
  }
  return unknown(message, err);
}
