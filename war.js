const Tools = require("./tools.js");
const Const = require("./constants.js");
const es_client = require("./elastic_api.js").client;
const discord_client = require("./discord_api.js").client;

const WAIT_WAR_CHECKS = [1000*60*60*24-1, 1000*60*60*12, 1000*60*60*6,
  1000*60*60*3, 1000*60*60*1, 1000*60*30, 1000*60*15]

const war = Object.fromEntries(Const.FACTION_NAMES.map((n) => [n, {
  role: Const.roles[n],
  status: null,
  players: {},
  cronjobs: [],
  end_time: -1,
  channel: null
}]));

function store() {
  const source = Const.FACTION_NAMES
    .map((n) => 'ctx._source.' + n + '= params.' + n + ';').join(' ');

  const params = Object.fromEntries(Const.FACTION_NAMES
    .map((n) => [n, {
      players: war[n].players,
      status_id: war[n].status ? war[n].status.id : null,
      end_time: war[n].end_time,
      channel_id: war[n].channel ? war[n].channel.id : null,
    }])
  );

  es_client.update({
    index: 'war',
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

function setCronjobs(faction) {
  const remain_t = faction.end_time - Date.now();
  if (remain_t < 0) {
    return false;
  }

  WAIT_WAR_CHECKS.slice(1).filter((w) => w < remain_t)
    .map((w) => {
      faction.cronjobs.push(setTimeout(ping_war, remain_t - w, faction.channel, w));
    });
  faction.cronjobs.push(setTimeout(ping_war, remain_t, faction.channel, 0));
}

function getFaction(channel_id) {
  if (channel_id === Const.WAR_FIRE)
    return war.fire;
  if (channel_id === Const.WAR_EARTH)
    return war.earth;
  if (channel_id === Const.WAR_ICE)
    return war.ice;
  if (channel_id === Const.WAR_STORM)
    return war.storm;
  return null;
}

function ping_war(channel, remain_t) {
  let msg = "";
  const faction = getFaction(channel.id);
  const mentionList = getMentionList(Object.entries(faction.players)
    .filter(([k, v]) => v === 0).map(([k, v]) => k));

  if (remain_t === 0) {
    msg = "La guerre est terminée.";
    if (mentionList.length !== 0) {
      msg += '\n' + `Les joueurs ${mentionList.join(", ")} n'ont pas pris part à la guerre.`;
    }
    msg += '\n' + `<@&${Const.ROLE_OFFICIER}>, à vous de jouer !`;

    // last ping, auto end war
    module.exports.stop(channel);
  } else {
    msg = `La guerre se terminera dans ${Tools.getRemainingTimeString(remain_t)}.`;
    if (mentionList.length !== 0) {
      msg += '\n' + `${mentionList.join(", ")}, n'oubliez pas votre combat !
Une fois effectué tapez \`/war done\`, ou \`/war bye\` si vous n'êtes pas matchés.`;
    }
  }

  channel.send(msg);
}

module.exports.isMessageStatus = function (message) {
  const faction = getFaction(message.channel.id);
  if (!faction || !faction.status)
    return false;
  return message.id === faction.status.id;
}

module.exports.start = function (channel, time) {
  const faction = getFaction(channel.id);
  if (faction.cronjobs.length !== 0) {
    return false;
  }

  if (!faction.channel) {
    faction.channel = channel;
  }

  faction.players = Object.fromEntries(channel.guild.members.cache
    .filter((m) => m.roles.cache.has(faction.role)).map((m) => [m.id, 0]))

  console.log(faction.players)
  let remain_t = Tools.parseWarTime(time);
  if (remain_t === -1) {
    remain_t = WAIT_WAR_CHECKS[0];
  }

  ping_war(channel, remain_t);

  faction.end_time = Date.now() + remain_t;
  setCronjobs(faction);
  module.exports.stat(channel);
  return true;
}

module.exports.stat = function (channel, overwrite=true, stop=false) {
  const faction = getFaction(channel.id);
  if (faction.end_time === -1) {
    return channel.send("Aucune guerre n'a encore eu lieu.");
  }
  const remain_t = Math.abs(faction.end_time - Date.now());
  const players = Object.entries(faction.players)
    .map(([k, v]) => [channel.guild.members.cache.get(k).user.username, v])
    .sort();

  let msg = "";
  if (faction.cronjobs.length === 0) {
    msg = `Cette guerre est terminée depuis ${Tools.getRemainingTimeString(remain_t)}.`
  } else {
    msg = `La guerre se terminera dans ${Tools.getRemainingTimeString(remain_t)}.`
  }

  msg += '\n' + players.map((p) => (p[1] ? (p[1] === 1 ? ":white_check_mark: " : ":wave: ") : ":x: ") + p[0]).join(" | ");

  if (faction.status && !overwrite) {
    return faction.status.edit(msg);
  }

  return channel.messages.fetch({ limit: 1 })
  .then(messages => {
    if (faction.status) {
      // Check if last message is this. No need to delete then, avoid pings
      if (faction.status.id === messages.first().id) {
        return faction.status.edit(msg);
      }

      faction.status.delete();
      faction.status = null;
    }

    return channel.send(msg).then((status) => {
      if (!stop && faction.cronjobs.length !== 0) {
        status.react("\u{1F504}")
        .then(() => status.react("\u{2705}"))
        .then(() => status.react("\u{1F44B}"))
        .then(() => status.react("\u{274C}"))
        .catch(() => {}); // Ignore as message probably got deleted
        faction.status = status;
        store();
      }
    });
  });
}

module.exports.stop = function (channel) {
  const faction = getFaction(channel.id);
  if (faction.cronjobs.length === 0) {
    return false;
  }
  faction.cronjobs.map((j) => clearTimeout(j));
  faction.cronjobs.length = 0;
  faction.end_time = Date.now();

  module.exports.stat(channel, true, true);
  faction.status = null;

  store();
  return true;
}

module.exports.cancel = function (channel_id, user_id) {
  const faction = getFaction(channel_id);
  const k = Object.keys(faction.players).find((k) => k === user_id);
  if (k === undefined)
    return 1;
  if (faction.players[k] === 0)
    return 2;

  faction.players[k] = 0;

  module.exports.stat(faction.channel);
  return true;
}

module.exports.done = function (channel_id, user_id, done) {
  const faction = getFaction(channel_id);
  const k = Object.keys(faction.players).find((k) => k === user_id);
  if (k === undefined)
    return 1;
  if ((done && faction.players[k] === 1) || (!done && faction.players[k] === 2))
    return 2;

  if (done) {
    faction.players[k] = 1;
  } else {
    faction.players[k] = 2;
  }

  module.exports.stat(faction.channel);
  return 0;
}

function getMentionList(list) {
  return list.map((id) => `<@${id}>`);
}

module.exports.inProgress = function (channel_id) {
  const faction = getFaction(channel_id);
  return faction.cronjobs.length !== 0;
}

async function init() {
  es_client.get({
    index: 'war',
    id: '1'
  })
  .catch((err) => {
    es_client.indices.create({
      index: "war",
      ignore: [400]
    })
    .then((success) => {
      const body = Object.fromEntries(Const.FACTION_NAMES.map((n) => [n, {
        players: {},
        status_id: null,
        end_time: -1,
        channel_id: null
      }]));
      return es_client.index({index: 'war', id: '1', body: body});
    });
  })
  .then((body) => {
    if (body) {
      Object.keys(war).forEach((key) => {
        war[key].players = body._source[key].players;
        war[key].end_time = body._source[key].end_time;
        war[key].channel = null;
        war[key].status = null;
        if (body._source[key].channel_id) {
          discord_client.on("ready", () => {
            discord_client.channels.fetch(body._source[key].channel_id)
              .then((channel) => {
                war[key].channel = channel;
                setCronjobs(war[key]);
              })
              .then(() => {
                if (body._source[key].status_id) {
                  return war[key].channel.messages.fetch(body._source[key].status_id)
                  .then((status) => {
                    war[key].status = status;
                    war[key].channel.guild.members.fetch();
                  });
                }
              })
              .catch((err) => console.error(err));
          });
        }
      });
    }
  })
  .catch((err) => console.error(err));
}

init();
