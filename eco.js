const vega = require('vega');
const dateFormat = require('dateformat');
const es_client = require("./elastic_api.js").client;
const Errors = require("./errors.js");

module.exports.addMeasure = async function (gold, orn, florin) {
  const timestamp = Date.now();
  const index = `eco-${process.env.SERVER_UID}-${dateFormat(timestamp, "yyyy-mm")}`;

  await es_client.indices.exists({
    index: index
  }).then((exists) => {
    if (!exists) {
      return es_client.indices.create({
        index: index,
        ignore: [400]
      });
    }
  });

  es_client.index({
    index: index,
    body: {
      timestamp: timestamp,
      gold: gold,
      orn: orn,
      florin: florin
    }
  }).catch((err) => console.error(err));
}

module.exports.analyse = async function () {
  const timestamp = Date.now();
  const index = `eco-${process.env.SERVER_UID}-${dateFormat(timestamp, "yyyy-mm")}`;
  return new Promise((resolve, reject) => {
    return es_client.search({
      index: index,
      // no body, search will return all results
    }).then(async (success) => {
      const hits = success.hits.hits.map(h => h._source);
      if (hits.length === 0)
        return reject({callback: Errors.no_data});

      const g = await vegaRun(hits.map(h => ({x: h.timestamp, y: h.gold, c: 0})));
      const o = await vegaRun(hits.map(h => ({x: h.timestamp, y: h.orn, c: 0})));
      const f = await vegaRun(hits.map(h => ({x: h.timestamp, y: h.florin, c: 0})));
      return resolve({attachments: {gold: g, orn: o, florin: f}});
    }).catch((err) => console.error(err));
  });
}

async function vegaRun(values) {
  const last = values[values.length - 1];

  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);

  const timeseries = [...Array(31).keys()]
    .map(i => ({x: date.setDate(i + 1), y: last.y, c: 8}))
    .concat(values);

  // create a new view instance for a given Vega JSON spec
  const vegaJson = {
    "$schema": "https://vega.github.io/schema/vega/v5.json",
    "description": "A chart of the guild's economy",
    "width": 700,
    "height": 300,
    "padding": 5,

    "signals": [
      {"name": "interpolate", "value": "linear"}
    ],

    "data": [
      {
        "name": "table",
        "values": timeseries
      }
    ],

    "scales": [
      {
        "name": "x",
        "type": "time",
        "range": "width",
        "nice": true,
        "zero": false,
        "domain": {"data": "table", "field": "x"}
      },
      {
        "name": "y",
        "type": "linear",
        "range": "height",
        "nice": true,
        "zero": false,
        "domain": {"data": "table", "field": "y"}
      },
      {
        "name": "color",
        "type": "ordinal",
        "range": "category",
        "domain": {"data": "table", "field": "c"}
      }
    ],

    "axes": [
      {"orient": "bottom", "scale": "x"},
      {"orient": "left", "scale": "y"}
    ],

    "marks": [
      { // allow strokeDash to have different behaviors by c
        "type": "group",
        "from": {
          "facet": {
            "name": "series",
            "data": "table",
            "groupby": "c"
          }
        },
        "marks": [
          {
            "type": "line",
            "from": {
               "data": "series"
            },
            "encode": {
              "enter": {
                "x": {"scale": "x", "field": "x"},
                "y": {"scale": "y", "field": "y"},
                "strokeDash": {"type":"nominal", "field":"c"},
                "stroke": {"scale": "color", "field": "c"}
              }
            }
          }
        ]
      }
    ]
  };

  var view = new vega.View(vega.parse(vegaJson)).renderer('none').initialize();

  return await view.toCanvas()
  .then((canvas) => canvas.toBuffer())
  .catch((err) => console.error(err));
}
