const https = require('https');
const fs = require('fs');
const path = require('path');

// --- Config ---
let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (e) {
  console.error('ERROR: config.json not found. Copy config.example.json to config.json and fill in your credentials.');
  process.exit(1);
}

const { BOT_TOKEN, WEBHOOKS } = config;
const USD_MARKUP = 3.00;

// Thai public holidays 2026 (update each year)
const THAI_HOLIDAYS = {
  '2026-01-01': "New Year's Day",
  '2026-02-22': 'Makha Bucha Day',
  '2026-04-06': 'Chakri Memorial Day',
  '2026-04-13': 'Songkran Festival',
  '2026-04-14': 'Songkran Festival',
  '2026-04-15': 'Songkran Festival',
  '2026-05-01': 'National Labour Day',
  '2026-05-04': 'Coronation Day',
  '2026-05-21': 'Visakha Bucha Day',
  '2026-07-19': 'Asanha Bucha Day',
  '2026-07-20': 'Khao Phansa (Buddhist Lent)',
  '2026-07-28': "King Vajiralongkorn's Birthday",
  '2026-08-12': "Queen Mother's Birthday",
  '2026-10-13': 'Anniversary of King Rama IX',
  '2026-10-23': 'Chulalongkorn Memorial Day',
  '2026-12-05': "King Bhumibol's Birthday",
  '2026-12-10': 'Constitution Day',
  '2026-12-31': "New Year's Eve",
};

// --- Date helpers ---
function getBangkokDate(offsetDays = 0) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bangkokTime = new Date(utc + 7 * 60 * 60000 - offsetDays * 86400000);

  const year = bangkokTime.getFullYear();
  const month = String(bangkokTime.getMonth() + 1).padStart(2, '0');
  const day = String(bangkokTime.getDate()).padStart(2, '0');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    dateStr: `${year}-${month}-${day}`,
    displayDate: `${day}/${month}/${year}`,
    dayOfWeek: days[bangkokTime.getDay()],
    dayOfWeekNum: bangkokTime.getDay()
  };
}

function addCalendarDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// --- BOT API ---
function fetchBotRateByCurrency(dateStr, currency) {
  return new Promise((resolve, reject) => {
    const url = `https://gateway.api.bot.or.th/Stat-ExchangeRate/v2/DAILY_AVG_EXG_RATE/?start_period=${dateStr}&end_period=${dateStr}&currency=${currency}`;
    https.get(url, { headers: { accept: 'application/json', 'Authorization': 'Bearer ' + BOT_TOKEN } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Failed to parse BOT API response')); }
      });
    }).on('error', reject);
  });
}

async function fetchRatesForDate(dateStr) {
  const [usdRes, cnyRes] = await Promise.all([
    fetchBotRateByCurrency(dateStr, 'USD'),
    fetchBotRateByCurrency(dateStr, 'CNY')
  ]);
  const usd = usdRes?.result?.data?.data_detail?.[0];
  const cny = cnyRes?.result?.data?.data_detail?.[0];
  if (usd?.selling && cny?.selling) return { usd, cny };
  return null;
}

// Finds the 2 most recent business days with published data (for trend comparison)
async function fetchLatestRates() {
  const results = [];
  for (let i = 0; i <= 14 && results.length < 2; i++) {
    const dateInfo = getBangkokDate(i);
    if (dateInfo.dayOfWeekNum === 0 || dateInfo.dayOfWeekNum === 6) continue;
    if (THAI_HOLIDAYS[dateInfo.dateStr]) continue;

    const rates = await fetchRatesForDate(dateInfo.dateStr);
    if (rates) results.push({ ...rates, dateInfo });
  }
  if (results.length === 0) return null;
  return { current: results[0], previous: results[1] || null };
}

// --- Change indicator (color + arrow + diff) ---
function trend(currentVal, previousVal) {
  if (previousVal == null) return '';
  const diff = currentVal - previousVal;
  if (Math.abs(diff) < 0.00005) return '  ⚪ —';
  if (diff > 0) return `  🟢 ▲ +${diff.toFixed(4)}`;
  return `  🔴 ▼ ${diff.toFixed(4)}`;
}

// --- Lark ---
function postToWebhook(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function postToAllWebhooks(payload) {
  const results = await Promise.allSettled(WEBHOOKS.map(url => postToWebhook(url, payload)));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') console.log(`Webhook ${i + 1} ✓:`, r.value);
    else console.error(`Webhook ${i + 1} ✗:`, r.reason.message);
  });
}

// --- Cards ---
function buildRateCard({ usd, cny, dateInfo }, previous) {
  const usdThb   = parseFloat(usd.selling);
  const cnyThb   = parseFloat(cny.selling);
  const prevUsd  = previous ? parseFloat(previous.usd.selling) : null;
  const prevCny  = previous ? parseFloat(previous.cny.selling) : null;

  const usdThbStr     = usdThb.toFixed(4);
  const usdThbApplied = (usdThb + USD_MARKUP).toFixed(4);
  const usdCny        = (usdThb / cnyThb).toFixed(4);
  const cnyThbStr     = cnyThb.toFixed(4);
  const prevUsdCny    = (prevUsd && prevCny) ? prevUsd / prevCny : null;
  const validUntil    = addCalendarDays(dateInfo.dateStr, 3);

  return {
    msg_type: 'interactive',
    card: {
      schema: '2.0',
      header: {
        title: { tag: 'plain_text', content: '💱 Daily FX Rates' },
        template: 'blue'
      },
      body: {
        direction: 'vertical',
        elements: [
          {
            tag: 'markdown',
            content: `📅 ${dateInfo.dayOfWeek}, ${dateInfo.dateStr}`
          },
          { tag: 'hr' },
          {
            tag: 'markdown',
            content: [
              `🇺🇸 **USD / THB**`,
              `BOT Avg Selling: \`${usdThbStr}\`${trend(usdThb, prevUsd)}`,
              `💼 Rate Applied (+${USD_MARKUP.toFixed(2)}): **${usdThbApplied}**`,
              `📆 Valid until ${validUntil}`,
            ].join('\n')
          },
          { tag: 'hr' },
          {
            tag: 'markdown',
            content: [
              `🔄 **USD / CNY**`,
              `Cross Rate: \`${usdCny}\`${trend(usdThb / cnyThb, prevUsdCny)}`,
            ].join('\n')
          },
          { tag: 'hr' },
          {
            tag: 'markdown',
            content: [
              `🇨🇳 **CNY / THB**`,
              `BOT Avg Selling: \`${cnyThbStr}\`${trend(cnyThb, prevCny)}`,
            ].join('\n')
          },
          { tag: 'hr' },
          { tag: 'markdown', content: `📌 _Source: Bank of Thailand (bot.or.th)_` }
        ]
      }
    }
  };
}

function buildWeekendCard(dateInfo) {
  return {
    msg_type: 'interactive',
    card: {
      schema: '2.0',
      header: {
        title: { tag: 'plain_text', content: '🗓️ Weekend — No FX Rate Today' },
        template: 'grey'
      },
      body: {
        direction: 'vertical',
        elements: [
          {
            tag: 'markdown',
            content: `📅 ${dateInfo.dayOfWeek}, ${dateInfo.dateStr}\n\nBank of Thailand does not publish exchange rates on weekends.\nRates resume on Monday.`
          }
        ]
      }
    }
  };
}

function buildHolidayCard(dateInfo) {
  const name = THAI_HOLIDAYS[dateInfo.dateStr];
  return {
    msg_type: 'interactive',
    card: {
      schema: '2.0',
      header: {
        title: { tag: 'plain_text', content: '🎌 Public Holiday — No FX Rate Today' },
        template: 'yellow'
      },
      body: {
        direction: 'vertical',
        elements: [
          {
            tag: 'markdown',
            content: `📅 ${dateInfo.dateStr} — **${name}**\n\nBank of Thailand does not publish exchange rates on public holidays.`
          }
        ]
      }
    }
  };
}

function buildErrorCard(dateInfo, reason) {
  return {
    msg_type: 'interactive',
    card: {
      schema: '2.0',
      header: {
        title: { tag: 'plain_text', content: `🚨 FX Bot Error — ${dateInfo.displayDate}` },
        template: 'red'
      },
      body: {
        direction: 'vertical',
        elements: [
          {
            tag: 'markdown',
            content: `⚠️ The FX bot ran but could not deliver today's rates.\n\n**Reason:** ${reason}\n\n🔧 Please check the bot manually.`
          }
        ]
      }
    }
  };
}

// --- Main ---
async function main() {
  const todayInfo = getBangkokDate();
  console.log(`Running for: ${todayInfo.dateStr} (${todayInfo.dayOfWeek})`);

  if (todayInfo.dayOfWeekNum === 0 || todayInfo.dayOfWeekNum === 6) {
    console.log('Weekend — sending weekend card.');
    await postToAllWebhooks(buildWeekendCard(todayInfo));
    return;
  }

  if (THAI_HOLIDAYS[todayInfo.dateStr]) {
    console.log(`Public holiday (${THAI_HOLIDAYS[todayInfo.dateStr]}) — sending holiday card.`);
    await postToAllWebhooks(buildHolidayCard(todayInfo));
    return;
  }

  try {
    const result = await fetchLatestRates();
    if (!result) {
      await postToAllWebhooks(buildErrorCard(todayInfo, 'No data returned from Bank of Thailand after checking the last 14 days.'));
      return;
    }
    if (result.current.dateInfo.dateStr !== todayInfo.dateStr) {
      console.log(`Today's data not yet published, using ${result.current.dateInfo.dateStr}`);
    }
    await postToAllWebhooks(buildRateCard(result.current, result.previous));
  } catch (err) {
    console.error('Error:', err.message);
    try {
      await postToAllWebhooks(buildErrorCard(todayInfo, err.message));
    } catch (e) {
      console.error('Failed to send error card:', e.message);
    }
  }
}

main().catch(async (err) => {
  console.error('Fatal:', err.message);
  try {
    await postToAllWebhooks(buildErrorCard(getBangkokDate(), `Fatal error: ${err.message}`));
  } catch (e) {
    console.error('Failed to send fatal error card:', e.message);
  }
});
