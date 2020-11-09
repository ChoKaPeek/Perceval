console.log("Discord Client connecting...");

const Discord = require("discord.js");
const client = new Discord.Client();
module.exports.client = client;

const Actions = require("./actions.js");
const Errors = require("./errors.js");
const Validators = require("./validators.js");

const prefix = "/";

client.on("message", function(message) {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const commandBody = message.content.slice(prefix.length);
  const args = commandBody.split(' ');
  const command = args.shift().toLowerCase();

  if (command === "help") {
    Actions.help(message);
  }

  else if (command === "roster") {
    Actions.show(message, 'Roster!B:F');
  }

  else if (command === "show") {
    Actions.show(message, 'Visualisation!B3:H22');
  }

  if (command === "add") {
    if (!Validators.authorized(message))
      return Errors.unauthorized(message);
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.add(message, args, 0);
  }

  else if (command === "add-discord") {
    if (!Validators.authorized(message))
      return Errors.unauthorized(message);
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.add(message, args, 1);
  }

  else if (command === "remove") {
    if (!Validators.authorized(message))
      return Errors.unauthorized(message);
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.remove(message, args);
  }

  else if (command === "level") {
    if (!Validators.authorized(message))
      return Errors.unauthorized(message);
    if (args.length === 0 || args.length % 2 !== 0)
      return Errors.bad_arg(message);
    Actions.level(message, args);
  }

  else if (command === "blame-war") {
    if (!Validators.authorized(message))
      return Errors.unauthorized(message);
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.blame(message, args, 1, 0, `${args[0]} a reçu un blame de guerre.`);
  }

  else if (command === "blame-gauntlet") {
    if (!Validators.authorized(message))
      return Errors.unauthorized(message);
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.blame(message, args, 0, 1, `${args[0]} a reçu un blame labyrinthe.`);
  }

  else if (command === "repent") {
    if (!Validators.authorized(message))
      return Errors.unauthorized(message);
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.repent(message, args);
  }
});

client.login(process.env.BOT_TOKEN);

console.log("Discord Client connected.");
