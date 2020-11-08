const client = require("./discord_api.js").client;
const admin = '<@237272256366116867>';

module.exports.bad_arg = function (message) {
  return message.reply(`Arguments invalides.`);
}

module.exports.unknown = function (message) {
  return message.reply(`Désolé, une erreur s'est produite. Contactez ${admin} pour résoudre le problème.`);
}
