// Local runner — loads config.json into env vars and runs the bot
const fs = require('fs');
const path = require('path');

let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (e) {
  console.error('ERROR: config.json not found. Copy config.example.json to config.json and fill in your credentials.');
  process.exit(1);
}

process.env.BOT_TOKEN = config.BOT_TOKEN;
process.env.WEBHOOKS = JSON.stringify(config.WEBHOOKS);

const { main } = require('./api/fx-bot');
main().catch(console.error);
