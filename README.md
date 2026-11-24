# Token Ledger (`agy-ledger`)

Minimalist token consumption calendar, equivalent API billing dashboard, and OS-level network traffic tracker for Google Antigravity.

## Features

- **Exact Local Billing Telemetry**: Reads local Antigravity conversation SQLite stores (`gen_metadata`, `steps`, and `conversation_summaries.db`) across desktop, IDE, and CLI sessions in strictly read-only mode, with local archival retention.
- **Monthly Calendar & 365-Day Heatmap**: Interactive monthly bill calendar and full-year activity matrix with daily equivalent USD (`$`) API spend, gross token volume (including Prompt Cache), daily network traffic, and streak tracking.
- **Up-to-Date Standard API Pricing**: Computes equivalent USD cost and Prompt Cache savings across Gemini 4 (`Neon`, `Carbon`, `Argon`, `Hydrogen`), Gemini 3.8 Flash, and Claude (`Opus 5.5`, `Sonnet 5.5`, `Opus 4.6`, `Sonnet 4.6`).
- **AGY Network Traffic (Daily & Total)**: Windows samples Antigravity proxy connections through the local Clash-compatible API. macOS and Linux use system TCP counters. The dashboard shows daily and cumulative upload and download.
- **Progressive Disclosure Details**: Click any day or summary card (`Today`, `This Month`, `Total`, `Cache Saved`) to inspect per-model spend, token categories, traffic upload/download breakdown, top conversations (clickable to jump), and 24-hour distribution.
- **Dual Presentation**: Works inside Antigravity's native Aux Pane (`Token Ledger`), via an inline composer-footer capsule + centered modal (`Alt+L`), or standalone in any browser.

## Install

```bash
git clone https://github.com/Nerva05251228/agy-ledger ~/.gemini/config/plugins/agy-ledger
```

Or on Windows PowerShell:

```powershell
git clone https://github.com/Nerva05251228/agy-ledger "$HOME\.gemini\config\plugins\agy-ledger"
```

### Windows proxy traffic

The plugin auto-detects local Clash-compatible controllers on common ports and then checks TCP listeners owned by running sing-box, Mihomo, or Clash cores. No elevation is needed. System proxy and TUN both work when traffic enters that core and its API reports the originating process. The plugin counts connections for `Antigravity.exe` and `language_server.exe` across all destinations.

For a custom setup, use **Settings → Controller port**. Enter the Clash API port (for example, `10813` on some v2rayN setups or `9090` on some Mihomo setups). Leave it blank for automatic detection. The HTTP/SOCKS listener (often `10808` in v2rayN) serves application traffic and is a separate port. If the controller requires a secret, set `AGY_LEDGER_PROXY_TOKEN` in the sidecar's environment and configure its controller port explicitly.

Proxy totals start with the first successful sample and are stored in `proxy-traffic-archive.json`. Connections that open and close between samples and traffic that bypasses the local core are outside the reported totals. The original `traffic-archive.json` remains available. To use the system TCP collector explicitly on Windows, set `AGY_LEDGER_WINDOWS_TRAFFIC=estats` before starting Antigravity. That collector requires Administrator privileges.

## Test

```bash
node --no-warnings sidecars/ledger/test_ledger.mjs
```
