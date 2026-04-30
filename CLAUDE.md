# FX Bot — Daily Exchange Rate Reporter to Lark

## Project Goal
Build a script that fetches USD/THB daily exchange rate from Bank of Thailand API
and sends a formatted message card to a Lark external group via custom webhook bot.

## Delivery Target
- Platform: Lark (international)
- Group Chat ID: oc_ef1fdfdfddaf55d9b6a2e5932d8371b6
- Webhook URL: https://open.larksuite.com/open-apis/bot/v2/hook/a8210dc4-64fb-432d-a6b0-5acced3fc56f

## Data Source
Bank of Thailand API:
https://gateway.api.bot.or.th/Stat-ExchangeRate/v2/DAILY_AVG_EXG_RATE/?start_period=YYYY-MM-DD&end_period=YYYY-MM-DD&currency=USD

- Date must be dynamic (today's date, Bangkok timezone, Asia/Bangkok UTC+7)
- Currency: USD only for now

## Schedule Requirement
- Run every weekday Mon-Fri at 09:00 Bangkok time (UTC+7)
- Skip weekends (no BOT data on weekends)
- Method: Windows Task Scheduler (preferred, stays in Lark ecosystem)

## Output Format
Send a Lark Message Card (schema 2.0) to the webhook with:
- Header: "📊 BOT Daily FX Rate — {weekday} {date}" in blue
- Body: USD buying rate, selling rate, mid rate
- Footer: "Source: Bank of Thailand (bot.or.th)"
- If API fails or no data (weekend): send error notification card

## Tech Stack
- Language: Node.js (JavaScript)
- Runtime: Windows native, no WSL needed
- No external dependencies preferred (use built-in fetch or https module)
- Single file script: fx-bot.js

## File Structure
fx-bot/
├── CLAUDE.md         (this file)
├── fx-bot.js         (main script)
└── README.md         (setup + Task Scheduler instructions)

## Key Constraints
- No GitHub Actions (unreliable, abandoned)
- No external automation platforms (stay Windows/Lark native)
- Script must be runnable standalone: node fx-bot.js
- Must handle BOT API response format correctly (nested data.data_detail array)
- Webhook is custom bot type — POST JSON only, no auth header needed

## BOT API Response Shape (reference)
{
  "data": {
    "data_detail": [
      {
        "currency_id": "USD",
        "currency_name_th": "ดอลลาร์สหรัฐ",
        "buying_sight": "33.25",
        "buying_transfer": "33.50",
        "selling": "33.75",
        "mid_rate": "33.50",
        "period": "2026-04-30"
      }
    ]
  }
}
