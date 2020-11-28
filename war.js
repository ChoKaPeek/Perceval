const Tools = require("./tools.js");
const Const = require("./constants.js");
const es_client = require("./elastic_api.js").client;
const discord_client = require("./discord_api.js").client;

const WAIT_WAR_CHECKS = [1000*60*60*24-1, 1000*60*60*12, 1000*60*60*6,
  1000*60*60*3, 1000*60*60*1, 1000*60*30, 1000*60*15]

const war = {
  earth: {
    role: Const.ROLE_EARTH,
    status: null,
    player_list: [],
    cronjobs: [],
    end_time: -1,
    channel: null
  },
  fire: {
    role: Const.ROLE_FIRE,
    status: null,
    player_list: [],
    cronjobs: [],
    end_time: -1,
    channel: null
  },
  ice: {
    role: Const.ROLE_ICE,
    status: null,
    player_list: [],
    cronjobs: [],
    end_time: -1,
    channel: null
  },
  storm: {
    role: Const.ROLE_STORM,
    status: null,
    player_list: [],
    cronjobs: [],
    end_time: -1,
    channel: null
  }
}

function store() {
  es_client.update({
    index: 'war',
    id: '1',
    body: {
      script: {
        lang: 'painless',
        source: 'ctx._source.earth = params.earth; ctx._source.fire = params.fire; ctx._source.ice = params.ice; ctx._source.storm = params.storm',
        params: {
          earth: {
            player_list: war.earth.player_list,
            status_id: war.earth.status ? war.earth.status.id : null,
            end_time: war.earth.end_time,
            channel_id: war.earth.channel ? war.earth.channel.id : null,
          },
          fire: {
            player_list: war.fire.player_list,
            status_id: war.fire.status ? war.fire.status.id : null,
            end_time: war.fire.end_time,
            channel_id: war.fire.channel ? war.fire.channel.id : null,
          },
          ice: {
            player_list: war.ice.player_list,
            status_id: war.ice.status ? war.ice.status.id : null,
            end_time: war.ice.end_time,
            channel_id: war.ice.channel ? war.ice.channel.id : null,
          },
          storm: {
            player_list: war.storm.player_list,
            status_id: war.storm.status ? war.storm.status.id : null,
            end_time: war.storm.end_time,
            channel_id: war.storm.channel ? war.storm.channel.id : null,
          }
        }
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
  const mentionList = getMentionList(faction.player_list
    .filter((p) => p.status === 0));

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

  faction.player_list = channel.guild.members.cache
    .filter((m) => m.roles.cache.has(faction.role))
    .map((m) => { return {status: 0, id: m.id}});

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
  const players = faction.player_list.map((p) => { return {
    name: channel.guild.members.cache.get(p.id).user.username, status: p.status
  }}).sort();

  let msg = "";
  if (faction.cronjobs.length === 0) {
    msg = `Cette guerre est terminée depuis ${Tools.getRemainingTimeString(remain_t)}.`
  } else {
    msg = `La guerre se terminera dans ${Tools.getRemainingTimeString(remain_t)}.`
  }

  msg += '\n' + players.map((p) => (p.status ? (p.status === 1 ? ":white_check_mark: " : ":wave: ") : ":x: ") + p.name).join(" | ");

  if (faction.status) {
    if (!overwrite) {
      return faction.status.edit(msg);
    }
    faction.status.delete();
    faction.status = null;
  }

  channel.send(msg).then((status) => {
    if (!stop && faction.cronjobs.length !== 0) {
      status.react("\u{1F504}")
      .then(() => status.react("\u{2705}"))
      .then(() => status.react("\u{1F44B}"))
      .then(() => status.react("\u{274C}"));
      faction.status = status;
      store();
    }
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
  const p = faction.player_list.find((p) => p.id === user_id);
  if (p === undefined)
    return 1;
  if (p.status === 0)
    return 2;

  p.status = 0;

  module.exports.stat(faction.channel);
  return true;
}

module.exports.done = function (channel_id, user_id, done) {
  const faction = getFaction(channel_id);
  const p = faction.player_list.find((p) => p.id === user_id);
  if (p === undefined)
    return 1;
  if ((done && p.status === 1) || (!done && p.status === 2))
    return 2;

  if (done) {
    p.status = 1;
  } else {
    p.status = 2;
  }

  module.exports.stat(faction.channel);
  return 0;
}

function getMentionList(list) {
  return list.map((p) => `<@${p.id}>`);
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
    .then((success) => es_client.index({
      index: 'war',
      id: '1',
      body: {
        earth: {
          player_list: [],
          status_id: null,
          end_time: -1,
          channel_id: null
        },
        fire: {
          player_list: [],
          status_id: null,
          end_time: -1,
          channel_id: null
        },
        ice: {
          player_list: [],
          status_id: null,
          end_time: -1,
          channel_id: null
        },
        storm: {
          player_list: [],
          status_id: null,
          end_time: -1,
          channel_id: null
        }
      }
    }))
  })
  .then((body) => {
    if (body) {
      for (const [key, value] of Object.entries(war)) {
        war[key].player_list = body._source[key].player_list;
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
      }
    }
  })
  .catch((err) => console.error(err));
}

init();
