const dateFormat = require('dateformat');
const es_client = require("./elastic_api.js").client;
const Errors = require("./errors.js");

module.exports.addMeasure = async function (gold, orn, florin) {
  const timestamp = Date.now();
  const index = `eco-${process.env.SERVER_UID}-${dateFormat(timestamp, "yyyy-mm")}`;

  await es_client.get({
    index: index,
    id: 1
  })
  .catch((err) => {
    return es_client.indices.create({
      index: index,
      ignore: [400]
    });
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

module.exports.analyse = function () {
  const timestamp = Date.now();
  const index = `eco-${process.env.SERVER_UID}-${dateFormat(timestamp, "yyyy-mm")}`;
  return new Promise((resolve, reject) => {
    return es_client.search({
      index: index,
      // no body, search will return all results
    }).then((success) => {
      console.log(success.hits.hits);
      return resolve({});
    }).catch((err) => reject({callback: Errors.no_data}));
  });
}

module.exports.analyse();
