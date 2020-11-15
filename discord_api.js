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
    Validators.authorized(message)
    .then((success) => {
      if (args.length !== 1)
        return Errors.bad_arg(message);
      Actions.add(message, args, 0);
    })
    .catch((err) => Errors.handle(message, err));
  }

  else if (command === "add-discord") {
    Validators.authorized(message)
    .then((success) => {
      if (args.length !== 1)
        return Errors.bad_arg(message);
      Actions.add(message, args, 1);
    })
    .catch((err) => Errors.handle(message, err));
  }

  else if (command === "remove") {
    Validators.authorized(message)
    .then((success) => {
      if (args.length !== 1)
        return Errors.bad_arg(message);
      Actions.remove(message, args);
    })
    .catch((err) => Errors.handle(message, err));
  }

  else if (command === "level") {
    Validators.authorized(message)
    .then((success) => {
      if (args.length === 0 || args.length % 2 !== 0)
        return Errors.bad_arg(message);
      Actions.level(message, args);
    })
    .catch((err) => Errors.handle(message, err));
  }

  else if (command === "blame-war") {
    Validators.authorized(message)
    .then((success) => {
      if (args.length !== 1)
        return Errors.bad_arg(message);
      Actions.blame(message, args, 1, 0, `${args[0]} a reçu un blame de guerre.`);
    })
    .catch((err) => Errors.handle(message, err));
  }

  else if (command === "blame-gauntlet") {
    Validators.authorized(message)
    .then((success) => {
      if (args.length !== 1)
        return Errors.bad_arg(message);
      Actions.blame(message, args, 0, 1, `${args[0]} a reçu un blame labyrinthe.`);
    })
    .catch((err) => Errors.handle(message, err));
  }

  else if (command === "repent") {
    Validators.authorized(message)
    .then((success) => {
      if (args.length !== 1)
        return Errors.bad_arg(message);
      Actions.repent(message, args);
    })
    .catch((err) => Errors.handle(message, err));
  }

  else if (command === "war") {
    if (args.length === 0)
      return Errors.bad_arg(message);

    Validators.war_channel(message)
    .then((success) => {
      if (args[0] === "stop") {
        return Validators.authorized(message)
        .then((success) => {
          if (args.length !== 1)
            throw {callback: Errors.bad_arg};
          Actions.stopWar(message);
        })
      }

      if (args[0] === "start") {
        return Validators.authorized(message)
        .then((success) => {
          if (args.length > 2)
            throw {callback: Errors.bad_arg};
          Actions.startWar(message, args[1]);
        })
      }

      if (args[0] === "done") {
        Actions.doneWar(message);
      } else if (args[0] === "bye") {
        Actions.byeWar(message);
      }
    })
    .catch((err) => Errors.handle(message, err));
  }
});

client.login(process.env.BOT_TOKEN);

console.log("Discord Client connected.");
