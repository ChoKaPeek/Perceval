console.log("Discord Client connecting...");

const Discord = require("discord.js");
const client = new Discord.Client();
module.exports.client = client;

const Actions = require("./actions.js");
const Errors = require("./errors.js");

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

  else if (command === "add") {
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.add(message, args, 0);
  }

  else if (command === "add-discord") {
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.add(message, args, 1);
  }

  else if (command === "level") {
    if (args.length !== 2)
      return Errors.bad_arg(message);
    Actions.level(message, args);
  }

  else if (command === "blame-war") {
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.blame(message, args, 1, 0);
  }

  else if (command === "blame-gauntlet") {
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.blame(message, args, 0, 1);
  }

  else if (command === "repent") {
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.repent(message, args);
  }
});

client.login(process.env.BOT_TOKEN);

console.log("Discord Client connected.");
