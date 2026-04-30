# FX Bot — Daily USD/THB & CNY/THB Rate Reporter

Sends a daily Lark message card with USD/THB, USD/CNY, and CNY/THB exchange rates from the Bank of Thailand. Runs automatically on weekdays via Windows Task Scheduler. Sends weekend, holiday, and error cards so the group always gets a notification.

---

## What it sends

| Day | Card |
|-----|------|
| Weekday (data available) | 💱 Rate card with trend indicators |
| Weekday (BOT not yet published) | Uses most recent available data |
| Weekend | 🗓️ Weekend notice card |
| Thai public holiday | 🎌 Holiday card with holiday name |
| Any error | 🚨 Error card with reason |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A Bank of Thailand API token — register free at https://portal.api.bot.or.th/
- Lark webhook URLs (custom bot type)

---

## Setup

### 1. Create your config file

Copy the example and fill in your credentials:

```
copy config.example.json config.json
```

Edit `config.json`:

```json
{
  "BOT_TOKEN": "your-bank-of-thailand-api-token",
  "WEBHOOKS": [
    "https://open.larksuite.com/open-apis/bot/v2/hook/your-test-webhook-id",
    "https://open.larksuite.com/open-apis/bot/v2/hook/your-prod-webhook-id"
  ]
}
```

> `config.json` is in `.gitignore` — it will never be committed.  
> `WEBHOOKS` is an array — add as many groups as you like.

### 2. Test manually

```
node fx-bot.js
```

You should see both webhooks respond with `StatusCode: 0` and cards appear in your Lark groups.

---

## Windows Task Scheduler (run automatically)

Run **once** in Command Prompt as Administrator to register the scheduled task:

```cmd
schtasks /create /tn "FX Bot" /tr "node %USERPROFILE%\projects\fx-bot\fx-bot.js" /sc WEEKLY /d MON,TUE,WED,THU,FRI /st 08:00 /f
```

This runs the bot every weekday at **08:00 Bangkok time**.  
The bot handles weekends/holidays itself — Task Scheduler just needs to fire Mon–Fri.

### Manage the task

```cmd
schtasks /query /tn "FX Bot"          # check status
schtasks /run /tn "FX Bot"            # run immediately
schtasks /delete /tn "FX Bot" /f      # remove task
```

---

## File structure

```
fx-bot/
├── fx-bot.js              # main script
├── config.json            # your credentials (gitignored)
├── config.example.json    # template — commit this, not config.json
├── .gitignore
└── README.md
```

---

## Updating Thai holidays

`THAI_HOLIDAYS` is defined at the top of `fx-bot.js`. Update it each January with the new year's public holiday schedule from the Bank of Thailand:  
https://www.bot.or.th/en/financial-institutions/banking-holidays.html

---

## Troubleshooting

| Problem | Likely cause |
|---------|-------------|
| `config.json not found` | Run `copy config.example.json config.json` and fill in credentials |
| `Authorization field missing` | `BOT_TOKEN` in config.json is wrong or expired |
| Card shows yesterday's date | Today's BOT data not yet published — this is normal before ~10:00 |
| Webhook error | Check the webhook URL is still active in your Lark group settings |
