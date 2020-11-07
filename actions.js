module.exports.help = function () {
  return `Aide:
    - /add <name>: Ajoute un joueur In-Game sans discord
    - /add-discord <name>: Ajoute un joueur In-Game avec discord
    - /level <name> <level>: Enregistre un nouveau niveau IG pour ce joueur
    - /blame-war <name>: Blame un joueur pour une guerre
    - /blame-gauntlet <name>: Blame un joueur pour un labyrinthe
    - /repent <name>: Absout les péchés d'un joueur
    - /show: Affiche les données
    - /roster: Affiche le roster`
}

module.exports.add = function () {

  return `${args[0]} has been added successfully!`
}
