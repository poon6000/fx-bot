# FX Bot — Daily USD/THB & CNY/THB Rate Reporter

Sends a daily Lark message card with USD/THB, USD/CNY, and CNY/THB exchange rates from the Bank of Thailand. Runs automatically on weekdays via Vercel cron. Sends weekend, holiday, and error cards so the group always gets a notification.

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

- A Bank of Thailand API token — register free at https://portal.api.bot.or.th/
- Lark webhook URLs (custom bot type)
- A Vercel account (free) — https://vercel.com
- [Node.js](https://nodejs.org/) v18 or later (local testing only)

---

## Setup

### 1. Create your config file (local testing only)

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

### 2. Test locally

```powershell
node $env:USERPROFILE\projects\fx-bot\fx-bot.js
```

You should see both webhooks respond with `StatusCode: 0` and cards appear in your Lark groups.

---

## Vercel Deployment (runs automatically, PC not required)

### 1. Push to GitHub

```cmd
git push origin master
```

### 2. Create Vercel project

- Go to **vercel.com** → **Add New Project** → import your `fx-bot` GitHub repo
- Framework Preset: **Other**
- Root Directory: **`./`** (default)

### 3. Set environment variables

In the Vercel dashboard go to **Settings → Environment Variables** and add:

| Name | Value |
|------|-------|
| `BOT_TOKEN` | your Bank of Thailand API token |
| `WEBHOOKS` | JSON array of webhook URLs (see format below) |

`WEBHOOKS` must be a valid JSON array — double quotes required:
```
["https://open.larksuite.com/open-apis/bot/v2/hook/your-id-1","https://open.larksuite.com/open-apis/bot/v2/hook/your-id-2"]
```

### 4. Redeploy

Go to **Deployments → Redeploy** after saving env vars.

### 5. Test

Open in browser:
```
https://your-project.vercel.app/api/fx-bot
```

Should return `{"ok":true}` and send a card to your Lark groups.

### Cron schedule

Defined in `vercel.json` — runs at **01:00 UTC = 08:00 Bangkok time**, Monday–Friday.

```json
{
  "crons": [
    {
      "path": "/api/fx-bot",
      "schedule": "0 1 * * 1-5"
    }
  ]
}
```

---

## File structure

```
fx-bot/
├── api/
│   └── fx-bot.js          # Vercel serverless function (all logic)
├── fx-bot.js              # local runner (loads config.json → env vars)
├── vercel.json            # Vercel cron schedule
├── package.json           # Node.js config for Vercel
├── config.json            # your credentials (gitignored)
├── config.example.json    # template — commit this, not config.json
├── .gitignore
└── README.md
```

---

## Updating Thai holidays

`THAI_HOLIDAYS` is defined at the top of `api/fx-bot.js`. Update it each January with the new year's public holiday schedule from the Bank of Thailand:  
https://www.bot.or.th/en/financial-institutions/banking-holidays.html

---

## Troubleshooting

| Problem | Likely cause |
|---------|-------------|
| `config.json not found` | Run `copy config.example.json config.json` and fill in credentials |
| `Authorization field missing` | `BOT_TOKEN` is wrong or expired |
| Card shows yesterday's date | Today's BOT data not yet published — normal before ~10:00 |
| Webhook error | Check the webhook URL is still active in your Lark group settings |
| Vercel 500 error | Check `WEBHOOKS` env var is valid JSON with double quotes around each URL |
| Vercel cron not firing | Verify `vercel.json` is committed and the deployment is on Production |
