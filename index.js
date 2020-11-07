const Discord = require("discord.js");
const config = require("./config.json");

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
    message.reply(`Aide:
        - /add <name>: Ajoute un joueur In-Game sans discord
        - /add-discord <name>: Ajoute un joueur In-Game avec discord
        - /level <name> <level>: Enregistre un nouveau niveau IG pour ce joueur
        - /blame-war <name>: Blame un joueur pour une guerre
        - /blame-gauntlet <name>: Blame un joueur pour un labyrinthe
        - /repent <name>: Absout les péchés d'un joueur
        - /show: Affiche les données
        - /roster: Affiche le roster`);
  }

  else if (command === "sum") {
    const numArgs = args.map(x => parseFloat(x));
    const sum = numArgs.reduce((counter, x) => counter += x);
    message.reply(`The sum of all the arguments you provided is ${sum}!`);
  }
});

client.login(config.BOT_TOKEN);

console.log("Bot started.")
