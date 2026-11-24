# Token Ledger (`agy-ledger`)

Minimalist token consumption calendar, equivalent API billing dashboard, and OS-level network traffic tracker for Google Antigravity.

## Features

- **Exact Local Billing Telemetry**: Reads local Antigravity conversation SQLite stores (`gen_metadata`, `steps`, and `conversation_summaries.db`) across desktop, IDE, and CLI sessions in strictly read-only mode, with local archival retention.
- **Monthly Calendar & 365-Day Heatmap**: Interactive monthly bill calendar and full-year activity matrix with daily equivalent USD (`$`) API spend, gross token volume (including Prompt Cache), daily network traffic, and streak tracking.
- **Up-to-Date Standard API Pricing**: Computes equivalent USD cost and Prompt Cache savings across Gemini 4 (`Neon`, `Carbon`, `Argon`, `Hydrogen`), Gemini 3.8 Flash, and Claude (`Opus 5.5`, `Sonnet 5.5`, `Opus 4.6`, `Sonnet 4.6`).
- **OS-Level AGY Network Traffic (Daily & Total)**: Cross-platform per-process TCP traffic monitor (`Windows iphlpapi TCP EStats`, `macOS nettop`, `Linux ss`) that tracks outbound and local-proxy traffic for `Antigravity` / `language_server` processes while automatically excluding internal loopback IPC and unrelated local dev servers, persisting daily and cumulative upload/download bytes locally.
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

> **Note (Windows Traffic Monitor)**: Windows requires Administrator privileges for `iphlpapi.dll` per-connection TCP EStats. When running unprivileged on Windows, token and billing analytics continue working normally while traffic tracking reports `Admin required`.

## Test

```bash
node --no-warnings sidecars/ledger/test_ledger.mjs
```
