const Const = require("./constants.js");
const es_client = require("./elastic_api.js").client;

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
            channel: gauntlet.earth.channel
          },
          fire: {
            queue: gauntlet.fire.queue,
            next_reminder: gauntlet.fire.next_reminder,
            channel: gauntlet.fire.channel
          },
          ice: {
            queue: gauntlet.ice.queue,
            next_reminder: gauntlet.ice.next_reminder,
            channel: gauntlet.ice.channel
          },
          storm: {
            queue: gauntlet.storm.queue,
            next_reminder: gauntlet.storm.next_reminder,
            channel: gauntlet.storm.channel
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
  faction.channel.send(`<&${Const.ROLE_DUNGEON_MASTER}>, à toi de jouer !`);
}

function setReminder(faction) {
  if (!faction.next_reminder) {
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

module.exports.start = function (message) {
  const faction = getFaction(message.channel.id);
  if (faction.next_reminder !== -1) {
    return false;
  }
  faction.next_reminder = 0;

  if (!faction.channel) {
    faction.channel = channel;
  }

  channel.send(`Le labyrinthe a commencé.`);
  store();
  return true;
}

module.exports.stat = function (channel) {
  const faction = getFaction(channel.id);

  const users = faction.queue
    .map((p) => [channel.guild.members.cache.get(p[0]).user.username, p[1]]);

  if (faction.next_reminder === -1)
    return false;

  if (faction.queue.length === 0) {
    channel.send(`Un labyrinthe est en cours. Il n'y a actuellement aucun switch en attente.`);
  } else {
    let msg = `Un labyrinthe est en cours. Les switchs en attente sont les suivants :`;
    msg += '\n' + `${users.map((u) => u[1] ? u[0] + "(raison : " + u[1] + ")" : u[0]).join(" | ")}`;
    if (faction.next_reminder !== 0) {
      msg += '\n' + `Prochain ping dans ${Tools.getRemainingTimeString(faction.next_reminder - Date.now())}`;
    }
    channel.send(msg);
  }
}

module.exports.stop = function (channel_id) {
  const faction = getFaction(channel_id);
  if (faction.next_reminder !== 0) {
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

module.exports.next = function (message) {
  const faction = getFaction(channel_id);
  if (faction.queue.length === 0) {
    return false;
  }

  const next_switch = faction.queue.splice(0, 1)[0];

  message.reply(`switch demandé par ${channel.guild.members.cache.get(next_switch[0]).user.username}.${next_switch[1] ? " Raison : " + next_switch[1] : ""}`);

  if (faction.queue.length !== 0) {
    setReminder(faction);
  }
}

module.exports.switch = function (channel_id, user_id, args=null) {
  const faction = getFaction(channel_id);

  faction.queue.push([user_id, args ? args.join(" ") : null]);
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
    })
    .then((success) => es_client.index({
      index: 'gauntlet',
      id: '1',
      body: {
        earth: {
          queue: [],
          next_reminder: -1,
          channel: null
        },
        fire: {
          queue: [],
          next_reminder: -1,
          channel: null
        },
        ice: {
          queue: [],
          next_reminder: -1,
          channel: null
        },
        storm: {
          queue: [],
          next_reminder: -1,
          channel: null
        }
      }
    }))
  })
  .then((body) => {
    if (body) {
      for (const [key, value] of Object.entries(gauntlet)) {
        gauntlet[key].queue = body._source[key].queue;
        gauntlet[key].next_reminder = body._source[key].next_reminder;
        gauntlet[key].channel = body._source[key].channel;
        setReminder(gauntlet[key]);
      }
    }
  })
  .catch((err) => console.error(err));
}

init();
