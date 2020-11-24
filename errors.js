const client = require("./discord_api.js").client;
const admin = '<@237272256366116867>';

function answer(entity, response) {
  if (entity.reply) {
    entity.reply(response); // message
  } else {
    entity.send(response); // channel
  }
}

module.exports.only_mention = function (entity) {
  return answer(entity, `Cette commande ne prend que des mentions en argument.`);
}

module.exports.war_in_progress = function (entity) {
  return answer(entity, `Une guerre est déjà en cours sur ce canal de discussion.`);
}

module.exports.gauntlet_in_progress = function (entity) {
  return answer(entity, `Un labyrinthe est déjà en cours sur ce canal de discussion.`);
}

module.exports.no_war = function (entity) {
  return answer(entity, `Il n'y a pas de guerre en cours sur ce canal de discussion.`);
}

module.exports.no_gauntlet = function (entity) {
  return answer(entity, `Il n'y a pas de labyrinthe en cours sur ce canal de discussion.`);
}

module.exports.unknown = function (entity, err=null) {
  if (err) {
    console.log('The API returned an error: ' + err);
  }
  return answer(entity, `Désolé, une erreur s'est produite. Contactez ${admin} pour résoudre le problème.`);
}

module.exports.bad_channel = function (entity) {
  return answer(entity, `Action impossible dans ce canal de discussion.`);
}

module.exports.sync_error = function (entity) {
  return answer(entity, `Erreur de lecture d'éléments discord. Contactez ${admin} pour résoudre le problème.`);
}

module.exports.already_done = function (entity, name=null) {
  if (name)
    return answer(entity, `${name} a déjà effectué cette action.`);

  return answer(entity, `Tu as déjà effectué cette action.`);
}

module.exports.not_war_listed = function (entity, name=null) {
  if (name)
    return answer(entity, `${name} n'est pas listé(e) dans cette guerre.`);

  return answer(entity, `Tu n'es pas listé(e) dans cette guerre.`);
}

module.exports.unauthorized = function (entity) {
  return answer(entity, `Action non authorisée.`);
}

module.exports.missing_player = function (entity, name) {
  if (typeof(name) === "string") {
    return answer(entity, `Le joueur ${name} n'existe pas dans la base.`);
  }
  return answer(entity, `Les joueurs ${name.join(', ')} n'existent pas dans la base.`);
}

module.exports.player_exists = function (entity, name) {
  if (typeof(name) === "string") {
    return answer(entity, `Le joueur ${name} existe déjà dans la base.`);
  }
  return answer(entity, `Les joueurs ${name.join(', ')} existent déjà dans la base.`);
}

module.exports.bad_arg = function (entity) {
  return answer(entity, `Arguments invalides. Consultez \`/help\`.`);
}

module.exports.handle = function (entity, err) {
  if (err.callback) {
    if (err.args) {
      return err.callback(entity, ...err.args);
    } else {
      return err.callback(entity);
    }
  }
  return module.exports.unknown(entity, err);
}
