const dateFormat = require('dateformat');
const sheets = require("./sheets_api.js").sheets;
const Errors = require("./errors.js");
const Tools = require("./tools.js");
const Validators = require("./validators.js");
const Cronjobs = require("./cronjobs.js");
const War = require("./war.js");
const Gauntlet = require("./gauntlet.js");
const NLP = require("./nlp/nlp.js");
const Codex = require("./codex.js");
const OCR = require("./ocr.js");
const Discord = require("discord.js");
const Const = require("./constants.js");
const Eco = require("./eco.js");

module.exports.helpGauntlet = function (message) {
  message.reply(`Aide module Labyrinthe (\`/gaunt <arg>\`):
    - \`start <number>\`:
        Démarre un labyrinthe en spécifiant son nombre d'étages
    - \`status\`:
        Affiche l'état du labyrinthe
    - \`stop\`:
        Annule un labyrinthe en cours
    - \`done <number>\`:
        Déclare l'étage numéro <number> effectué.
    - \`switch <number>\`:
        Déclare un switch pour l'étage numéro <number>.
        Le Dungeon Master sera notifié en temps et en heure.
    - \`next\`:
        Extrait le prochain switch. Si d'autres switchs sont déclarés,
        prépare le prochain ping. Commande réservée au Dungeon Master.
    - \`blame <name>\`:
        Blame un joueur pour un labyrinthe

Réactions disponibles :
    - \u{1F504}: équivalent à \`/gaunt status\`
    - \u{2705}: équivalent à \`/gaunt done\` pour l'étage choisi
    - \u{1F44B}: équivalent à \`/gaunt switch\` pour l'étage choisi`
  );
}

module.exports.helpWar = function (message) {
  message.reply(`Aide module Guerre (\`/war <arg>\`):
    - \`start [time]\`:
        Démarre une guerre, avec pour temps restant 'time'.
        Le temps restant est lu sous forme [XXh][XXm][XXs].
        Il vaut 24 heures par défaut.
    - \`status\`:
        Affiche l'état de la guerre
    - \`stop\`:
        Annule une guerre en cours
    - \`done [mentions]\`:
        Si joueurs mentionnés, marque leur combat effectué.
        Sinon, le combat de l'auteur est effectué.
    - \`bye [mentions]\`:
        Si joueurs mentionnés, désactive leurs notifications.
        Sinon, désactive les notifications de l'auteur.
    - \`blame <name>\`:
        Blame un joueur pour une guerre

Réactions disponibles :
    - \u{1F504}: équivalent à \`/war status\`
    - \u{2705}: équivalent à \`/war done\`
    - \u{1F44B}: équivalent à \`/war bye\`
    - \u{274C}: annule \`/war done\` ou \`/war bye\``
  );
}

module.exports.help = function (message) {
  message.reply(`Aide:
    - \`/add <player> [players]\`:
        Ajoute un joueur In-Game, par mention ou par nom.
        Si pas de mention, le joueur est considéré absent de discord
    - \`/add-discord <name> <mention>\`:
        Termine un ajout de joueur. Le nom doit déjà exister, et sera associé à la mention
    - \`/remove <player>\`:
        Retire un joueur de la guilde
    - \`/level <player> <level>\`:
        Enregistre un nouveau niveau IG pour ce joueur
    - \`/repent <player>\`:
        Absout les péchés d'un joueur
    - \`/quest <number>\`:
        Enregistre un gain de <number> floren par l'auteur du message
    - \`/show\`:
        Affiche les données
    - \`/gauntlet\`:
        Utiliser \`/help gauntlet\` pour une liste des actions disponibles
    - \`/war\`:
        Utiliser \`/help war\` pour une liste des actions disponibles
    - \`/codex <monster name>\`:
        Affiche une page de codex complète pour le monstre demandé
    - \`/roster\`:
        Affiche le roster`
  );
}

module.exports.show = function (message, range) {
  sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: range,
  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    const str_table = Tools.parseTable(res.data.values);
    if (!str_table.length) return Errors.unknown(message);

    let str = "";
    for (let i = 0; i < str_table.length; ++i) {
      if ((str + str_table[i]).length > 1900) {
        message.reply("```" + str + "```");
        str = "";
      }
      str += str_table[i];
    }
    if (str) {
      message.reply("```" + str + "```");
    }
  });
}

module.exports.add = function (message, args, discord) {
  const names = Tools.parseNames(args, message.guild.members.cache);
  Validators.exist(names, 'joueurs!B4:C', false)
  .then((success) => {
    sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'joueurs!A:E',
      valueInputOption: "USER_ENTERED",
      insertDataOption: "OVERWRITE",
      resource: {
        values: names.map((n, i) => [success.next_row + i + 4, n.username, n.id, dateFormat(Date.now(), "dd/mm/yyy h:MM:ss")])
      }
    }, (err, res) => {
      if (err) return Errors.unknown(message, err);

      rangeFormat(message, 'joueurs!D:D',
        names.length === 1 ? `${names[0][0]} a été correctement ajouté.`
        : `${names.map((n) => n.username).join(", ")} ont correctement été ajoutés !`
      );
    })
  })
  .catch((err) => Errors.handle(message, err));
}

module.exports.addDiscord = function (message, username, mention) {
  const name = Tools.parseName(mention, message.guild.members.cache);
  Validators.exists(name, 'joueurs!B4:C', false)
  .then(() => Validators.exists(username, 'joueurs!B4:C')
    .then((success) => sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: `joueurs!C${success.idx[0] + 4}:C${success.idx[0] + 4}`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[name.id]]
      },
    }, (err, res) => {
      if (err) return Errors.unknown(message, err);

      message.reply(`${username} est maintenant sur Discord !`);
    }))
  )
  .catch((err) => Errors.handle(message, err));
}

module.exports.remove = function (message, args) {
  const names = Tools.parseNames(args, message.guild.members.cache);
  Validators.exist(names, 'joueurs!B4:C')
  .then((res) => Sheets.batchUpdate(names.map((n, i) => {
    return {
      request: Sheets.updateCells,
      range: `joueurs!E${res.idx[i][0] + 4}:E${res.idx[i][0] + 4}`,
      param: dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")
    }
  })))
  .then((res) => {
    if (names.length === 1) {
      message.reply(`${names.username} a été retiré(e) de la guilde.`);
    } else {
      message.reply(`${names.map((n) => n.username).join(", ")} ont été retirés de la guilde.`);
    }
  })
  .catch((err) => Errors.handle(message, err));
}

module.exports.level = function (message, args) {
  const arg_names = args.filter((v, i) => i % 2 === 0)
  const levels = args.filter((v, i) => i % 2 === 1)
  const names = arg_names.map((arg) => (arg.match(/<@(.*)>/g) || [arg])[0]);

  if (levels.filter((v) => isNaN(parseInt(v))).length) {
    return Errors.bad_arg(message);
  }

  Validators.exist(names, 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'niveaux!A:C',
    valueInputOption: "USER_ENTERED",
    insertDataOption: "OVERWRITE",
    resource: {
      values: names.map((v, i) => [v, levels[i], dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")])
    },

  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    rangeFormat(message, 'niveaux!C:C', `${names.join(', ')} sont maintenant respectivement niveaux ${levels.join(', ')} !`);
  }))
  .catch((err) => Errors.handle(message, err));
}

module.exports.blame = function (message, name, war, gauntlet, reply) {
  Validators.exists(name, 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'blames!A:D',
    valueInputOption: "USER_ENTERED",
    insertDataOption: "OVERWRITE",
    resource: {
      values: [
        [name, war, gauntlet, dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")]
      ]
    },

  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    rangeFormat(message, 'blames!D:D', reply);
  }))
  .catch((err) => Errors.handle(message, err));
}

module.exports.repent = function (message, args) {
  Validators.exists(args[0], 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'blames!F4:H'
  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    const data = res.data.values.filter((row) => row[0] === args[0])[0];
    module.exports.blame(message, args, -parseInt(data[1]), -parseInt(data[2]), `${args[0]} a été pardonné(e) !`);
  }))
  .catch((err) => Errors.handle(message, err));
}

module.exports.quest = function (message, floren) {
  Validators.exists(message.author.username, 'joueurs!A4:A')
  .then((success) => sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'quetes!A:C',
    valueInputOption: "USER_ENTERED",
    insertDataOption: "OVERWRITE",
    resource: {
      values: [
        [message.author.username, floren, dateFormat(Date.now(), "dd/mm/yyyy h:MM:ss")]
      ]
    }
  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    rangeFormat(message, 'quetes!C:C', `${message.author.username} a gagné ${floren} floren !`);
  }))
  .catch((err) => Errors.handle(message, err));
}

module.exports.statusWar = function (message) {
  War.stat(message.channel);
}

module.exports.startWar = function (message, time=undefined) {
  if (!War.start(message.channel, time)) {
    return Errors.war_in_progress(message);
  }
}

module.exports.stopWar = function (message) {
  if (!War.stop(message.channel)) {
    return Errors.no_war(message);
  }
}

module.exports.warEmoji = function (react, user_id, action) {
  if (action === "done")
    return War.done(react.message.channel.id, user_id, true);
  if (action === "bye")
    return War.done(react.message.channel.id, user_id, false);
  if (action === "cancel")
    return War.cancel(react.message.channel.id, user_id);
  return Errors.unknown(react.message, "unknown action " + action);
}

module.exports.doneWar = function (message, args, matched) {
  const ids = Array.from(message.mentions.users.keys());

  if (args.length !== ids.length)
    return Errors.only_mention(message);
  if (!War.inProgress(message.channel.id))
    return Errors.no_war(message);

  if (!ids.length) {
    ret = War.done(message.channel.id, message.author.id, matched);
    if (ret === 1)
      return Errors.not_war_listed(message);
    if (ret === 2)
      return Errors.already_done(message);
    return;
  }

  ids.map((id) => {
    ret = War.done(message.channel.id, id, matched);
    if (ret === 1) {
      Errors.not_war_listed(message, message.mentions.users.get(id).username);
    } else if (ret === 2) {
      Errors.already_done(message, message.mentions.users.get(id).username);
    }
  });
}

module.exports.gauntletEmoji = function (react, user_id, action, level) {
  if (action === "done")
    return Gauntlet.done(react.message.channel.id, user_id, level);
  if (action === "switch")
    return Gauntlet.switch(react.message.channel.id, user_id, level);
  return Errors.unknown(react.message, "unknown action " + action);
}

module.exports.statusGauntlet = function (message) {
  if (!Gauntlet.stat(message.channel, -1, true)) {
    return Errors.no_gauntlet(message);
  }
}

module.exports.startGauntlet = function (message, size) {
  if (size <= 0) {
    return Errors.bad_arg(message);
  }
  if (!Gauntlet.start(message.channel, size)) {
    return Errors.gauntlet_in_progress(message);
  }
}

module.exports.stopGauntlet = function (message) {
  if (!Gauntlet.stop(message.channel.id)) {
    return Errors.no_gauntlet(message);
  }
  message.reply(`Le labyrinthe a été correctement terminé.`);
}

module.exports.nextGauntlet = function (message) {
  if (!Gauntlet.next(message)) {
    return Errors.no_gauntlet(message);
  }
}

module.exports.doneGauntlet = function (message, levels) {
  if (!Gauntlet.inProgress(message.channel.id))
    return Errors.no_gauntlet(message);

  const batch = levels.length !== 1;
  levels.map((level) => {
    if (!Gauntlet.done(message.channel.id, message.author.id, level - 1, batch))
      Errors.invalid_level(message, level);
    else
      message.reply(`Tu as terminé l'étage ${level} !`);
  });
  if (batch)
    Gauntlet.stat(message.channel);
}

module.exports.switchGauntlet = function (message, levels) {
  if (!Gauntlet.inProgress(message.channel.id))
    return Errors.no_gauntlet(message);

  const batch = levels.length !== 1;
  levels.map((level) => {
    if (!Gauntlet.switch(message.channel.id, message.author.id, level - 1, batch))
      Errors.invalid_level(message, level);
    else
      message.reply(`Ta demande de switch pour l'étage ${level} est bien enregistrée.`);
  });
  if (batch)
    Gauntlet.stat(message.channel);
}

module.exports.nlp = function (message) {
  NLP.chat(message.content)
    .then((reply) => message.channel.send(reply))
    .catch((err) => Errors.unknown(message, err));
}

module.exports.codex = function (message, args) {
  const monster = args.join(' ');
  Codex.display(monster)
    .then((reply) => {
      const embed = new Discord.MessageEmbed()
        .setTitle(reply.monster)
        .setDescription("Page du codex :")
        .setImage(reply.url);
      message.channel.send(embed)
    })
    .catch((err) => Errors.handle(message, err));
}

function rangeFormat(message, range, str) {
  sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.SPREADSHEET_ID,
    resource: {
      requests: [Sheets.formatDate(range)]
    }
  }, (err, res) => {
    if (err) return Errors.unknown(message, err);

    message.reply(str);
  });
}

const OCR_filter = (reaction, user) => {
	return [Const.EMOJIS.GREEN_CHECK, Const.EMOJIS.RED_CROSS]
    .includes(reaction.emoji.name);
};

module.exports.ocr = async function (message) {
  message.attachments.forEach(async (attachment, key) => {
    const nums = await OCR.readGuild(attachment.url);
    const fmt_nums = `${nums.gold} or, ${nums.orn} orn et ${nums.florin} florin`;

    const validation = await message.channel.send(`Ajouter ${fmt_nums} ?`);
    validation.react(Const.EMOJIS.GREEN_CHECK)
    .then(() => validation.react(Const.EMOJIS.RED_CROSS))
    .then(() => {
      validation.awaitReactions(OCR_filter, { max: 1, time: 60000, errors: ['time'] })
      .then(collected => {
        const reaction = collected.first();

        if (reaction.emoji.name === Const.EMOJIS.GREEN_CHECK) {
          Eco.addMeasure(nums.gold, nums.orn, nums.florin);
          message.channel.send(`Ajouté ${fmt_nums}`);
        } else {
          message.channel.send('Ajout annulé.');
        }
        validation.delete();
      }).catch(() => {
        Eco.addMeasure(nums.gold, nums.orn, nums.florin);
        message.channel.send(`Ajouté ${fmt_nums}`);
        validation.delete();
      });
    }).catch(() => {}); // Ignore as message probably got deleted
  });
}

module.exports.addEco = async function (message, args) {
  Eco.addMeasure(args[0], args[1], args[2])
    .then(() => message.reply("bien ajouté."))
    .catch((err) => Errors.handle(message, err));
}

module.exports.analyseEco = function (message) {
  Eco.analyse().then((success) => {
    ["gold", "orn", "florin"].forEach(e => {
      const file = new Discord.MessageAttachment(success.attachments[e], `${e}.png`);

      const embed = new Discord.MessageEmbed()
      .setTitle(e)
      .attachFiles(file)
      .setImage(`attachment:\/\/${e}.png`);

      message.channel.send(embed);
    });
  })
  .catch((err) => Errors.handle(message, err));
}
