const Tools = require("./tools.js");
const Const = require("./constants.js");
const es_client = require("./elastic_api.js").client;
const discord_client = require("./discord_api.js").client;

WAIT_GAUNTLET = 1000*60*15;

const gauntlet = {
  earth: {
    role: Const.ROLE_EARTH,
    queue: [],
    cronjob: null,
    next_reminder: -1,
    channel: null
  },
  fire: {
    role: Const.ROLE_FIRE,
    queue: [],
    cronjob: null,
    next_reminder: -1,
    channel: null
  },
  ice: {
    role: Const.ROLE_ICE,
    queue: [],
    cronjob: null,
    next_reminder: -1,
    channel: null
  },
  storm: {
    role: Const.ROLE_STORM,
    queue: [],
    cronjob: null,
    next_reminder: -1,
    channel: null
  }
}

function store() {
  es_client.update({
    index: 'gauntlet',
    id: '1',
    body: {
      script: {
        lang: 'painless',
        source: 'ctx._source.earth = params.earth; ctx._source.fire = params.fire; ctx._source.ice = params.ice; ctx._source.storm = params.storm',
        params: {
          earth: {
            queue: gauntlet.earth.queue,
            next_reminder: gauntlet.earth.next_reminder,
            channel_id: gauntlet.earth.channel ? gauntlet.earth.channel.id : null,
          },
          fire: {
            queue: gauntlet.fire.queue,
            next_reminder: gauntlet.fire.next_reminder,
            channel_id: gauntlet.fire.channel ? gauntlet.fire.channel.id : null,
          },
          ice: {
            queue: gauntlet.ice.queue,
            next_reminder: gauntlet.ice.next_reminder,
            channel_id: gauntlet.ice.channel ? gauntlet.ice.channel.id : null,
          },
          storm: {
            queue: gauntlet.storm.queue,
            next_reminder: gauntlet.storm.next_reminder,
            channel_id: gauntlet.storm.channel ? gauntlet.storm.channel.id : null,
          }
        }
      }
    }
  });
}

function remind(channel_id) {
  const faction = getFaction(channel_id);
  faction.next_reminder = 0;
  faction.cronjob = null;
  faction.channel.send(`<@&${Const.ROLE_DUNGEON_MASTER}>, à toi de jouer !`);
  store();
}

function setReminder(faction) {
  if (faction.next_reminder === -1 || faction.queue.length === 0) {
    return false;
  }
  if (faction.next_reminder === 0) {
    faction.next_reminder = WAIT_GAUNTLET + Date.now();
  }

  const remain_t = faction.next_reminder - Date.now();
  if (remain_t < 0) {
    return false;
  }

  faction.cronjob = setTimeout(remind, remain_t, faction.channel.id);
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

module.exports.start = function (channel) {
  const faction = getFaction(channel.id);
  if (faction.next_reminder !== -1) {
    return false;
  }
  faction.next_reminder = 0;

  if (!faction.channel) {
    faction.channel = channel;
  }

  faction.channel.send(`Le labyrinthe a commencé.`);
  store();
  return true;
}

module.exports.stat = function (channel_id) {
  const faction = getFaction(channel_id);
  if (faction.next_reminder === -1) {
    return false;
  }

  const users = faction.queue
    .map((p) => [faction.channel.guild.members.cache.get(p[0]).user.username, p[1]]);

  if (faction.queue.length === 0) {
    faction.channel.send(`Un labyrinthe est en cours. Il n'y a actuellement aucun switch en attente.`);
  } else {
    let msg = `Un labyrinthe est en cours. Les switchs en attente sont les suivants :`;
    msg += '\n' + `${users.map((u) => u[1] ? u[0] + "(raison : " + u[1] + ")" : u[0]).join(" | ")}`;
    if (faction.next_reminder !== 0) {
      msg += '\n' + `Prochain ping dans ${Tools.getRemainingTimeString(faction.next_reminder - Date.now())}`;
    }
    faction.channel.send(msg);
  }
  return true;
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

  store();
  return true;
}

module.exports.next = async function (message) {
  const faction = getFaction(message.channel.id);
  if (faction.next_reminder === -1) {
    return false;
  }

  if (faction.cronjob) {
    clearTimeout(faction.cronjob);
    faction.cronjob = null;
  }

  if (faction.queue.length === 0) {
    message.reply(`La file d'attente est vide.`);
    return true;
  }

  const next_switch = faction.queue.splice(0, 1)[0];

  message.reply(`extraction du prochain switch...\nDemandé par ${faction.channel.guild.members.cache.get(next_switch[0]).user.username}.${next_switch[1] ? " Raison : " + next_switch[1] : ""}`);

  if (faction.queue.length !== 0) {
    setReminder(faction);
  }
  store();
  return true;
}

module.exports.switch = function (channel_id, user_id, args=null) {
  const faction = getFaction(channel_id);

  faction.queue.push([user_id, args.length !== 0 ? args.join(" ") : null]);
  if (faction.queue.length === 1) {
    remind(channel_id);
  }
  store();
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
    .then((success) => es_client.index({
      index: 'gauntlet',
      id: '1',
      body: {
        earth: {
          queue: [],
          next_reminder: -1,
          channel_id: null,
        },
        fire: {
          queue: [],
          next_reminder: -1,
          channel_id: null,
        },
        ice: {
          queue: [],
          next_reminder: -1,
          channel_id: null,
        },
        storm: {
          queue: [],
          next_reminder: -1,
          channel_id: null,
        }
      }
    }))
  })
  .then((body) => {
    if (body) {
      for (const [key, value] of Object.entries(gauntlet)) {
        gauntlet[key].queue = body._source[key].queue;
        gauntlet[key].next_reminder = body._source[key].next_reminder;
        gauntlet[key].channel = null;
        if (body._source[key].channel_id) {
          discord_client.on("ready", () => {
            discord_client.channels.fetch(body._source[key].channel_id)
              .then((channel) => {
                gauntlet[key].channel = channel;
                setReminder(gauntlet[key]);
              })
              .catch((err) => console.log(err));
          });
        }
      }
    }
  })
  .catch((err) => console.error(err));
}

init();
