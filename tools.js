const JOUEURS_SID = 1611105066;
const NIVEAUX_SID = 646100848;
const BLAMES_SID = 768802987;
const CELL_SIZE = 13;

module.exports.getRemainingTimeString = function (remain_t) {
  let str_t = "";
  const t = new Date(remain_t);
  if (t.getUTCHours()) {
    str_t += (t.getUTCHours() === 1) ? "1 heure, " : `${t.getUTCHours()} heures, `;
  }
  if (t.getMinutes()) {
    str_t += (t.getMinutes() === 1) ? "1 minute et " : `${t.getMinutes()} minutes et `;
  }
  str_t += (t.getSeconds() === 1) ? "1 seconde" : `${t.getSeconds()} secondes`;
  return str_t;
}

/*
 * Parse time of the form [XXh][XXm][XXs]
 */
module.exports.parseWarTime = function (time) {
  if (!time)
    return -1;

  let timestamp = 0;
  const h = time.split("h");
  if (h.length === 2) {
    timestamp += 1000 * 60 * 60 * parseInt(h[0].slice(-2), 10);
  }
  const m = time.split("m");
  if (m.length === 2) {
    timestamp += 1000 * 60 * parseInt(m[0].slice(-2), 10);
  }
  const s = time.split("s");
  if (s.length === 2) {
    timestamp += 1000 * parseInt(s[0].slice(-2), 10);
  }
  return timestamp;
}

module.exports.findIndex = function (elt, arr) {
  for (let i = 0; i < arr.length; ++i) {
    for (let j = 0; j < arr[i].length; ++j) {
      if (arr[i][j] === elt) {
        return [i, j]
      }
    }
  }
  return null
}

module.exports.findIndices = function (elts, arr) {
  const res = elts.map((e) => module.exports.findIndex(e, arr))
  if (res.includes(null))
    return null
  return res
}

module.exports.parseTable = function (rows) {
  const str_table = [];
  rows.map((row) => {
    str_line = [];
    for (let j = 0; j < row.length; ++j) {
      if (j && row[j - 1].length > CELL_SIZE) {
        str_line.push(row[j].padEnd(2*CELL_SIZE - row[j - 1].length, " "));
      }
      else {
        str_line.push(row[j].padEnd(CELL_SIZE, " "));
      }
    }
    str_line.push("\n");
    str_table.push(str_line.join(""));
  });
  return str_table;
}

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
  else if (sheet === "blames") {
    return BLAMES_SID;
  }
  return -1;
}
