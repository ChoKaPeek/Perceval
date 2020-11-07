const Discord = require("discord.js");
const Actions = require("./actions.js");
require('dotenv').config();

const client = new Discord.Client();

const prefix = "/";

console.log("Bot starting...")

client.on("message", function(message) {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const commandBody = message.content.slice(prefix.length);
  const args = commandBody.split(' ');
  const command = args.shift().toLowerCase();

  if (command === "help") {
    message.reply(Actions.help());
  }

  else if (command === "add") {
    if (!args.length) return;
    message.reply(Actions.add());
  }
});

client.login(process.env.BOT_TOKEN);

console.log("Bot started.")
