---
name: token-ledger
description: Query local Antigravity token consumption, daily calendar usage, Prompt Cache savings, equivalent USD API billing statements, and OS-level AGY network traffic, or open the Token Ledger visual dashboard in the auxiliary pane. Use when the user asks about their token usage, API cost equivalent, daily/monthly spend, cache hit savings, AGY network traffic, or top token-consuming models/conversations.
---

# Token Ledger

Use this skill when the user wants to inspect their token consumption, daily/monthly calendar stats, equivalent USD API billing statement, AGY network traffic (daily & total), or open the visual dashboard.

## Open the Visual Dashboard

When the `agy-ledger` plugin is enabled and running, offer the Aux Pane pill so the user can open the interactive calendar dashboard in one click:

```markdown
[Token Ledger](sidecar://agy-ledger/ledger/)
```

Users can also toggle the main-window modal anytime with `Alt+L` or by clicking the inline composer-footer capsule.

## Querying Exact Numbers in Chat

Run the collector CLI from the plugin directory to get a live JSON summary (reads local Antigravity SQLite databases in read-only mode and merges persisted OS-process traffic stats):

```bash
node --no-warnings "$HOME/.gemini/config/plugins/agy-ledger/sidecars/ledger/collector.mjs" --summary
```

Optional flags:
- `--days 14` — include the last N active days in the summary output (default: 7).
- `--month YYYY-MM` — include detailed model & top conversation breakdown for a specific month.
- `--date YYYY-MM-DD` — include detailed breakdown for a specific local date.

Present numbers clearly with:
1. Equivalent USD API bill (`costUsd`) and Prompt Cache savings (`savedUsd`, cache hit rate %).
2. Total tokens including cache (`grossTokens`) and AGY network traffic (`trafficBytes`, upload/download split) when recorded.
3. Per-model and top-conversation breakdown when relevant.
