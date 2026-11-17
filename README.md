# Token Ledger (`agy-ledger`)

Minimalist token consumption calendar and equivalent API billing dashboard for Google Antigravity.

## Features

- **Exact Local Billing Telemetry**: Reads local Antigravity conversation SQLite stores (`gen_metadata`, `steps`, and `conversation_summaries.db`) across desktop, IDE, and CLI sessions in strictly read-only mode, with local archival retention.
- **Monthly Calendar & 365-Day Heatmap**: Interactive monthly bill calendar and full-year activity matrix with daily equivalent API spend (`$ USD` / `¥ CNY`), token volume, and streak tracking.
- **Equivalent API Billing & Cache Savings**: Computes tier-aware (`<= 200K` / `> 200K`) API cost across uncached input, Prompt Cache reads (10% rate), thinking tokens, and output responses.
- **Progressive Disclosure Details**: Click any day or summary card (`Today`, `This Month`, `Total`, `Cache Saved`) to inspect per-model spend, token category breakdown, top conversations (clickable to jump), and 24-hour distribution.
- **Dual Presentation**: Works inside Antigravity's native Aux Pane (`Token Ledger`), via an inline composer-footer capsule + centered modal (`Alt+L`), or standalone in any browser.

## Install

```bash
git clone https://github.com/Nerva05251228/agy-ledger ~/.gemini/config/plugins/agy-ledger
```

Or on Windows PowerShell:

```powershell
git clone https://github.com/Nerva05251228/agy-ledger "$HOME\.gemini\config\plugins\agy-ledger"
```

## Test

```bash
node --no-warnings sidecars/ledger/test_ledger.mjs
```
