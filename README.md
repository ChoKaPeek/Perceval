# Perceval
Bot interfacing the Discord API with the Google Sheets API using a discord bot token and a Google Cloud service account.

## Usage
Host the bot as a worker on Heroku, and define the needed environment variables - see `.env.example`.

## Troubleshooting

Abandonned opencv4nodejs as it is too much trouble to make it run, whether
trying to build with or without opencv autobuild, with different versions of
opencv and different versions of opencv4nodejs

nodeplotlib creates a server and displays the graph on a webpage without png
possibilities, abandonning it in favor of vega

https://github.com/justadudewhohacks/opencv4nodejs/issues/805
