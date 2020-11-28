process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason.stack);
  // application specific logging, throwing an error, or other logic here
});

require('dotenv').config();

require("./sheets_api.js");
require("./discord_api.js");
require("./elastic_api.js");

const Cronjobs = require("./cronjobs.js");
Cronjobs.run();
