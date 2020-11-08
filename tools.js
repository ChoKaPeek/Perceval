const JOUEURS_SID = 1611105066;
const NIVEAUX_SID = 646100848;

module.exports.rangeDate = function (range) {
  const parts = range.split('!');
  const cells = parts[1].split(':');
  const from = cells[0][0].charCodeAt(0) - 65;
  const to = cells[1][0].charCodeAt(0) - 65;
  return {
    requests: [{
      repeatCell: {
        range: {
          sheetId: getID(parts[0]), startColumnIndex: from, endColumnIndex: to
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: "DATE",
              pattern: "dd/mm/yyyy hh:mm:ss"
            }
          }
        },
        fields: "userEnteredFormat.numberFormat"
      }
    }]
  }
}

function getID(sheet) {
  if (sheet === "joueurs") {
    return JOUEURS_SID;
  }
  else if (sheet === "niveaux") {
    return NIVEAUX_SID;
  }
  return -1;
}
