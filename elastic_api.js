const elasticsearch = require('elasticsearch');

const bonsai_url = process.env.BONSAI_URL;
const client = new elasticsearch.Client({host: bonsai_url, log: 'trace'});

// Test the connection:
// Send a HEAD request to "/" and allow
// up to 30 seconds for it to complete.
client.ping({requestTimeout: 30000}, (error) => {
  if (error) {
    console.error('ElasticSearch client timed out pinging server (down?)');
  } else {
    console.log('ElasticSearch client connected');
  }
});

module.exports.client = client;
