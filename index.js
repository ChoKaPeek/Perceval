require('dotenv').config();

require("./sheets_api.js");
require("./discord_api.js");
require("./elastic_api.js");

const Cronjobs = require("./cronjobs.js");
Cronjobs.run();
