const Tools = require("./tools.js");
const es_client = require("./elastic_api.js").client;

const WAR_EARTH = "776150841529860176";
const WAR_FIRE = "669886787656744970";
const WAR_ICE = "778024462485946378";
const WAR_STORM = "000";
const ROLE_EARTH = "765916921644187698";
const ROLE_FIRE = "765916917285781536";
const ROLE_ICE = "765916925724721172";
const ROLE_STORM = "000";
const ROLE_OFFICIER = "672000544071483399";

const WAIT_WAR_CHECKS = [1000*60*60*24-1, 1000*60*60*12, 1000*60*60*6,
  1000*60*60*3, 1000*60*60*1, 1000*60*30, 1000*60*15]

const war = {
  earth: {
    role: ROLE_EARTH,
    player_list: [],
    done_list: [],
    cronjobs: [],
    end_time: -1,
    channel: null
  },
  fire: {
    role: ROLE_FIRE,
    player_list: [],
    done_list: [],
    cronjobs: [],
    end_time: -1,
    channel: null
  },
  ice: {
    role: ROLE_ICE,
    player_list: [],
    done_list: [],
    cronjobs: [],
    end_time: -1,
    channel: null
  },
  storm: {
    role: ROLE_STORM,
    player_list: [],
    done_list: [],
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
            done_list: war.earth.done_list,
            end_time: war.earth.end_time,
            channel: war.earth.channel
          },
          fire: {
            player_list: war.fire.player_list,
            done_list: war.fire.done_list,
            end_time: war.fire.end_time,
            channel: war.fire.channel
          },
          ice: {
            player_list: war.ice.player_list,
            done_list: war.ice.done_list,
            end_time: war.ice.end_time,
            channel: war.ice.channel
          },
          storm: {
            player_list: war.storm.player_list,
            done_list: war.storm.done_list,
            end_time: war.storm.end_time,
            channel: war.storm.channel
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
  if (channel_id === WAR_FIRE)
    return war.fire;
  if (channel_id === WAR_EARTH)
    return war.earth;
  if (channel_id === WAR_ICE)
    return war.ice;
  if (channel_id === WAR_STORM)
    return war.storm;
  return null;
}

function ping_war(channel, remain_t) {
  let msg = "";
  const faction = getFaction(channel.id);
  const mentionList = getMentionList(faction.player_list
    .filter((p) => !faction.done_list.includes(p)));

  if (remain_t === 0) {
    msg = "La guerre est terminée.";
    if (mentionList.length !== 0) {
      msg += '\n' + `Les joueurs ${mentionList.join(", ")} n'ont pas pris part à la guerre.`;
    }
    msg += '\n' + `<@&${ROLE_OFFICIER}>, à vous de jouer !`;

    module.exports.stop(channel.id); // last ping, auto end war
  } else {
    msg = `La guerre se terminera dans ${Tools.getRemainingTimeString(remain_t)}.`;
    if (mentionList.length !== 0) {
      msg += '\n' + `${mentionList.join(", ")}, n'oubliez pas votre combat !
Une fois effectué tapez \`/war done\`, ou \`/war bye\` si vous n'êtes pas matchés.`;
    }
  }

  channel.send(msg);
}

module.exports.start = function (channel, time) {
  const faction = getFaction(channel.id);
  if (faction.cronjobs.length !== 0) {
    return false;
  }

  if (!faction.channel) {
    faction.channel = channel;
  }

  faction.done_list.length = 0;
  faction.player_list = channel.guild.members.cache
    .filter((m) => m.roles.cache.has(faction.role)).map((m) => m.id);

  let remain_t = Tools.parseWarTime(time);
  if (remain_t === -1) {
    remain_t = WAIT_WAR_CHECKS[0];
  }

  ping_war(channel, remain_t);

  faction.end_time = Date.now() + remain_t;
  setCronjobs(faction);
  store();
  return true;
}

module.exports.stat = function (channel) {
  const faction = getFaction(channel.id);
  if (faction.end_time === -1) {
    return channel.send("Aucune guerre n'a encore eu lieu.");
  }
  const remain_t = Math.abs(faction.end_time - Date.now());
  const usernames = [].concat(faction.player_list.map((id) => [id, false]),
                              faction.done_list.map((id) => [id, true]))
    .map((p) => [channel.guild.members.cache.get(p[0]).user.username, p[1]])
    .sort();

  let msg = "";
  if (faction.cronjobs.length === 0) {
    msg = `La guerre est terminée depuis ${Tools.getRemainingTimeString(remain_t)}.`
  } else {
    msg = `La guerre se terminera dans ${Tools.getRemainingTimeString(remain_t)}.`
  }

  msg += '\n' + `${usernames.map((u) => (u[1] ? ":white_check_mark: " : ":x: ") + u[0]).join(" | ")}`;

  channel.send(msg);
}

module.exports.stop = function (channel_id) {
  const faction = getFaction(channel_id);
  if (faction.cronjobs.length === 0) {
    return false;
  }
  faction.cronjobs.map((j) => clearTimeout(j));
  faction.cronjobs.length = 0;
  faction.end_time = Date.now();

  store();
  return true;
}

module.exports.done = function (channel_id, user_id) {
  const faction = getFaction(channel_id);
  const idx = faction.player_list.findIndex((p) => p === user_id);
  if (idx === -1) {
    return false;
  }

  faction.done_list.push(faction.player_list[idx]);
  faction.player_list.splice(idx, 1);

  store();
  return true;
}

function getMentionList(list) {
  return list.map((id) => `<@${id}>`);
}

module.exports.getMentionPlayerList = function (channel_id) {
  return getMentionList(getFaction(channel_id).player_list);
}

module.exports.getMentionDoneList = function (channel_id) {
  return getMentionList(getFaction(channel_id).done_list);
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
    })
    .then((success) => es_client.index({
      index: 'war',
      id: '1',
      body: {
        earth: {
          player_list: [],
          done_list: [],
          end_time: -1,
          channel: null
        },
        fire: {
          player_list: [],
          done_list: [],
          end_time: -1,
          channel: null
        },
        ice: {
          player_list: [],
          done_list: [],
          end_time: -1,
          channel: null
        },
        storm: {
          player_list: [],
          done_list: [],
          end_time: -1,
          channel: null
        }
      }
    }))
  })
  .then((body) => {
    if (body) {
      for (const [key, value] of Object.entries(war)) {
        war[key].player_list = body._source[key].player_list;
        war[key].done_list = body._source[key].done_list;
        war[key].end_time = body._source[key].end_time;
        war[key].channel = body._source[key].channel;
        setCronjobs(war[key]);
      }
    }
  })
  .catch((err) => console.error(err));
}

init();
