const Tools = require("./tools.js");
const Const = require("./constants.js");
const es_client = require("./elastic_api.js").client;
const discord_client = require("./discord_api.js").client;

WAIT_GAUNTLET = 1000*60*15;

const gauntlet = Object.fromEntries(Const.FACTION_NAMES.map((n) => [n, {
    role: Const.roles[n],
    statuses: [],
    queue: [],
    levels: {},
    cronjob: null,
    next_reminder: -1,
    channel: null
}]));

function store() {
  const source = Const.FACTION_NAMES
    .map((n) => 'ctx._source.' + n + '= params.' + n + ';').join(' ');

  const params = Object.fromEntries(Const.FACTION_NAMES
    .map((n) => [n, {
      status_ids: gauntlet[n].statuses.map((s) => s.id),
      queue: gauntlet[n].queue,
      levels: gauntlet[n].levels,
      next_reminder: gauntlet[n].next_reminder,
      channel_id: gauntlet[n].channel ? gauntlet[n].channel.id : null,
    }])
  );

  es_client.update({
    index: 'gauntlet',
    id: '1',
    body: {
      script: {
        lang: 'painless',
        source: source,
        params: params
      }
    }
  });
}

function remind(channel_id) {
  const faction = getFaction(channel_id);
  faction.next_reminder = WAIT_GAUNTLET + Date.now();
  faction.cronjob = null;
  faction.channel.send(`<@&${Const.ROLE_DUNGEON_MASTER}>, il y a ${faction.queue.length} switchs en attente, à toi de jouer !`);
  store();
}

function setReminder(faction) {
  if (faction.next_reminder === -1 || faction.queue.length === 0) {
    return false;
  }

  const elapsed = faction.next_reminder - Date.now();
  if (elapsed < -WAIT_GAUNTLET) {
    // Either at start, or clear for more than 15 mins. Create one in 5 seconds.
    faction.next_reminder = 5 * 1000 + Date.now();
    faction.cronjob = setTimeout(remind, 5 * 1000, faction.channel.id);
  } else {
    // Either recover from backup, or new 15 min (minus time already spent)
    const remain_t = elapsed > 0 ? elapsed : WAIT_GAUNTLET + elapsed;
    faction.next_reminder = remain_t + Date.now();
    faction.cronjob = setTimeout(remind, remain_t, faction.channel.id);
  }

  return true;
}

function getFaction(channel_id) {
  if (channel_id === Const.GAUNTLET_FIRE)
    return gauntlet.fire;
  if (channel_id === Const.GAUNTLET_EARTH)
    return gauntlet.earth;
  if (channel_id === Const.GAUNTLET_ICE)
    return gauntlet.ice;
  if (channel_id === Const.GAUNTLET_STORM)
    return gauntlet.storm;
  return null;
}

module.exports.start = function (channel, size) {
  const faction = getFaction(channel.id);
  if (faction.next_reminder !== -1) {
    return false;
  }
  faction.next_reminder = 0;

  if (!faction.channel) {
    faction.channel = channel;
  }

  faction.levels = Object.fromEntries(
    [...Array(size).keys()].map((k) => [k, [0, null]])
  );

  module.exports.stat(channel);
  return true;
}

module.exports.getStatusIndex = function (message) {
  const faction = getFaction(message.channel.id);
  if (!faction || faction.statuses.length === 0)
    return -1;
  return faction.statuses.map((s) => s.id).indexOf(message.id);
}

async function sendStatus(channel, messages, stop, faction) {
  for (let i = 0; i < messages.length; ++i) {
    await channel.send(messages[i]).then((status) => {
      if (!stop) {
        if (i === 0) {
          status.react("\u{1F504}")
          .catch(() => {});
        }

        if (i !== 0 && i !== messages.length - 1) {
          status.react("\u{2705}")
          .then(() => status.react("\u{1F44B}"))
          .catch(() => {});
        }
        faction.statuses.push(status);
      }
    });
  }
  store();
}

async function recvStatus(faction, source) {
  for (let i = 0; i < source.status_ids.length; ++i) {
    await faction.channel.messages.fetch(source.status_ids[i]).then((s) => {
      faction.statuses.push(s);
    });
  }
  return faction.channel.guild.members.fetch();
}

module.exports.stat = function (channel, level=-1, overwrite=true, stop=false) {
  const faction = getFaction(channel.id);
  let messages = [];

  if (faction.levels.length === 0) {
    messages.push("Aucun labyrinthe n'est en cours.");
  } else {
    const names = Object.fromEntries(Object.entries(faction.levels)
      .filter(([k, v]) => v[1] !== null)
      .map(([k, v]) => [k, channel.guild.members.cache.get(v[1]).user.username])
    );

    messages.push(stop ? "Ce labyrinthe est terminé." : "Un labyrinthe est en cours.");
    messages = messages.concat(Object.entries(faction.levels).map(([k, v]) => `Étage ${parseInt(k) + 1} : ${v[0] ? (v[0] === 1 ? "Fait" : "Switch demandé") + (v[1] ? " par " + names[k] + "." : ".") : "A faire."}`));

    if (faction.cronjob !== null) {
      messages.push(`Prochain ping dans ${Tools.getRemainingTimeString(faction.next_reminder - Date.now())}`);
    } else {
      messages.push(`Pas de ping programmé.`);
    }
  }

  if (faction.statuses.length && !overwrite) {
    faction.statuses[messages.length - 1].edit(messages[messages.length - 1]);
    faction.statuses[level + 1].edit(messages[level + 1]);
    return store();
  }

  return channel.messages.fetch({ limit: 1 })
  .then(messages_fetched => {
    if (faction.statuses.length) {
      // Check if last message is this. No need to delete then, avoid pings
      if (!stop && faction.statuses[faction.statuses.length - 1].id === messages_fetched.first().id) {
        faction.statuses[messages.length - 1].edit(messages[messages.length - 1]);
        faction.statuses[level + 1].edit(messages[level + 1]);
        return store();
      }

      // else clear old status
      faction.statuses.forEach((s) => s.delete());
      faction.statuses.length = 0;
    }

    // new status
    return sendStatus(channel, messages, stop, faction);
  });
}

module.exports.stop = function (channel_id) {
  const faction = getFaction(channel_id);
  if (faction.next_reminder === -1) {
    return false;
  }

  faction.next_reminder = -1;

  if (faction.cronjob) {
    clearTimeout(faction.cronjob);
    faction.cronjob = null;
  }
  faction.queue.length = 0;
  faction.levels.length = 0;

  module.exports.stat(faction.channel, -1, true, true);
  faction.statuses.length = 0;

  store();
  return true;
}

module.exports.next = function (message) {
  const faction = getFaction(message.channel.id);

  if (faction.next_reminder === -1) {
    return false;
  }

  if (faction.queue.length === 0) {
    message.reply(`La file d'attente est vide.`);
    return true;
  }

  faction.next_reminder = Date.now();

  if (faction.cronjob) {
    clearTimeout(faction.cronjob);
    faction.cronjob = null;
  }

  const level = faction.queue.splice(0, 1)[0];

  message.reply(`extraction du prochain switch...\nÉtage ${level + 1}, demandé par ${faction.channel.guild.members.cache.get(faction.levels[level][1]).user.username}.`);

  faction.levels[level] = [0, null];

  if (faction.queue.length !== 0) {
    setReminder(faction);
  }

  module.exports.stat(message.channel, level);
  return true;
}

module.exports.done = function (channel_id, user_id, level, batch=false) {
  const faction = getFaction(channel_id);

  if (faction.levels.length <= level || faction.levels[level][0] !== 0) {
    return false;
  }

  faction.levels[level] = [1, user_id];

  if (!batch)
    module.exports.stat(faction.channel, level);

  return true;
}

module.exports.switch = function (channel_id, user_id, level, batch=false) {
  const faction = getFaction(channel_id);

  if (faction.levels.length <= level || faction.levels[level][0] !== 0) {
    return false;
  }

  faction.queue.push(level);
  faction.levels[level] = [2, user_id];

  if (faction.queue.length === 1) {
    setReminder(faction);
  }

  if (!batch)
    module.exports.stat(faction.channel, level);

  return true;
}

module.exports.inProgress = function (channel_id) {
  const faction = getFaction(channel_id);
  return faction.next_reminder !== -1;
}

async function init() {
  es_client.get({
    index: 'gauntlet',
    id: '1'
  })
  .catch((err) => {
    es_client.indices.create({
      index: "gauntlet",
      ignore: [400]
    })
    .then((success) => {
      const body = Object.fromEntries(Const.FACTION_NAMES.map((n) => [n, {
        status_ids: [],
        levels: {},
        queue: [],
        next_reminder: -1,
        channel_id: null,
      }]));
      return es_client.index({index: 'gauntlet', id: '1', body: body});
    });
  })
  .then((body) => {
    if (body) {
      Object.keys(gauntlet).forEach((key) => {
        gauntlet[key].statuses = [];
        gauntlet[key].levels = body._source[key].levels;
        gauntlet[key].queue = body._source[key].queue;
        gauntlet[key].next_reminder = body._source[key].next_reminder;
        gauntlet[key].channel = null;
        if (body._source[key].channel_id) {
          discord_client.on("ready", () => {
            discord_client.channels.fetch(body._source[key].channel_id)
              .then((channel) => {
                gauntlet[key].channel = channel;
                setReminder(gauntlet[key]);
                store();
              })
              .then(() => {
                if (body._source[key].status_ids.length) {
                  return recvStatus(gauntlet[key], body._source[key]);
                }
              })
              .catch((err) => console.log(err));
          });
        }
      });
    }
  })
  .catch((err) => console.error(err));
}

init();
