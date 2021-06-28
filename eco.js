const vega = require('vega');
const dateFormat = require('dateformat');
const es_client = require("./elastic_api.js").client;
const Errors = require("./errors.js");
const Discord = require("discord.js");

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
      const values = hits.map(h => ({x: h.timestamp, y: h.gold, c: 0}))
        .concat(hits.map(h => ({x: h.timestamp, y: h.orn, c: 1})))
        .concat(hits.map(h => ({x: h.timestamp, y: h.florin, c: 2})));
      const attachment = await vegaRun(values);
      return resolve({attachment: attachment});
    }).catch((err) => reject({callback: Errors.no_data}));
  });
}

module.exports.analyse();

async function vegaRun(values) {
  // create a new view instance for a given Vega JSON spec
  const vegaJson = {
    "$schema": "https://vega.github.io/schema/vega/v3.0.json",
    "width": 500,
    "height": 200,
    "padding": 5,
    "data": [
      {
        "name": "table",
        "values": values,
        "transform": [
          {
            "type": "stack",
            "groupby": ["x"],
            "sort": {"field": "c"},
            "field": "y"
          }
        ]
      }
    ],

    "scales": [
      {
        "name": "x",
        "type": "band",
        "range": "width",
        "domain": {"data": "table", "field": "x"}
      },
      {
        "name": "y",
        "type": "linear",
        "range": "height",
        "nice": true, "zero": true,
        "domain": {"data": "table", "field": "y1"}
      },
      {
        "name": "color",
        "type": "ordinal",
        "range": "category",
        "domain": {"data": "table", "field": "c"}
      }
    ],

    "axes": [
      {"orient": "bottom", "scale": "x", "zindex": 1},
      {"orient": "left", "scale": "y", "zindex": 1}
    ],

    "marks": [
      {
        "type": "rect",
        "from": {"data": "table"},
        "encode": {
          "enter": {
            "x": {"scale": "x", "field": "x"},
            "width": {"scale": "x", "band": 1, "offset": -1},
            "y": {"scale": "y", "field": "y0"},
            "y2": {"scale": "y", "field": "y1"},
            "fill": {"scale": "color", "field": "c"}
          },
          "update": {
            "fillOpacity": {"value": 1}
          },
          "hover": {
            "fillOpacity": {"value": 0.5}
          }
        }
      }
    ]
  };

  var view = new vega.View(vega.parse(vegaJson)).renderer('none').initialize();

  return await view.toCanvas()
  .then((canvas) => new Discord.MessageAttachment(canvas.toBuffer()))
  .catch((err) => console.error(err));
}
