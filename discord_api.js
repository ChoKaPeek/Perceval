console.log("Discord Client connecting...");

const Discord = require("discord.js");
const client = new Discord.Client();
module.exports.client = client;

const Actions = require("./actions.js");
const Errors = require("./errors.js");
const Validators = require("./validators.js");
const Const = require("./constants.js");

const prefix = "/";

client.on("ready", () => {
    client.user.setActivity("Orna", { type: "PLAYING"})
    console.log("Discord Client ready.");
})

client.on('messageReactionAdd', (react, user) => {
  if (user.bot) return;

  Validators.war_status_message(react.message)
  .catch(() => {})
  .then(() => {
    if (react.emoji.name === '\u{1F504}') // arrows_counterclockwise
      return Actions.statusWar(react.message);

    if (react.emoji.name === '\u{2705}') // white_check_mark
      return Actions.doneWarEmoji(react, user.id, true);

    if (react.emoji.name === '\u{1F44B}') // wave
      return Actions.doneWarEmoji(react, user.id, false);

    if (react.emoji.name === '\u{274C}') // red :x:
      return Actions.cancelWarEmoji(react, user.id);

  })
  .then(() => react.users.remove(user.id));
});

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
    Validators.authorized(message, Const.ROLE_OFFICIER)
    .then((success) => {
      Actions.add(message, args, 0);
    })
    .catch((err) => Errors.handle(message, err));
  }

  else if (command === "add-discord") {
    Validators.authorized(message, Const.ROLE_OFFICIER)
    .then((success) => {
      if (args.length !== 1)
        return Errors.bad_arg(message);
      Actions.add(message, args, 1);
    })
    .catch((err) => Errors.handle(message, err));
  }

  else if (command === "remove") {
    Validators.authorized(message, Const.ROLE_OFFICIER)
    .then((success) => {
      if (args.length !== 1)
        return Errors.bad_arg(message);
      Actions.remove(message, args);
    })
    .catch((err) => Errors.handle(message, err));
  }

  else if (command === "level") {
    Validators.authorized(message, Const.ROLE_OFFICIER)
    .then((success) => {
      if (args.length === 0 || args.length % 2 !== 0)
        return Errors.bad_arg(message);
      Actions.level(message, args);
    })
    .catch((err) => Errors.handle(message, err));
  }

  else if (command === "gauntlet") {
    if (args.length === 0)
      return Errors.bad_arg(message);

    if (args[0] === "blame") {
      return Validators.authorized(message, Const.ROLE_OFFICIER)
      .then((success) => {
        if (args.length !== 2)
          return Errors.bad_arg(message);
        Actions.blame(message, args[1], 0, 1, `${args[1]} a reçu un blame labyrinthe.`);
      })
      .catch((err) => Errors.handle(message, err));
    }

    return Validators.gauntlet_channel(message)
    .then((success) => {
      if (args[0] === "stop") {
        return Validators.authorized(message, Const.ROLE_OFFICIER)
        .then((success) => {
          if (args.length !== 1)
            throw {callback: Errors.bad_arg};
          Actions.stopGauntlet(message);
        })
      }

      if (args[0] === "start") {
        return Validators.authorized(message, Const.ROLE_OFFICIER)
        .then((success) => {
          if (args.length !== 1)
            throw {callback: Errors.bad_arg};
          Actions.startGauntlet(message);
        })
      }

      if (args[0] === "next") {
        return Validators.authorized(message, Const.ROLE_DUNGEON_MASTER)
        .then((success) => {
          if (args.length !== 1)
            throw {callback: Errors.bad_arg};
          Actions.nextGauntlet(message);
        })
      }

      if (args[0] === "switch") {
        Actions.switchGauntlet(message, args.splice(1));
      } else if (args[0] === "status") {
        if (args.length !== 1)
          return Errors.bad_arg(message);
        Actions.statusGauntlet(message);
      }
    })
    .catch((err) => Errors.handle(message, err));

    return Errors.bad_arg(message);
  }

  else if (command === "quest") {
    if (args.length !== 1)
      return Errors.bad_arg(message);
    Actions.quest(message, args[0]);
  }

  else if (command === "repent") {
    Validators.authorized(message, Const.ROLE_OFFICIER)
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

    if (args[0] === "blame") {
      return Validators.authorized(message, Const.ROLE_OFFICIER)
      .then((success) => {
        if (args.length !== 2)
          return Errors.bad_arg(message);
        Actions.blame(message, args[1], 1, 0, `${args[1]} a reçu un blame de guerre.`);
      })
      .catch((err) => Errors.handle(message, err));
    }

    return Validators.war_channel(message)
    .then((success) => {
      if (args[0] === "stop") {
        return Validators.authorized(message, Const.ROLE_OFFICIER)
        .then((success) => {
          if (args.length !== 1)
            throw {callback: Errors.bad_arg};
          Actions.stopWar(message);
        })
      }

      if (args[0] === "start") {
        return Validators.authorized(message, Const.ROLE_OFFICIER)
        .then((success) => {
          if (args.length > 2)
            throw {callback: Errors.bad_arg};
          Actions.startWar(message, args[1]);
        })
      }

      if (args[0] === "done") {
        Actions.doneWar(message, args.splice(1), true);
      } else if (args[0] === "bye") {
        Actions.doneWar(message, args.splice(1), false);
      } else if (args[0] === "status") {
        if (args.length !== 1)
          return Errors.bad_arg(message);
        Actions.statusWar(message);
      }
    })
    .then(() => message.delete())
    .catch((err) => Errors.handle(message, err));

    return Errors.bad_arg(message);
  }
});

client.login(process.env.BOT_TOKEN);

console.log("Discord Client connected.");
