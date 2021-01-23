const Tools = require("./tools.js");
const Const = require("./constants.js");
const es_client = require("./elastic_api.js").client;
const discord_client = require("./discord_api.js").client;

WAIT_GAUNTLET = 1000*60*15;

const gauntlet = Object.fromEntries(Const.FACTION_NAMES.map((n) => [n, {
    role: Const.roles[n],
    statuses: [],
    queue: [],
    levels: [],
    cronjob: null,
    next_reminder: -1,
    channel: null
}]));

function store() {
  const source = Const.FACTION_NAMES
    .map((n) => 'ctx._source.' + n + '= params.' + n + ';').join(' ');

  const params = Object.fromEntries(Const.FACTION_NAMES
    .map((n) => [n, {
      status_infos: gauntlet[n].statuses.map((s) => ({id: s.id, level: s.level})),
      queue: gauntlet[n].queue,
      levels: gauntlet[n].levels,
      next_reminder: gauntlet[n].next_reminder,
      channel_id: gauntlet[n].channel ? gauntlet[n].channel.id : null,
    }])
  );

  es_client.update({
    index: 'gauntlet',
    id: process.env.SERVER_UID,
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

  faction.levels = [];
  for (let i = 0; i < size; ++i) {
    faction.levels.push([0, null]);
  }

  module.exports.stat(channel);
  return true;
}

module.exports.getLevel = function (message) {
  // not a level is -1, error is -2
  const faction = getFaction(message.channel.id);
  if (!faction || faction.statuses.length === 0)
    return -2;
  const idx = faction.statuses.map((s) => s.id).indexOf(message.id);
  if (idx === -1)
    return -2;
  if (idx === 0 || idx == faction.statuses.length - 1)
    return -1;
  return faction.statuses[idx].level;
}

async function sendStatus(faction, stop) {
  const levels = [-1];
  if (faction.statuses.length) {
    faction.statuses
      .filter((s) => s.level !== -1 && faction.levels[s.level][0] !== 1)
      .map((s) => levels.push(s.level));
  } else { // start
    faction.levels.filter((l) => l[0] !== 1)
      .map((l, i) => levels.push(i));
  }
  levels.push(-1);

  // delete old status information
  faction.statuses.forEach((s) => s.delete());
  faction.statuses.length = 0;

  for (let i = 0; i < levels.length; ++i) {
    let tmp_string;
    if (i === 0)
      tmp_string = buildStringPre(faction, stop);
    else if (i === levels.length - 1)
      tmp_string = buildStringPost(faction);
    else {
      if (stop) continue; // don't print each level's status
      tmp_string = buildStringLevel(faction, levels[i]);
    }

    let tmp_stat = await faction.channel.send(tmp_string);
    tmp_stat.level = levels[i];
    faction.statuses.push(tmp_stat);
  }

  if (stop) {
    faction.statuses.length = 0;
  } else {
    faction.statuses[0].react("\u{1F504}").catch(() => {});
    faction.statuses.slice(1, faction.statuses.length - 1).forEach((s) => {
      if (faction.levels[s.level][0] === 0) {
        return s.react("\u{2705}")
          .then(() => s.react("\u{1F44B}")).catch(() => {})
      }
    });
  }
  store();
}

async function recvStatus(faction, source) {
  for (let i = 0; i < source.status_infos.length; ++i) {
    await faction.channel.messages.fetch(source.status_infos[i].id).then((s) => {
      s.level = source.status_infos[i].level;
      faction.statuses.push(s);
    });
  }
  return faction.channel.guild.members.fetch();
}

function buildStringPre(faction, stop) {
  return stop ? "Ce labyrinthe est terminé." : "Un labyrinthe est en cours.";
}

function buildStringLevel(faction, index) {
  const level = faction.levels[index];
  if (level[0] === 1)
    return null;

  let tmp = `Étage ${index + 1} : `;

  if (level[0] === 0)
    return tmp + "À faire.";

  tmp += "Switch demandé";
  if (level[1])
    return tmp + " par " + faction.channel.guild.members.cache
      .get(level[1]).user.username;
  return tmp + ".";
}

function buildStringPost(faction) {
  let post = "";

  if (faction.queue.length !== 0)
    post = `Il y a ${faction.queue.length} switchs en attente. `;

  post += `${faction.levels.filter((l) => l[0] === 1).length}/${faction.levels.length} étages terminés. `;

  if (faction.cronjob !== null) {
    post += `Prochain ping dans ${Tools.getRemainingTimeString(faction.next_reminder - Date.now())}`;
  } else {
    post += `Pas de ping programmé.`;
  }

  return post;
}

function shiftLevels(faction, level) {
  const idx = faction.statuses.findIndex((s) => s.level === level);
  while (idx + 1 < faction.statuses.length) {
    // move level info to previous level info
    const tmp = faction.levels[faction.statuses[idx].level];
    faction.levels[faction.statuses[idx].level] = faction.levels[faction.statuses[idx + 1].level];
    faction.levels[faction.statuses[idx + 1].level] = tmp;

    // change status level and edit
    faction.statuses[idx].level = faction.statuses[idx + 1].level;
    editOneLevel(faction, faction.statuses[idx].level);
  }
  // change last status level with the level starting the shift and edit
  faction.statuses[faction.statuses.length - 1].level = level;
  editOneLevel(faction, faction.statuses[faction.statuses.length - 1].level);
}

function editOneLevel(faction, level) {
  const idx = faction.statuses.findIndex((s) => s.level === level);

  if (faction.levels[level][0] === 1) {
    faction.statuses[idx].delete();
    faction.statuses.splice(idx, 1);
  } else {
    if (faction.levels[level][0] === 2) {
      faction.statuses[idx].reactions.removeAll();
    } else if (faction.levels[level][0] === 0) {
      faction.statuses[idx].react("\u{2705}")
        .then(() => faction.statuses[idx].react("\u{1F44B}")).catch(() => {})
    }
    faction.statuses[idx].edit(buildStringLevel(faction, level));
  }
  faction.statuses[faction.statuses.length - 1].edit(buildStringPost(faction));
}

module.exports.stat = function (channel, level=-1, overwrite=false, stop=false) {
  const faction = getFaction(channel.id);

  if (faction.levels.length === 0 && !stop) {
    return channel.send("Aucun labyrinthe n'est en cours.");
  }

  if (stop) {
    return sendStatus(faction, true);
  }

  if (level >= 0 && faction.statuses.length && !overwrite) {
    editOneLevel(faction, level);
    return store();
  }

  return channel.messages.fetch({ limit: 1 })
  .then((messages_fetched) => {
    if (level >= 0 && faction.statuses.length && faction.statuses[faction.statuses.length - 1].id === messages_fetched.first().id) {
      // Check if last message is this. No need to delete then, avoid pings
      editOneLevel(faction, level);
      return store();
    }

    // new status
    return sendStatus(faction, false);
  });
}

module.exports.stop = function (channel_id) {
  const faction = getFaction(channel_id);
  if (faction.next_reminder === -1) {
    return false;
  }

  faction.next_reminder = -1;

  module.exports.stat(faction.channel, -1, true, true);

  if (faction.cronjob) {
    clearTimeout(faction.cronjob);
    faction.cronjob = null;
  }

  faction.queue.length = 0;
  faction.levels.length = 0;
  // faction.statuses deleted by stat()

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

  shiftLevels(faction, level);

  store();
  return true;
}

module.exports.done = function (channel_id, user_id, level, batch=false) {
  const faction = getFaction(channel_id);

  if (level < 0 || faction.levels.length <= level || faction.levels[level][0] !== 0) {
    return false;
  }

  faction.levels[level] = [1, user_id];

  if (!batch)
    module.exports.stat(faction.channel, level);

  return true;
}

module.exports.switch = function (channel_id, user_id, level, batch=false) {
  const faction = getFaction(channel_id);

  if (level < 0 || faction.levels.length <= level || faction.levels[level][0] !== 0) {
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
    id: process.env.SERVER_UID
  })
  .catch((err) => {
    es_client.indices.create({
      index: "gauntlet",
      ignore: [400]
    })
    .then((success) => {
      const body = Object.fromEntries(Const.FACTION_NAMES.map((n) => [n, {
        status_infos: [],
        levels: [],
        queue: [],
        next_reminder: -1,
        channel_id: null,
      }]));
      return es_client.index({index: 'gauntlet', id: process.env.SERVER_UID, body: body});
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
                if (body._source[key].status_infos.length) {
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
