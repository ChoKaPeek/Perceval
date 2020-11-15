const WAR_EARTH = "776150841529860176";
const WAR_FIRE = "669886787656744970";
const ROLE_EARTH = "765916921644187698";
const ROLE_FIRE = "765916917285781536";

const war = {
  earth: { player_list: [] },
  fire: { player_list: [] }
}

function getPlayerList(channel_id) {
  let player_list = [];
  if (channel_id === WAR_FIRE) {
    player_list = war.fire.player_list;
  }
  if (channel_id === WAR_EARTH) {
    player_list = war.earth.player_list;
  }
  return player_list;
}

module.exports.initialize = function (channel) {
  war.fire.player_list = channel.guild.members.cache
    .filter((m) => m.roles.cache.has(ROLE_FIRE)).map((m) => m.id);
  war.earth.player_list = channel.guild.members.cache
    .filter((m) => m.roles.cache.has(ROLE_EARTH)).map((m) => m.id);
}

module.exports.done = function (channel_id, user_id) {
  const playerList = getPlayerList(channel_id);
  const idx = playerList.findIndex((p) => p === user_id);
  if (idx === -1) {
    return false;
  }

  playerList.splice(idx, 1);
  return true;
}

module.exports.getMentionList = function (channel_id) {
  return getPlayerList(channel_id).map((id) => `<@${id}>`);
}
