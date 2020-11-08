require('dotenv').config();

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

  else if (command === "show") {
    Actions.show(message);
  }

  else if (command === "add") {
    if (args.length != 1)
      return Errors.bad_arg(message);
    Actions.add(message, args, 0);
  }

  else if (command === "add-discord") {
    if (args.length != 1)
      return Errors.bad_arg(message);
    Actions.add(message, args, 1);
  }
});

client.login(process.env.BOT_TOKEN);

console.log("Discord Client connected.");
